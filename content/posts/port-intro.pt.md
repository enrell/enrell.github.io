---
title: "Port: Uma TUI Simples para Gerenciar Portas de Rede Abertas no Linux"
date: 2026-04-14
lastmod: 2026-04-14T04:55
draft: false
author: "enrell"
description: "Já teve seu terminal travar e o servidor continuar rodando em segundo plano? Eu construí uma TUI em Rust pra resolver esse problema de vez."

tags: ["rust", "tui", "linux", "cli", "networking", "open-source"]
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

Você conhece aquele momento quando está rodando um servidor de desenvolvimento, o terminal trava, e de repente o `localhost:3000` ainda está ocupado mas você não faz ideia de qual processo está segurando ele? Eu passei por isso muitas vezes.

```
$ port
3306 │ mysqld     │ /usr/sbin/mysqld
3000 │ node       │ /home/user/project/node_modules/.bin/next
8080 │ python3    │ /home/user/another_project/app.py
```

Três keystrokes depois, problema resolvido.

## O Problema

Acontece com todo mundo. Você inicia um servidor Node.js, um app Python Flask, ou um backend em Rust. Aí:

- Seu terminal congela
- Você fecha a janela errada por acidente
- Sua IDE trava

O servidor? Continua rodando. Invisível. Ocupando a porta.

Encontrar e matar o processo significa rodar comandos como:

```bash
sudo lsof -i :3000
# acha o PID
kill -9 <PID>
```

Simples, mas chato. Repetitivo. O tipo de fricção que quebra o estado de flow.

## Conheça o Port

**Port** é uma TUI (Interface de Terminal) em Rust que mostra todas as portas TCP abertas pertencentes a processos do usuário, filtra serviços do sistema, e permite terminar processos com poucos keystrokes.

Nada mais de memorizar flags do lsof. Nada mais de acrobacias com pipes. Só rodar `port` e ver tudo.

## Funcionalidades

- **Lista ao vivo de portas** — Mostra portas TCP com nomes de processos e caminhos dos executáveis
- **Filtragem inteligente** — Exclui SSH, HTTP, Docker, systemd e outros serviços do sistema automaticamente
- **Busca** — Filtro ao vivo por nome do processo ou número da porta (`/` ou `i` para buscar)
- **Kill rápido** — Seleciona, aperta Enter, confirma com `y` — processo terminado (SIGKILL)
- **Só teclado** — Navegação estilo Vim, mouse não necessário
- **Mostrar todas as portas** — Flag `--all` ignora o filtro quando você precisa ver serviços do sistema também

## Instalação

O jeito mais fácil de instalar é com uma linha:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/enrell/port/releases/latest/download/port-install.sh | sh
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

## Como Funciona

O Port lê diretamente de `/proc/net/tcp` e `/proc/[pid]/fd/` — nenhuma ferramenta externa necessária. Aqui está o fluxo:

1. Constrói um mapa inode→PID escaneando symlinks de `/proc/[pid]/fd/*`
2. Analisa `/proc/net/tcp` (e `tcp6`) para encontrar sockets em escuta
3. Associa inodes de sockets aos processos
4. Filtra serviços do sistema via uma blacklist hardcoded
5. Renderiza uma tabela Ratatui com navegação, busca e confirmação de kill

Toda a descoberta acontece em menos de 100ms em sistemas típicos.

## A Stack

| Camada | Tecnologia | Por quê |
|--------|------------|---------|
| Descoberta de Portas | Parsing manual do /proc | Zero dependências, controle máximo |
| TUI | Ratatui | UI de terminal rápida e composicional |
| Controle de Processos | libc::kill | Chamada de sistema direta, sem shell |
| Linguagem | Rust | Segurança + performance |

## Um Exemplo Real

```
PORT │ PROCESS  │ PATH
─────┼──────────┼────────────────────────────────
3000 │ node     │ /home/enrell/blog/.next/server
5173 │ node     │ /home/enrell/app/node_modules/.bin/vite
8080 │ python3  │ /home/enrell/api/main.py
```

Posso navegar com `j`/`k`, buscar com `/`, e matar qualquer um desses com Enter + `y`. Sem mudança de contexto. Sem acrobacias de `ps aux | grep`.

Precisa ver portas de sistema também? `port --all` mostra tudo.

## Por que SIGKILL?

Alguns podem perguntar: por que SIGKILL (forçar kill) ao invés de SIGTERM (shutdown gracioso)?

Porque esta ferramenta é para processos **travados**. Servidores zumbis. Terminais travados. Coisas que provavelmente não vão responder a SIGTERM de qualquer forma. O modal de confirmação (`y`/`n`) fornece segurança suficiente — se você apertar Enter e `y` por acidente, aí é problema seu.

## Desenvolvimento & Testes

```bash
# Rodar testes
cargo test

# Rodar em modo debug
cargo run
```

A base de código é estruturada para testabilidade — cada módulo tem blocos `#[cfg(test)]` colocados:

```
src/
├── main.rs     # Ponto de entrada, setup do terminal
├── app.rs      # Máquina de estados (modos Normal/Search/ConfirmKill)
├── events.rs   # Handling de eventos de teclado
├── ui.rs       # Renderização Ratatui
├── ports.rs    # Descoberta de portas do /proc
├── process.rs  # Operações de processos (kill)
├── filter.rs   # Filtragem de portas/processos do sistema
└── lib.rs      # Exports dos módulos
```

## Ideias Futuras

- Filtros configuráveis (config TOML ao invés de listas hardcoded)
- Suporte a UDP (`/proc/net/udp`)
- Ordenação por uso de memória/CPU
- Port forwarding / rebinding

## Experimente

Port é licenciado sob MIT e disponível no GitHub. Se você já lutou com `lsof` ou `fuser` para liberar uma porta, esta ferramenta é pra você.

```bash
# Instalação com uma linha
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/enrell/port/releases/latest/download/port-install.sh | sh

# Ou clone e compile
git clone https://github.com/enrell/port
cd port && cargo build --release
install -Dm755 target/release/port ~/.local/bin/port
```

Issues, reports de bugs e feature requests são bem-vindos. Adoraria saber se isso economiza tanto tempo para você quanto economizou para mim.

---

*Que pequenos pontos de fricção no seu workflow você automatizou? Deixa um comentário — eu estou sempre procurando o próximo "paper cut" pra resolver.*

*Se achou útil, compartilha com outros desenvolvedores. Ajuda mais do que você imagina.*

See you in the Wired.
