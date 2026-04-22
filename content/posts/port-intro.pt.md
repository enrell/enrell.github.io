---
title: "Port: Uma TUI + CLI para Gerenciar Portas de Rede Abertas no Linux"
date: 2026-04-14
lastmod: 2026-04-21T00:02
draft: false
author: "enrell"
description: "Um tool em Rust que encontra qual processo está usando uma porta e permite matar ele — via TUI ou diretamente pela linha de comando."
tags: ["rust", "tui", "cli", "linux", "networking", "open-source"]
categories: ["Programming", "Tools"]

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

Você roda um servidor, o terminal trava, e de repente o `localhost:3000` ainda está ocupado. Você não faz ideia de qual processo é o dono. Te soa familiar?

**Port** resolve isso. Duas formas de usar:

```
$ port                    # Modo TUI — tabela interativa
$ port 3000              # Modo CLI — mata a porta 3000 diretamente
$ port --list            # Lista portas como texto (scriptável)
```

## O Problema

Acontece o tempo todo. Você inicia um servidor Node.js, um app Python Flask, ou um backend em Rust. Aí:

- Seu terminal congela
- Você fecha a janela errada por acidente
- Sua IDE trava

O servidor? Continua rodando. Invisível. Ocupando a porta.

Encontrar e matar do jeito antigo:

```bash
sudo lsof -i :3000
# acha o PID
kill -9 <PID>
```

Simples, mas chato. Repetitivo. Não é legal o suficiente XD.

## Por Que Isso Existe

Você poderia simplesmente adicionar um alias no seu shell:

```bash
alias kp='kill $(lsof -t -i:$1)'
```

E pronto. Este projeto existe porque:

- **Aprender Rust** — uma ferramenta real e utilizável do zero
- **Entender o /proc** — como o Linux realmente rastreia sockets e processos
- **Exploração de TUI** — construir interfaces interativas com Ratatui
- **Projeto paralelo por diversão** — às vezes você constrói algo só pra construir

Pense nisso como um projeto de estudo prático, não como substituto para `lsof` ou `ss`. Se você quer algo pronto para produção, use as ferramentas reais. Se quer entender como essas ferramentas funcionam por baixo do capô, essa é uma forma de fazer isso.

## Funcionalidades

- **Modo TUI** — Tabela interativa com navegação estilo Vim
- **Modo CLI** — `port <porta>` para matar diretamente, sem interação
- **Modo Lista** — `port --list` para output scriptável
- **Suporte a Docker** — Detecta portas de containers, mata via `docker stop`
- **Filtragem inteligente** — Exclui SSH, HTTP, Docker, systemd e outros serviços do sistema automaticamente
- **Busca** — Filtro ao vivo por nome do processo ou número da porta
- **Kill rápido** — Seleciona, aperta Enter, confirma com `y` — processo terminado (SIGKILL)
- **Mostrar todas as portas** — Flag `--all` ignora o filtro quando você precisa ver serviços do sistema também

## Instalação

O jeito mais fácil de instalar é com uma linha:

```bash
curl -LsSf https://raw.githubusercontent.com/enrell/port/main/scripts/install.sh | sh
```

Isso detecta sua arquitetura automaticamente (x86_64 ou aarch64) e instala em `~/.local/bin/port`.

Ou compile do source:

```bash
git clone https://github.com/enrell/port
cd port
cargo build --release
install -Dm755 target/release/port ~/.local/bin/port
```

Binário único, sem dependências.

## Uso

### Modo TUI

```bash
port
```

![Port TUI](/images/screenshot-2026-04-22_18-42-44.png)

Navegue com `j`/`k`, busque com `/`, mate com Enter + `y`.

![Port TUI com confirmação de kill](/images/screenshot-2026-04-22_18-59-56.png)

### Modo CLI (kill direto)

```bash
port 3000
```

Mata o processo na porta 3000 diretamente. Funciona tanto para processos normais quanto para containers Docker.

### Modo Lista

```bash
port --list
```

```
3000 100 node
5173 101 node
8080 102 python3
```

Útil para scripting ou pipe para outras ferramentas.

## Como Funciona

O Port lê de múltiplas fontes para ter uma visão completa:

1. **`/proc/net/tcp` e `/proc/net/tcp6`** — parse de sockets em escuta diretamente
2. **`ss -tlnpe`** — descoberta suplementar para casos edge
3. **`docker ps`** — detecta portas expostas de containers

Para cada porta, ele constrói um mapa inode→PID escaneando symlinks de `/proc/[pid]/fd/*`, então associa inodes de sockets aos processos. Containers Docker são identificados pelo container ID e parados via `docker stop -t 0` (SIGTERM, imediato).

## A Stack

| Camada | Tecnologia | Por quê |
|--------|------------|---------|
| Descoberta de Portas | /proc parsing + ss + docker ps | Zero deps externos para o core, docker CLI para containers |
| TUI | Ratatui | UI de terminal rápida e composicional |
| CLI Args | Clap | Parsing estruturado de argumentos |
| Controle de Processos | libc::kill + docker CLI | Syscall direta para processos, docker CLI para containers |
| Linguagem | Rust | Segurança + performance |

## Arquitetura

```
src/
├── main.rs      # Ponto de entrada, parsing de args, setup do terminal
├── app.rs       # Máquina de estados (modos Normal/Search/ConfirmKill)
├── events.rs    # Handling de eventos de teclado
├── ui.rs        # Renderização Ratatui
├── ports.rs     # Descoberta de portas do /proc, ss, docker ps
├── process.rs   # Kill de processo (SIGKILL) + docker stop
├── filter.rs    # Filtragem de portas/processos do sistema
└── lib.rs       # Exports dos módulos
```

## Por que Docker Stop ao invés de SIGKILL?

Para containers Docker, usamos `docker stop -t 0` ao invés de SIGKILL. Isso envia SIGTERM para o processo principal dentro do container, que:

- Respeita a lógica de shutdown do container
- Permite cleanup gracioso
- Evita deixar processos orfãos

Processos normais ainda recebem SIGKILL — eles são tipicamente servidores orfãos que não vão responder a SIGTERM de qualquer forma.

## Desenvolvimento & Testes

```bash
# Rodar testes
cargo test

# Rodar em modo debug
cargo run
```

## Ideias Futuras

- Filtros configuráveis (config TOML ao invés de listas hardcoded)
- Suporte a UDP (`/proc/net/udp`)
- Ordenação por uso de memória/CPU
- Port forwarding / rebinding
- Modo de output JSON

## Experimente

Port é licenciado sob MIT e disponível no GitHub.

```bash
curl -LsSf https://raw.githubusercontent.com/enrell/port/main/scripts/install.sh | sh
```

Ou clone e compile:

```bash
git clone https://github.com/enrell/port
cd port && cargo build --release
install -Dm755 target/release/port ~/.local/bin/port
```

Issues e feature requests são bem-vindos.

---

See you in the Wired.
