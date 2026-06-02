---
title: "I Added Voice Dictation to My Desktop Shell So I Can Stop Typing"
date: 2026-05-29
lastmod: 2026-05-29
draft: false
author: "enrell"
description: "I wanted system-wide voice-to-text on Linux — not a browser app, not a cloud service, something that runs on my panel and types into whatever window is focused. So I built an ASR plugin for Noctalia powered by NVIDIA Parakeet running in Docker."
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

It was a Wednesday afternoon. I was writing documentation for one of my projects and my hands were getting tired. Not from the code — from the prose. Paragraph after paragraph of explaining things in plain English while my fingers begged for mercy.

I thought: why am I still typing all of this?

I have a microphone. I have a Wayland compositor. I have a shell that I built myself. And yet, every time I wanted to dictate text, I'd have to open a browser, go to some cloud service, copy the text, paste it back. Or install some Electron app that eats 400 MB of RAM just to sit in the background and do nothing.

I wanted something that lives on my panel, captures my voice, and types the text wherever I'm focused. One key press. That's it.

## The Problem

Voice-to-text on Linux is a mess.

**Cloud services** work, but they send your audio to someone else's server. Latency is unpredictable. You need an internet connection. And you're trusting a third party with everything you say.

**Local solutions** exist, but they're either:
- **Heavy** — Whisper runs great but needs a GPU and eats 2-4 GB of VRAM just to sit idle
- **Fragmented** — some tools capture audio but don't inject text. Others inject text but don't capture audio. You end up gluing three different scripts together with duct tape
- **Desktop-only** — GNOME has built-in dictation, but it only works in GNOME. KDE has something else. Tiling compositors? Good luck

