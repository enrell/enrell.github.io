---
title: "Eu Adicionei Ditado por Voz ao Meu Shell de Desktop Para Parar de Digitar"
date: 2026-05-29
lastmod: 2026-05-29
draft: false
author: "enrell"
description: "Eu queria voice-to-text no Linux — não um app de browser, não um serviço na nuvem, algo que rodasse no meu painel e digitasse em qualquer janela focada. Então criei um plugin de ASR para o Noctalia rodando NVIDIA Parakeet em Docker."
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

Era uma tarde de quarta-feira. Eu estava escrevendo documentação para um dos meus projetos e minhas mãos estavam cansando. Não do código — da prosa. Parágrafo após parágrafo explicando coisas em português enquanto meus dedos imploravam por misericórdia.

Pensei: por que ainda estou digitando tudo isso?

Eu tenho um microfone. Tenho um compositor Wayland. Tenho um shell que eu mesmo construí. E mesmo assim, toda vez que eu queria ditar texto, precisava abrir um browser, ir até algum serviço de nuvem, copiar o texto, colar de volta. Ou instalar algum app Electron que come 400 MB de RAM só pra ficar parado em background sem fazer nada.

Eu queria algo que vivesse no meu painel, capturasse minha voz e digitasse o texto onde eu estivesse focado. Uma tecla só. Pronto.

## O Problema

Voice-to-text no Linux é uma bagunça.

**Serviços de nuvem** funcionam, mas mandam seu áudio para o servidor de outra pessoa. A latência é imprevisível. Você precisa de conexão com a internet. E está confiando em um terceiro com tudo que você diz.

**Soluções locais** existem, mas são:
- **Pesadas** — Whisper roda bem mas precisa de GPU e come 2-4 GB de VRAM só pra ficar parado
- **Fragmentadas** — umas ferramentas capturam áudio mas não injetam texto. Outras injetam texto mas não capturam áudio. Você acaba colando três scripts diferentes com fita adesiva
- **Só para desktop** — GNOME tem ditado integrado, mas só funciona no GNOME. KDE tem outra coisa. Compositores de tiling? Boa sorte

