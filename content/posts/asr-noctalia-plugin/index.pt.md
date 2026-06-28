---
title: "Adicionei voice-to-text ao Noctalia Shell para parar de digitar"
date: 2026-05-29
lastmod: 2026-06-28
draft: false
author: "enrell"
description: "Eu queria voice-to-text system-wide no Linux — não um browser app, não um cloud service, mas algo que ficasse no meu painel e digitasse em qualquer janela focada. Então criei um plugin de ASR para o Noctalia Shell usando NVIDIA Parakeet em Docker."
tags: ["noctalia", "asr", "rust", "python", "qml", "voice", "linux", "docker", "open-source"]
categories: ["Programming", "Announcement"]

toc:
  enable: true
  auto: true

math:
  enable: false

share:
  enable: true

comment:
  enable: true
---

Era uma tarde de quarta-feira. Eu estava escrevendo documentação para um dos meus projetos e minhas mãos começaram a cansar. Não por causa do código — por causa da prosa. Parágrafo atrás de parágrafo explicando coisas em português, enquanto meus dedos imploravam por misericórdia.

Pensei: por que eu ainda estou digitando tudo isso?

Eu tenho um microfone. Tenho um compositor Wayland. Tenho um shell que eu mesmo uso e customizo. Mesmo assim, toda vez que eu queria usar voice-to-text, precisava abrir um browser, entrar em algum cloud service, copiar o texto e colar de volta. Ou instalar algum app em Electron que consome 400 MB de RAM só para ficar parado em background.

Eu queria algo que ficasse no meu painel, capturasse minha voz e digitasse o texto onde eu estivesse com o foco. Uma tecla. Falar. Pronto.

## O Problema

Voice-to-text no Linux ainda é uma bagunça.

**Cloud services** funcionam, mas mandam seu áudio para o servidor de outra pessoa. A latência varia. Você depende da internet. E, no fim das contas, está confiando em um terceiro com tudo que você fala.

**Soluções locais** existem, mas quase sempre caem em uma destas categorias:

- **Pesadas** — Whisper funciona bem, mas geralmente pede GPU e pode consumir 2-4 GB de VRAM só para ficar carregado
- **Fragmentadas** — algumas ferramentas fazem audio capture, mas não fazem text injection. Outras fazem text injection, mas não capturam áudio. Você acaba juntando três scripts diferentes com fita adesiva
- **Presas a um desktop específico** — GNOME tem voice typing integrado, mas só funciona no GNOME. KDE tem outra solução. Compositores tiling? Boa sorte

