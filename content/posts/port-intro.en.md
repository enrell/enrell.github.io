---
title: "Port: A Simple TUI for Managing Open Network Ports on Linux"
date: 2026-04-14
lastmod: 2026-04-14
draft: false
author: "enrell"
description: "Ever had a terminal crash and your server kept running in the background? I built a Rust TUI to solve this problem once and for all."

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

You know that moment when you're running a development server, the terminal crashes, and suddenly `localhost:3000` is still occupied but you have no idea which process is holding it? I've been there way too many times.

```
$ port
3306 │ mysqld     │ /usr/sbin/mysqld
3000 │ node       │ /home/user/project/node_modules/.bin/next
8080 │ python3    │ /home/user/another_project/app.py
```

Three keystrokes later, problem solved.

## The Problem

It happens to all of us. You start a Node.js server, a Python Flask app, or a Rust backend. Then:

- Your terminal freezes
- You accidentally close the wrong window
- Your IDE crashes

The server? Still running. Invisible. Occupying the port.

Finding and killing it means running commands like:

```bash
sudo lsof -i :3000
# find the PID
kill -9 <PID>
```

Simple, but annoying. Repetitive. The kind of friction that breaks flow state.

## Meet Port

**Port** is a Rust TUI (Terminal User Interface) that shows you all open TCP ports owned by user processes, filters out system services, and lets you terminate processes with a few keystrokes.

No more memorizing lsof flags. No more pipe gymnastics. Just run `port` and see everything.

## Features

- **Live port list** — Shows TCP ports with process names and executable paths
- **Smart filtering** — Excludes SSH, HTTP, Docker, systemd, and other system services automatically
- **Search** — Live filter by process name or port number (`/` or `i` to search)
- **Quick kill** — Select, hit Enter, confirm with `y` — process terminated (SIGKILL)
- **Keyboard-driven** — Vim-style navigation, no mouse needed

## Installation

```bash
cd port
cargo build --release
sudo cp target/release/port /usr/local/bin/
```

That's it. Single binary, no dependencies.

## How It Works

Port reads directly from `/proc/net/tcp` and `/proc/[pid]/fd/` — no external tools needed. Here's the flow:

1. Build an inode-to-PID map by scanning `/proc/[pid]/fd/*` symlinks
2. Parse `/proc/net/tcp` (and `tcp6`) to find listening sockets
3. Match socket inodes to processes
4. Filter out system services via a hardcoded blacklist
5. Render a Ratatui table with navigation, search, and kill confirmation

The whole discovery happens in under 100ms on typical systems.

## The Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Port Discovery | Manual /proc parsing | Zero dependencies, maximum control |
| TUI | Ratatui | Fast, composable terminal UI |
| Process Control | libc::kill | Direct system call, no shelling out |
| Language | Rust | Safety + performance |

## A Real Example

```
PORT │ PROCESS  │ PATH
─────┼──────────┼────────────────────────────────
3000 │ node     │ /home/enrell/blog/.next/server
5173 │ node     │ /home/enrell/app/node_modules/.bin/vite
8080 │ python3  │ /home/enrell/api/main.py
```

I can navigate with `j`/`k`, search with `/`, and kill any of these with Enter + `y`. No context switching. No `ps aux | grep` acrobatics.

## Why SIGKILL?

Some might ask: why SIGKILL (force kill) instead of SIGTERM (graceful shutdown)?

Because this tool is for **stuck** processes. Zombie servers. Crashed terminals. Things that probably won't respond to SIGTERM anyway. The confirmation modal (`y`/`n`) provides enough safety — if you hit Enter and `y` by accident, that's on you.

## Development & Testing

```bash
# Run tests
cargo test

# Run in debug mode
cargo run
```

The codebase is structured for testability — each module has colocated `#[cfg(test)]` blocks:

```
src/
├── main.rs     # Entry point, terminal setup
├── app.rs      # State machine (Normal/Search/ConfirmKill modes)
├── events.rs   # Key event handling
├── ui.rs       # Ratatui rendering
├── ports.rs    # Port discovery from /proc
├── process.rs  # Process operations (kill)
├── filter.rs   # System port/process filtering
└── lib.rs      # Module exports
```

## Future Ideas

- Configurable filters (TOML config instead of hardcoded lists)
- UDP support (`/proc/net/udp`)
- CLI args for quick one-off queries
- Sort by memory/CPU usage

## Try It Out

Port is MIT-licensed and available on GitHub. If you've ever fought with `lsof` or `fuser` to free up a port, this tool is for you.

```bash
# Clone and build
git clone https://github.com/enrell/port
cd port && cargo build --release
sudo cp target/release/port /usr/local/bin/

# Run
port
```

Issues, bug reports, and feature requests welcome. I'd love to hear if it saves you as much time as it's saved me.

---

*What small friction points in your workflow have you automated? Drop a comment — I'm always looking for the next paper cut to solve.*

*Also, if you found this useful, share it with fellow developers. It helps more than you know.*