Eu uso o [Noctalia](https://github.com/NoctaliaSh/noctalia-shell) — um shell de compositor Wayland construído sobre Quickshell. Tem sistema de plugins, barra, painéis e widgets de desktop. Não tem entrada de voz.

Então eu construí.

## Conheça o Noctalia ASR

**Noctalia ASR** é um plugin para o Noctalia que adiciona transcrição de voz para texto em todo o sistema. Aperte `Super+R` ou clique no ícone do microfone na barra. Fale. Aperte de novo. O texto transcrito aparece em qualquer janela que esteja focada.

Sem browser. Sem nuvem. Sem Electron. Um servidor Rust em um container Docker rodando um modelo ONNX, um script Python capturando áudio do PipeWire e um plugin QML que junta tudo.

```
Noctalia Shell (QML)
  └─ Main.qml / BarWidget.qml / Panel.qml
       └─ scripts/asr-record.py  (captura PipeWire + cliente WebSocket)
            └─ container/  (servidor WebSocket ASR em Rust)
                 └─ Parakeet TDT 0.6B ONNX
```

Quatro camadas. Cada uma faz uma coisa.

## O Modelo: NVIDIA Parakeet TDT 0.6B

Eu escolhi o [Parakeet TDT 0.6B](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) por alguns motivos:

- **Pequeno** — 640 MB com quantização int8. Whisper small é 500 MB mas precisa do PyTorch. Este roda direto no ONNX Runtime
- **Rápido** — Arquitetura TDT (Token-and-Duration Transducer). Sem decodificação autoregressiva por token. Ele prevê tokens e suas durações em uma passada
- **Multilíngue** — 25+ línguas fora da caixa. Inglês, português, espanhol, francês, alemão, japonês, chinês e mais
- **Não precisa de GPU** — roda em CPU com ONNX Runtime. Um x86_64 moderno aguenta em tempo real

O modelo tem ~640 MB em disco (int8 quantizado). Quando carregado na memória, usa ~540 MB de RAM. Quando ocioso por 5 minutos, descarrega completamente. Zero pegada de memória quando você não está usando. Recarrega sob demanda quando aperta a tecla de novo.

Essa foi a decisão de design principal: **o modelo não deveria custar nada quando você não está falando.**

## A Arquitetura

### Servidor WebSocket em Rust

O servidor ASR é um binário Rust construído com [axum](https://github.com/tokio-rs/axum) e [parakeet-rs](https://github.com/istupakov/parakeet-rs). Faz três coisas:

1. Aceita conexões WebSocket
2. Recebe áudio PCM bruto (16 kHz mono, 16-bit signed)
3. Roda inferência e retorna texto transcrito

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

Simples. Chunks binários entram, texto sai. Sem parciais em streaming no lado do servidor — o cliente cuida do preview ao vivo de forma diferente (mais sobre isso abaixo).

**Auto-unload** — O servidor rastreia o timestamp da última transcrição. Uma tarefa de background checa a cada 30 segundos. Se o modelo estiver ocioso por mais tempo que `ASR_IDLE_TIMEOUT` (padrão: 300 segundos), ele remove o modelo da memória:

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

Quando uma nova requisição de transcrição chega, `ensure_model_loaded` verifica se o modelo é `None` e recarrega do disco. A primeira transcrição depois de ocioso leva ~2-3 segundos para recarregar. Depois disso, é instantâneo.

**Truque da quantização int8** — A flag `--int8` não copia arquivos de modelo. Ela cria um subdiretório `.int8/` com symlinks apontando para os arquivos quantizados de encoder e decoder, mais symlinks para arquivos compartilhados (vocab, config, tokenizer). O loader do modelo vê um diretório normal com `encoder-model.onnx` e `decoder_joint-model.onnx` — não sabe que são symlinks para variantes int8. Limpo, sem duplicação.

### Cliente Python

O script Python (`asr-record.py`, 430 linhas) cuida da captura de áudio e injeção de texto. É a cola entre o PipeWire e o servidor ASR.

**Captura de áudio** usa `pw-record` — a ferramenta nativa de gravação do PipeWire. Ela saída PCM bruto 16 kHz mono s16le no stdout. Sem dependências, sem camadas de compatibilidade PulseAudio. Apenas PipeWire.

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

**Streaming WebSocket** — Chunks de áudio são enviados ao servidor como mensagens WebSocket binárias. O servidor os acumula até receber uma mensagem `eof`, então roda inferência e retorna o resultado.

**Injeção de texto** via [wtype](https://github.com/xkbcommon/wtype) — uma ferramenta Wayland que simula entrada de teclado. Quando a transcrição completa, `wtype -- "o texto transcrito"` digita em qualquer janela focada:

```python
def type_text(text: str, use_wtype: bool = True):
    if not text or not use_wtype:
        return
    subprocess.run(["wtype", "--", text], timeout=10)
```

Sem manipulação de clipboard. Sem roubar foco. Apenas eventos de teclado, como se você mesmo tivesse digitado.

**Gerenciamento de estado** — O script escreve um arquivo JSON de estado em `/tmp/asr-record-state.json` a cada 200ms durante a gravação. O plugin QML faz polling neste arquivo para mostrar status ao vivo. Sem sockets, sem framework de IPC. Apenas um arquivo.

**Padrão toggle** — O comando `toggle` verifica se um processo de gravação já está rodando (via arquivo PID). Se sim, envia SIGTERM. Se não, cria um novo processo em background. Gerenciamento de processo simples.

### Plugin QML

O plugin Noctalia tem quatro superfícies:

**BarWidget** — Um ícone de microfone na barra do seu shell. Clique para toggle de gravação. Quando gravando, o ícone fica vermelho com uma animação de ponto pulsante. Hover mostra a transcrição parcial como tooltip.

**Panel** — Um painel lateral que abre do widget da barra. Mostra:
- Status da gravação (ponto vermelho + "Recording..." ou "Ready")
- Transcrição parcial ao vivo enquanto fala
- Última transcrição completada
- Histórico das últimas 20 transcrições com timestamps

**Settings** — Quatro configurações:
| Configuração | Padrão | O que faz |
|-------------|--------|-----------|
| `asrServerUrl` | `ws://localhost:8181/ws` | URL WebSocket do servidor ASR |
| `useWtype` | `true` | Digitar texto na janela focada |
| `maxRecordingSec` | `900` | Duração máxima de gravação (0 = ilimitado) |
| `language` | `en` | Código de idioma para transcrição |

**IPC handler** — Expõe um método `toggle` via sistema IPC do Noctalia, para que outros plugins ou ferramentas externas possam acionar a gravação programaticamente.

## O Stack

| Componente | Tecnologia | Por quê |
|------------|-----------|---------|
| Modelo ASR | NVIDIA Parakeet TDT 0.6B | Pequeno, rápido, multilíngue, só CPU |
| Inferência | ONNX Runtime via parakeet-rs | Sem PyTorch, sem stack de ML em Python |
| Servidor | Rust + axum | WebSocket rápido, baixa memória |
| Captura de Áudio | PipeWire (pw-record) | Nativo, sem shim PulseAudio |
| Injeção de Texto | wtype | Simulação nativa de teclado Wayland |
| Script Cliente | Python 3 + websockets | Assíncrono, simples, rápido de escrever |
| UI | QML (Noctalia/Quickshell) | Nativo do shell, baseado em plugins |
| Deploy | Docker Compose | Um comando, download automático do modelo |

## Instalação

### 1. Build e inicie o servidor ASR

```bash
git clone https://github.com/enrell/asr-noctalia-plugin
cd asr-noctalia-plugin
docker compose up -d
```

O modelo (~640 MB) baixa automaticamente na primeira inicialização. Depois disso, fica cacheado no diretório `models/`.

### 2. Instale dependências no host

```bash
pip install websockets
# PipeWire e wtype geralmente já vêm pré-instalados em setups Wayland modernos
```

### 3. Instale o plugin

```bash
ln -s /caminho/para/asr-noctalia-plugin ~/.config/noctalia/plugins/asr-noctalia-plugin
```

Ative nas configurações do Noctalia Shell. O ícone do microfone aparece na sua barra.

### 4. Use

Aperte `Super+R` ou clique no mic. Fale. Aperte de novo. O texto aparece na sua janela focada.

## Docker: Por Que e Como

O servidor ASR roda em Docker porque:

- **Isolamento** — O binário Rust + ONNX Runtime + arquivos de modelo não poluem seu sistema host
- **Reprodutibilidade** — A mesma imagem funciona em qualquer distro Linux com Docker
- **Auto-download** — O script entrypoint verifica os arquivos de modelo e baixa do HuggingFace se estiverem faltando
- **Health checks** — Docker monitora o servidor e reinicia se crashar

O Dockerfile usa multi-stage build: compilação Rust em `rust:1-trixie`, runtime em `debian:trixie-slim`. A imagem final tem ~200 MB + o volume do modelo.

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

`ASR_INT8: "true"` ativa quantização int8 — menor uso de RAM (~540 MB vs ~2.4 GB). O entrypoint cuida do truque de symlink automaticamente.

## Estatísticas de Código

```
283 linhas de Rust (main.rs)
430 linhas de Python (asr-record.py)
~300 linhas de QML divididas em 4 arquivos
```

Isso é um pipeline completo de voice-to-text em todo o sistema: captura de áudio, streaming WebSocket, inferência ONNX, injeção de texto, preview ao vivo, histórico, auto-unload e uma UI nativa do shell. Menos de 1100 linhas no total.

## O Que Eu Aprendi

### 1. Auto-unload muda o cálculo de modelos de IA locais

Um modelo de 540 MB que fica carregado 24/7 é um problema. Um modelo de 540 MB que carrega sob demanda e descarrega após 5 minutos de ocioso é uma funcionalidade. A diferença é um timer de background e um `Mutex<Option<Model>>`. Se você está construindo ferramentas de IA locais, sempre implemente idle unload. A RAM dos seus usuários vai agradecer.

### 2. As ferramentas CLI do PipeWire são subestimadas

`pw-record` te dá captura de áudio PCM bruto com taxa de amostragem, contagem de canais e controle de formato. Sem bibliotecas de áudio em Python. Sem compatibilidade PulseAudio. Apenas `pw-record --rate 16000 --channels 1 --format s16 -` e você tem um stream PCM no stdout. O ecossistema PipeWire quietly se tornou o melhor stack de áudio no Linux.

### 3. wtype é a peça que faltava para injeção de texto em Wayland

No X11, você usaria `xdotool type`. No Wayland, `xdotool` não funciona. `wtype` faz a mesma coisa mas para Wayland — injeta eventos de teclado via protocolo de teclado virtual. É a razão pela qual este plugin pode digitar em qualquer janela, não só terminais.

### 4. Arquivos de estado vencem IPC para comunicação simples QML-processo

Eu poderia ter usado Unix sockets, D-Bus ou stdout do Process do QML. Em vez disso, o script Python escreve um arquivo JSON em `/tmp/` e o plugin QML faz polling com `cat`. Feio? Talvez. Confiável? Com certeza. Sem problemas de buffer, sem leituras parciais, sem cleanup de socket. Às vezes a solução mais simples é a melhor.

### 5. O modelo importa mais que a arquitetura

Eu tentei alguns modelos ASR antes de escolher o Parakeet. Uns eram mais precisos mas precisavam do PyTorch (dependência de 2+ GB). Uns eram mais leves mas só suportavam inglês. Parakeet TDT 0.6B acertou o ponto ideal: nativo em ONNX, multilíngue, pequeno o suficiente para inferência em CPU e preciso o suficiente para uso diário. A escolha do modelo determina tudo downstream — o tamanho da imagem Docker, a pegada de RAM, a latência, o suporte a idiomas.

## Experimente

O [repo no GitHub](https://github.com/enrell/asr-noctalia-plugin) está aberto. Licença MIT. Issues e PRs são bem-vindos.

Se você roda Noctalia e quer voice-to-text sem a nuvem, experimente. Uma tecla, fale, e o texto aparece onde você precisa.

---

*E você? Encontrou uma configuração de voice-to-text que funciona no Linux? Me conta nos comentários.*

*Também, se achou isso útil, compartilha com outros desenvolvedores. Ajuda mais do que você imagina.*

> See you in the Wired.