Eu uso o [Noctalia Shell](https://github.com/NoctaliaSh/noctalia-shell), um shell para compositor Wayland construído sobre Quickshell. Ele tem sistema de plugins, barra, painéis e widgets de desktop. Só não tinha voice input.

Então eu construí uma.

## Conheça o Noctalia ASR

**Noctalia ASR** é um plugin para o Noctalia Shell que adiciona system-wide voice-to-text. Você aperta `Super+R` ou clica no ícone do microfone na barra. Fala. Aperta de novo. O texto transcrito aparece na janela que estiver focada.

Sem browser. Sem cloud. Sem Electron. É um servidor Rust dentro de um container Docker rodando um modelo ONNX, um script Python capturando áudio do PipeWire e um plugin QML conectando tudo.

```text
Noctalia Shell (QML)
  └─ Main.qml / BarWidget.qml / Panel.qml
       └─ scripts/asr-record.py  (PipeWire capture + WebSocket client)
            └─ container/  (servidor WebSocket ASR em Rust)
                 └─ Parakeet TDT 0.6B ONNX
```

Quatro camadas. Cada uma fazendo uma coisa.

## O Modelo: NVIDIA Parakeet TDT 0.6B

Escolhi o [Parakeet TDT 0.6B](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) por alguns motivos:

- **Pequeno** — 640 MB com quantização int8. O Whisper small tem 500 MB, mas precisa do PyTorch. Este roda direto no ONNX Runtime
- **Rápido** — usa a arquitetura TDT (Token-and-Duration Transducer). Nada de decodificação autoregressiva token por token. Ele prevê tokens e durações em uma passada
- **Multilíngue** — mais de 25 idiomas prontos para uso, incluindo inglês, português, espanhol, francês, alemão, japonês, chinês e outros
- **Não precisa de GPU** — roda em CPU com ONNX Runtime. Um x86_64 moderno dá conta em tempo real

O modelo ocupa cerca de 640 MB em disco na versão quantizada em int8. Quando carregado, usa por volta de 540 MB de RAM. Depois de 5 minutos idle, ele descarrega completamente. Zero memory footprint quando você não está usando. Quando você aperta a tecla de novo, ele recarrega on demand.

Essa foi a decisão principal de design: **o modelo não deve custar nada quando você não está falando.**

## A Arquitetura

### Servidor WebSocket em Rust

O servidor ASR é um binário Rust construído com [axum](https://github.com/tokio-rs/axum) e [parakeet-rs](https://github.com/istupakov/parakeet-rs). Ele faz três coisas:

1. aceita conexões WebSocket
2. recebe áudio PCM bruto (16 kHz, mono, 16-bit signed)
3. roda a inferência e devolve o texto transcrito

```rust
async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut pcm_bytes = Vec::new();

    while let Some(message) = socket.recv().await {
        match message {
            Ok(Message::Binary(chunk)) => pcm_bytes.extend_from_slice(&chunk),
            Ok(Message::Text(text)) if is_eof_message(&text) => break,
            Ok(Message::Close(_)) => return,
            // ...
        }
    }

    let samples = pcm16le_to_f32(&pcm_bytes);
    let text = transcribe(state, samples).await?;
    send_result(&mut socket, &text).await?;
}
```

Simples: chunks binários entram, texto sai. O servidor não faz streaming partials. O cliente cuida do live preview de outro jeito, e eu falo disso já já.

**Idle unload** — O servidor guarda o timestamp da última transcrição. Uma tarefa em background acorda a cada 30 segundos. Se o modelo ficou idle por mais tempo que `ASR_IDLE_TIMEOUT` (padrão: 300 segundos), ele remove o modelo da memória:

```rust
async fn idle_timeout_loop(state: AppState, timeout_secs: u64) {
    let check_interval = tokio::time::Duration::from_secs(30);
    loop {
        tokio::time::sleep(check_interval).await;
        let last = *state.last_activity.lock().await;
        if last.elapsed().as_secs() >= timeout_secs {
            let mut model = state.model.lock().await;
            if model.is_some() {
                info!("Model idle for {}s, unloading from memory", timeout_secs);
                *model = None;
            }
        }
    }
}
```

Quando chega uma nova request, `ensure_model_loaded` verifica se o modelo está em `None` e recarrega do disco. A primeira transcrição depois de um período idle leva uns 2-3 segundos para recarregar. Depois disso, fica rápida de novo.

**O truque da quantização int8** — A flag `--int8` não copia arquivos do modelo. Ela cria um subdiretório `.int8/` com symlinks apontando para os arquivos quantizados do encoder e do decoder, além de symlinks para arquivos compartilhados como vocab, config e tokenizer. Para o model loader, parece um diretório normal com `encoder-model.onnx` e `decoder_joint-model.onnx`. Ele nem precisa saber que está lendo variantes int8. Limpo e sem duplicação.

### Cliente Python

O script Python (`asr-record.py`, 430 linhas) cuida do audio capture e do text injection. Ele é a cola entre o PipeWire e o servidor ASR.

**Audio capture** usa `pw-record`, a ferramenta nativa de gravação do PipeWire. Ela escreve PCM bruto 16 kHz mono s16le no stdout. Sem biblioteca de áudio em Python. Sem camada de compatibilidade com PulseAudio. Só PipeWire.

```python
pw_proc = await asyncio.create_subprocess_exec(
    "pw-record",
    "--rate", "16000",
    "--channels", "1",
    "--format", "s16",
    "-",  # stdout
    stdout=asyncio.subprocess.PIPE,
)
```

**WebSocket streaming** — Os chunks de áudio são enviados ao servidor como mensagens WebSocket binárias. O servidor acumula tudo até receber uma mensagem `eof`, roda a inferência e devolve o resultado.

**Text injection** via [wtype](https://github.com/xkbcommon/wtype) — uma ferramenta para Wayland que simula keyboard input. Quando a transcrição termina, `wtype -- "o texto transcrito"` digita na janela focada:

```python
def type_text(text: str, use_wtype: bool = True):
    if not text or not use_wtype:
        return
    subprocess.run(["wtype", "--", text], timeout=10)
```

Nada de mexer no clipboard. Nada de roubar foco. Só keyboard events, como se você mesmo tivesse digitado.

**State management** — O script grava um JSON em `/tmp/asr-record-state.json` a cada 200ms enquanto está gravando. O plugin QML faz polling desse arquivo para mostrar o live status. Sem sockets extras, sem framework de IPC. Só um arquivo.

**Toggle pattern** — O comando `toggle` verifica se já existe um processo de gravação rodando, usando um arquivo PID. Se existe, envia SIGTERM. Se não existe, inicia um novo processo em background. Process management simples, do jeito que eu gosto.

### Plugin QML

O plugin do Noctalia tem quatro superfícies:

**BarWidget** — Um ícone de microfone na barra do shell. Clicar nele alterna a gravação. Enquanto grava, o ícone fica vermelho e mostra uma animação de ponto pulsando. No hover, aparece a transcrição parcial como tooltip.

**Panel** — Um painel lateral que abre a partir do widget da barra. Ele mostra:

- recording status (ponto vermelho + "Recording..." ou "Ready")
- live partial transcription enquanto você fala
- última transcrição concluída
- histórico das últimas 20 transcrições com timestamp

**Settings** — Quatro configurações:

| Configuração | Padrão | O que faz |
|-------------|--------|-----------|
| `asrServerUrl` | `ws://localhost:8181/ws` | URL WebSocket do servidor ASR |
| `useWtype` | `true` | Faz text injection na janela focada |
| `maxRecordingSec` | `900` | Recording timeout máximo (0 = ilimitado) |
| `language` | `en` | Language code para transcrição |

**IPC handler** — Expõe um método `toggle` pelo sistema de IPC do Noctalia, para que outros plugins ou ferramentas externas possam start/stop a gravação programaticamente.

## O Stack

| Componente | Tecnologia | Por quê |
|------------|------------|---------|
| Modelo ASR | NVIDIA Parakeet TDT 0.6B | Pequeno, rápido, multilíngue, só CPU |
| Inferência | ONNX Runtime via parakeet-rs | Sem PyTorch, sem stack de ML em Python |
| Servidor | Rust + axum | WebSocket rápido, baixo uso de memória |
| Audio capture | PipeWire (`pw-record`) | Nativo, sem shim PulseAudio |
| Text injection | wtype | Simulação nativa de keyboard input no Wayland |
| Cliente | Python 3 + websockets | Assíncrono, simples, rápido de escrever |
| UI | QML (Noctalia/Quickshell) | Nativo do shell, baseado em plugins |
| Deploy | Docker Compose | Um comando, download automático do modelo |

## Instalação

### 1. Faça o build e inicie o servidor ASR

```bash
git clone https://github.com/enrell/asr-noctalia-plugin
cd asr-noctalia-plugin
docker compose up -d
```

O modelo (~640 MB) baixa automaticamente no primeiro start. Depois disso, fica cacheado no diretório `models/`.

### 2. Instale as dependências no host

```bash
pip install websockets
# PipeWire e wtype geralmente já vêm pré-instalados em setups Wayland modernos
```

### 3. Instale o plugin

```bash
ln -s /caminho/para/asr-noctalia-plugin ~/.config/noctalia/plugins/asr-noctalia-plugin
```

Ative o plugin nas configurações do Noctalia Shell. O ícone do microfone aparece na barra.

### 4. Use

Aperte `Super+R` ou clique no microfone. Fale. Aperte de novo. O texto aparece na janela focada.

## Docker: Por Que e Como

O servidor ASR roda em Docker por alguns motivos:

- **Isolamento** — o binário Rust, o ONNX Runtime e os arquivos do modelo não poluem o sistema host
- **Reprodutibilidade** — a mesma imagem funciona em qualquer distro Linux com Docker
- **Download automático** — o entrypoint verifica se os arquivos do modelo existem e baixa do Hugging Face quando necessário
- **Health checks** — o Docker monitora o servidor e reinicia se ele cair

O Dockerfile usa build multi-stage: compilação Rust em `rust:1-trixie`, runtime em `debian:trixie-slim`. A imagem final tem cerca de 200 MB, mais o volume do modelo.

```yaml
services:
  parakeet-asr:
    build:
      context: .
      dockerfile: container/Dockerfile
    ports:
      - "8181:8181"
    environment:
      ASR_IDLE_TIMEOUT: 300
      ASR_INT8: "true"
    volumes:
      - ./models:/models
```

`ASR_INT8: "true"` ativa a quantização int8, reduzindo o uso de RAM (~540 MB contra ~2.4 GB). O entrypoint cuida do truque dos symlinks automaticamente.

## Estatísticas de Código

```text
283 linhas de Rust (main.rs)
430 linhas de Python (asr-record.py)
~300 linhas de QML divididas em 4 arquivos
```

Isso é um pipeline completo de system-wide voice-to-text: audio capture, WebSocket streaming, ONNX inference, text injection, live preview, history, idle unload e uma shell-native UI. Menos de 1100 linhas no total.

## O Que Eu Aprendi

### 1. Idle unload muda a conta dos modelos locais de IA

Um modelo de 540 MB carregado 24/7 é um problema. Um modelo de 540 MB que carrega on demand e descarrega depois de 5 minutos idle é uma feature. A diferença é um timer em background e um `Mutex<Option<Model>>`. Se você está construindo ferramentas locais de IA, implemente idle unload. A RAM dos seus usuários agradece.

### 2. As PipeWire CLI tools são subestimadas

`pw-record` entrega raw PCM audio capture com controle de sample rate, número de canais e formato. Sem biblioteca de áudio em Python. Sem compatibilidade com PulseAudio. Só `pw-record --rate 16000 --channels 1 --format s16 -` e você tem um PCM stream no stdout. O ecossistema PipeWire virou, meio em silêncio, o melhor audio stack no Linux.

### 3. wtype é a peça que faltava para text injection no Wayland

No X11, você usaria `xdotool type`. No Wayland, `xdotool` não funciona. `wtype` resolve essa parte: injeta keyboard events via virtual keyboard protocol. É por causa dele que o plugin consegue digitar em qualquer janela, não só em terminais.

### 4. Arquivo de estado vence IPC quando a comunicação é simples

Eu poderia ter usado Unix sockets, D-Bus ou stdout do `Process` no QML. Em vez disso, o script Python escreve um JSON em `/tmp/` e o plugin QML faz polling desse arquivo. Feio? Talvez. Confiável? Muito. Sem problema de buffer, sem partial reads, sem socket cleanup. Às vezes a solução simples é a melhor.

### 5. O modelo importa mais que a arquitetura

Testei alguns modelos ASR antes de ficar com o Parakeet. Alguns eram mais precisos, mas dependiam do PyTorch e puxavam uma instalação de 2+ GB. Outros eram leves, mas só funcionavam bem em inglês. O Parakeet TDT 0.6B acertou o sweet spot: ONNX native, multilíngue, pequeno o suficiente para CPU e preciso o bastante para daily use. A escolha do modelo define tudo downstream: tamanho da Docker image, uso de RAM, latência e suporte a idiomas.

## Experimente

O [repositório no GitHub](https://github.com/enrell/asr-noctalia-plugin) está aberto. Licença MIT. Issues e PRs são bem-vindos.

Se você usa Noctalia e quer voice-to-text sem cloud, testa lá. Uma tecla, fala, e o texto aparece onde você precisa.

---

*E você? Encontrou um setup de voice-to-text que funciona bem no Linux? Me conta nos comentários.*

*E se achou isso útil, compartilha com outros desenvolvedores. Ajuda mais do que parece.*

> See you in the Wired.