I use [Noctalia](https://github.com/NoctaliaSh/noctalia-shell) — a Wayland compositor shell built on Quickshell. It has a plugin system, a bar, panels, and desktop widgets. It doesn't have voice input.

So I built it.

## Meet Noctalia ASR

**Noctalia ASR** is a plugin for Noctalia that adds system-wide voice-to-text transcription. Press `Super+R` or click the microphone icon in your bar. Speak. Press again. The transcribed text appears in whatever window you're focused on.

No browser. No cloud. No Electron. A Rust server in a Docker container running an ONNX model, a Python script capturing audio from PipeWire, and a QML plugin that ties it all together.

```
Noctalia Shell (QML)
  └─ Main.qml / BarWidget.qml / Panel.qml
       └─ scripts/asr-record.py  (PipeWire capture + WebSocket client)
            └─ container/  (Rust WebSocket ASR server)
                 └─ Parakeet TDT 0.6B ONNX
```

Four layers. Each one does one thing.

## The Model: NVIDIA Parakeet TDT 0.6B

I chose [Parakeet TDT 0.6B](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx) for a few reasons:

- **Small** — 640 MB with int8 quantization. Whisper small is 500 MB but needs PyTorch. This runs on ONNX Runtime directly
- **Fast** — TDT (Token-and-Duration Transducer) architecture. No autoregressive decoding per token. It predicts tokens and their durations in one pass
- **Multilingual** — 25+ languages out of the box. English, Portuguese, Spanish, French, German, Japanese, Chinese, and more
- **No GPU required** — runs on CPU with ONNX Runtime. A modern x86_64 handles it in real-time

The model is ~640 MB on disk (int8 quantized). When loaded in memory, it uses ~540 MB of RAM. When idle for 5 minutes, it unloads completely. Zero memory footprint when you're not using it. Reloads on demand when you press the key again.

That was the key design decision: **the model should not cost you anything when you're not speaking.**

## The Architecture

### Rust WebSocket Server

The ASR server is a Rust binary built with [axum](https://github.com/tokio-rs/axum) and [parakeet-rs](https://github.com/istupakov/parakeet-rs). It does three things:

1. Accepts WebSocket connections
2. Receives raw PCM audio (16 kHz mono, 16-bit signed)
3. Runs inference and returns transcribed text

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

Simple. Binary chunks in, text out. No streaming partials on the server side — the client handles live preview differently (more on that below).

**Auto-unload** — The server tracks the last transcription timestamp. A background task checks every 30 seconds. If the model has been idle for longer than `ASR_IDLE_TIMEOUT` (default: 300 seconds), it drops the model from memory:

```rust
async fn idle_timeout_loop(state: AppState, timeout_secs: u64) {
    let check_interval = tokio::time::Duration::secs(30);
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

When a new transcription request comes in, `ensure_model_loaded` checks if the model is `None` and reloads it from disk. First transcription after idle takes ~2-3 seconds to reload. After that, it's instant.

**Int8 quantization trick** — The `--int8` flag doesn't copy model files. It creates a `.int8/` subdirectory with symlinks pointing to the quantized encoder and decoder files, plus symlinks to shared files (vocab, config, tokenizer). The model loader sees a normal directory with `encoder-model.onnx` and `decoder_joint-model.onnx` — it doesn't know they're symlinks to int8 variants. Clean, no duplication.

### Python Client

The Python script (`asr-record.py`, 430 lines) handles audio capture and text injection. It's the glue between PipeWire and the ASR server.

**Audio capture** uses `pw-record` — PipeWire's native recording tool. It outputs raw PCM 16 kHz mono s16le to stdout. No dependencies, no PulseAudio compatibility layers. Just PipeWire.

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

**WebSocket streaming** — Audio chunks are sent to the server as binary WebSocket messages. The server accumulates them until it receives an `eof` message, then runs inference and returns the result.

**Text injection** via [wtype](https://github.com/xkbcommon/wtype) — a Wayland tool that simulates keyboard input. When the transcription completes, `wtype -- "the transcribed text"` types it into whatever window is focused:

```python
def type_text(text: str, use_wtype: bool = True):
    if not text or not use_wtype:
        return
    subprocess.run(["wtype", "--", text], timeout=10)
```

No clipboard manipulation. No focus stealing. Just keyboard events, as if you typed it yourself.

**State management** — The script writes a JSON state file to `/tmp/asr-record-state.json` every 200ms while recording. The QML plugin polls this file to show live status. No sockets, no IPC framework. Just a file.

**Toggle pattern** — The `toggle` command checks if a recording process is already running (via PID file). If yes, it sends SIGTERM. If no, it spawns a new background process. Simple process management.

### QML Plugin

The Noctalia plugin has four surfaces:

**BarWidget** — A microphone icon in your shell bar. Click to toggle recording. When recording, the icon turns red with a pulsing dot animation. Hover shows the partial transcription as a tooltip.

**Panel** — A side panel that opens from the bar widget. Shows:
- Recording status (red dot + "Recording..." or "Ready")
- Live partial transcription while speaking
- Last completed transcription
- History of the last 20 transcriptions with timestamps

**Settings** — Four settings:
| Setting | Default | What it does |
|---------|---------|-------------|
| `asrServerUrl` | `ws://localhost:8181/ws` | WebSocket URL of the ASR server |
| `useWtype` | `true` | Type text into focused window |
| `maxRecordingSec` | `900` | Max recording duration (0 = unlimited) |
| `language` | `en` | Language code for transcription |

**IPC handler** — Exposes a `toggle` method via Noctalia's IPC system, so other plugins or external tools can trigger recording programmatically.

## The Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| ASR Model | NVIDIA Parakeet TDT 0.6B | Small, fast, multilingual, CPU-only |
| Inference | ONNX Runtime via parakeet-rs | No PyTorch, no Python ML stack |
| Server | Rust + axum | Fast WebSocket handling, low memory |
| Audio Capture | PipeWire (pw-record) | Native, no PulseAudio shim |
| Text Injection | wtype | Native Wayland keyboard simulation |
| Client Script | Python 3 + websockets | Async, simple, fast to write |
| UI | QML (Noctalia/Quickshell) | Shell-native, plugin-based |
| Deployment | Docker Compose | One command, model auto-download |

## Installation

### 1. Build and start the ASR server

```bash
git clone https://github.com/enrell/asr-noctalia-plugin
cd asr-noctalia-plugin
docker compose up -d
```

The model (~640 MB) downloads automatically on first start. After that, it's cached in the `models/` directory.

### 2. Install host dependencies

```bash
pip install websockets
# PipeWire and wtype are usually pre-installed on modern Wayland setups
```

### 3. Install the plugin

```bash
ln -s /path/to/asr-noctalia-plugin ~/.config/noctalia/plugins/asr-noctalia-plugin
```

Enable in Noctalia Shell settings. The microphone icon appears in your bar.

### 4. Use it

Press `Super+R` or click the mic. Speak. Press again. Text appears in your focused window.

## Docker: Why and How

The ASR server runs in Docker because:

- **Isolation** — The Rust binary + ONNX Runtime + model files don't pollute your host system
- **Reproducibility** — Same image works on any Linux distro with Docker
- **Auto-download** — The entrypoint script checks for model files and downloads from HuggingFace if missing
- **Health checks** — Docker monitors the server and restarts it if it crashes

The Dockerfile uses a multi-stage build: Rust compilation in `rust:1-trixie`, runtime in `debian:trixie-slim`. The final image is ~200 MB + the model volume.

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

`ASR_INT8: "true"` enables int8 quantization — lower RAM usage (~540 MB vs ~2.4 GB). The entrypoint handles the symlink trick automatically.

## Code Stats

```
283 lines of Rust (main.rs)
430 lines of Python (asr-record.py)
~300 lines of QML across 4 files
```

That's a full system-wide voice-to-text pipeline: audio capture, WebSocket streaming, ONNX inference, text injection, live preview, history, auto-unload, and a shell-native UI. Under 1100 lines total.

## What I Learned

### 1. Auto-unload changes the calculus of local AI models

A 540 MB model that stays loaded 24/7 is a problem. A 540 MB model that loads on demand and unloads after 5 minutes of idle is a feature. The difference is a background timer and a `Mutex<Option<Model>>`. If you're building local AI tools, always implement idle unload. Your users' RAM will thank you.

### 2. PipeWire's CLI tools are underrated

`pw-record` gives you raw PCM audio capture with sample rate, channel count, and format control. No Python audio libraries. No PulseAudio compatibility. Just `pw-record --rate 16000 --channels 1 --format s16 -` and you have a PCM stream on stdout. The PipeWire ecosystem has quietly become the best audio stack on Linux.

### 3. wtype is the missing piece for Wayland text injection

On X11, you'd use `xdotool type`. On Wayland, `xdotool` doesn't work. `wtype` does the same thing but for Wayland — it injects keyboard events via the virtual keyboard protocol. It's the reason this plugin can type into any window, not just terminals.

### 4. State files beat IPC for simple QML-process communication

I could have used Unix sockets, D-Bus, or QML's Process stdout. Instead, the Python script writes a JSON file to `/tmp/` and the QML plugin polls it with `cat`. Ugly? Maybe. Reliable? Absolutely. No buffering issues, no partial reads, no socket cleanup. Sometimes the simplest solution is the best one.

### 5. The model matters more than the architecture

I tried a few ASR models before settling on Parakeet. Some were more accurate but needed PyTorch (2+ GB dependency). Some were lighter but only supported English. Parakeet TDT 0.6B hit the sweet spot: ONNX-native, multilingual, small enough for CPU inference, and accurate enough for daily use. The model choice determines everything downstream — the Docker image size, the RAM footprint, the latency, the language support.

## Try It

The [GitHub repo](https://github.com/enrell/asr-noctalia-plugin) is open. MIT licensed. Issues and PRs welcome.

If you're running Noctalia and want voice-to-text without the cloud, give it a shot. One key press, speak, and the text appears where you need it.

---

*What about you? Have you found a voice-to-text setup that works on Linux? Let me know in the comments.*

*Also, if you found this useful, share it with fellow developers. It helps more than you know.*

> See you in the Wired.
