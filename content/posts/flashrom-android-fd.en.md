---
title: "I Patched Flashrom on My Phone to Recover a Dead Motherboard"
date: 2026-03-30
lastmod: 2026-03-30
draft: false
author: "enrell"
description: "My PC died. I bricked the replacement board. And when I had no computer to fix it, I modified open-source firmware tools to run on Android. This is the story of recovering a motherboard with nothing but a phone and a CH341A programmer."

tags: ["linux", "android", "hardware", "firmware", "open-source", "flashrom", "embedded", "c"]
categories: ["Hardware", "Open Source"]

toc:
  enable: true
  auto: true

math:
  enable: true

share:
  enable: true

comment:
  enable: true
---

It was a Saturday afternoon. I pressed the power button on my PC and... nothing. Fans spun for a second, LEDs blinked, then dead. Then it tried again. One second, dead. One second, dead. An infinite boot loop with no display output, no beep codes, nothing.

What followed was a week-long odyssey of diagnostics, wrong guesses, a new motherboard, a bricked BIOS, and — when every computer in my house was dead — an 11 PM coding session on my phone to patch an open-source tool that was never meant to run on Android.

And I had no multimeter, no POST card, no debug screen. Just my eyes and a lot of determination.

## The Diagnosis

My first suspect was the CPU. No Ethernet LED means no POST, and no POST usually means the CPU isn't initializing. My board was an X99 P4 — the most basic X99 board you can find. Paired with a Xeon E5-2670v3, it had been running fine for months.

But "fine for months" on a budget X99 board with a 12-core Xeon? That's asking a lot from the VRM.

My second suspect was the PSU. If it couldn't deliver enough current to the CPU rail, the board would power on but never reach POST. Fans spin, LEDs glow, but the processor starves.

My third suspect was the motherboard itself. Budget X99 boards have modest VRM designs. A 12-core Haswell-EP chip pulling 120W TDP through 4-phase VRMs? It was a matter of *when*, not *if*.

The answer turned out to be two of three: **both the PSU and the motherboard were dead.** The VRM had given up, and the PSU wasn't delivering clean current anymore.

## New Hardware, New Hope

I bought replacement parts:

- **PSU:** Husky Sledger — solid, reliable, enough headroom
- **Motherboard:** MR9A-H — a step up from the P4
- **CPU:** Xeon E5-2640v3 — just in case the old one was damaged too

I assembled everything, pressed power, and... it booted. BIOS screen. Memtest passed. I installed my OS and started using it.

For about 30 minutes.

## The Turbo Boost Incident

Here's where I made my first mistake.

The E5-2640v3 has a base clock of 2.6 GHz and turbo up to 3.4 GHz. But on these Chinese X99 boards, turbo boost is often locked by default. In games, especially with my RX 6600, that extra clock matters for frame stability.

So I thought: *"Let me flash a modified BIOS with turbo unlock. Easy. I've done this before."*

I had a backup of my old BIOS — the one from the dead X99 P4. In the heat of the moment, I grabbed the wrong file. Instead of flashing the MR9A-H BIOS, I flashed the **P4 BIOS onto the MR9A-H board.**

The flash completed. I rebooted.

Dead. Again. Same 1-second loop.

I had just bricked my second motherboard in one week.

## The CH341A Arrives

The only way to recover a bricked BIOS chip is to reflash it externally. I ordered a CH341A programmer — the cheap, ubiquitous SPI flasher that every hardware tinkerer eventually owns. It arrived the next day.

But here's the thing: **I had no computer to use it on.**

My PC was dead. My mom's laptop had literally died earlier that week — the screen went black mid-zombie-apocalypse-series and never came back. No other computer in sight. It was nighttime. No friend nearby with a desktop. No local repair shop that could handle SPI flashing.

I looked at my phone. A modern Android device. USB-C. OTG support.

*"Wait. The CH341A is USB. My phone has USB. Can I just... use my phone?"*

## The Android Problem

Flashrom is the standard open-source tool for reading and writing flash chips. It supports the CH341A out of the box. Problem: it's a Linux desktop tool. There's no Android app for this.

First instinct: use Termux. It's a Linux terminal emulator for Android. I could compile flashrom from source.

```bash
pkg install git meson ninja libusb
git clone https://review.coreboot.org/flashrom.git
cd flashrom
```

I compiled it. It built. But when I tried to run it:

```
$ ./build/flashrom -p ch341a_spi -V
Initializing ch341a_spi programmer
libusb: error [sysfs_get_device_list] opendir devices failed, errno=13
Couldn't initialize libusb!
```

Permission denied. On Android, SELinux blocks direct access to `/dev/bus/usb/`. Without root, `libusb_init()` fails because it tries to scan the USB bus at startup, and that scan is denied.

The only way to access USB hardware on non-rooted Android is through `termux-usb`, which can request permission from the Android system and hand you an already-opened File Descriptor (FD). But flashrom has no idea what to do with an FD. It expects to scan the USB bus itself.

So I had two options: wait for a real computer, or make flashrom understand Android.

I chose the second.

## Adding Android FD Support to Flashrom

The core insight was this: flashrom uses `libusb` to talk to the CH341A. The normal flow is:

1. `libusb_init(NULL)` — initialize the library (this scans `/dev/bus/usb/`)
2. `libusb_open_device_with_vid_pid()` — find and open the CH341A by its USB IDs
3. Communicate with the device

Step 1 fails on Android because SELinux blocks the USB bus scan. Step 2 fails because it needs step 1.

But libusb has a function most people don't know about: `libusb_wrap_sys_device()`. It takes an already-opened file descriptor and wraps it into a `libusb_device_handle` directly. No scanning. No VID/PID lookup. Just: "here's an FD, give me a handle."

The catch? You still need a valid `libusb_context`. And `libusb_init()` tries to scan devices. The solution is `LIBUSB_OPTION_NO_DEVICE_DISCOVERY`, introduced in libusb 1.0.24. It tells libusb: "initialize yourself, but don't go poking around `/dev/bus/usb/`."

Here's what I added to `programmers/ch341a_spi.c`:

```c
/* Android FD support: get FD from environment variable */
static int get_android_usb_fd(void)
{
    const char *env_fd = getenv("ANDROID_USB_FD");
    if (env_fd) {
        int fd = atoi(env_fd);
        if (fd > 0) {
            msg_pdbg("Using Android USB FD from env: %d\n", fd);
            return fd;
        }
    }
    return -1;
}
```

And in the init function, before any USB scanning happens:

```c
static int ch341a_spi_init(const struct programmer_cfg *cfg)
{
    int android_fd = -1;
    char *fd_param = extract_programmer_param_str(cfg, "fd");
    if (fd_param) {
        android_fd = atoi(fd_param);
        free(fd_param);
    }
    if (android_fd <= 0)
        android_fd = get_android_usb_fd();

    libusb_context *ctx = NULL;

    if (android_fd > 0) {
        /* Android FD mode: skip device scanning */
        struct libusb_init_option opts = {
            .option = LIBUSB_OPTION_NO_DEVICE_DISCOVERY
        };
        ret = libusb_init_context(&ctx, &opts, 1);
        if (ret < 0) {
            msg_perr("Couldn't initialize libusb context: %s\n",
                     libusb_error_name(ret));
            return -1;
        }
        /* Wrap the FD directly into a device handle */
        ret = libusb_wrap_sys_device(ctx, (intptr_t)android_fd, &data->handle);
        if (ret < 0) {
            msg_perr("Failed to wrap USB device fd %d: %s\n",
                     android_fd, libusb_error_name(ret));
            libusb_exit(ctx);
            return -1;
        }
        msg_pdbg("Successfully wrapped USB device from FD %d\n", android_fd);
    } else {
        /* Original path: scan by VID/PID (needs root on Android) */
        ret = libusb_init(&ctx);
        // ... existing code ...
    }
    // ... rest of initialization ...
}
```

The full patch is about 130 lines. Not a lot of code, but it changes everything about how flashrom initializes on Android.

## Testing It Live

I compiled the patched flashrom:

```bash
meson setup build -Dtests=disabled -Dwerror=false -Dprogrammer=ch341a_spi
ninja -C build
```

Then I wrote a small C wrapper because `termux-usb` passes the FD as an argument to the child process:

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <fd>\n", argv[0]);
        return 1;
    }
    int fd = atoi(argv[1]);
    setenv("ANDROID_USB_FD", argv[1], 1);
    execl("./build/flashrom", "flashrom",
          "-p", "ch341a_spi", "--flash-name", NULL);
    return 1;
}
```

And then:

```bash
termux-usb -r -e ./detect_bios /dev/bus/usb/001/003
```

The output:

```
Initializing ch341a_spi programmer
Using Android USB FD from parameter: 7
LibUSB initialized with NO_DEVICE_DISCOVERY for FD mode
Successfully wrapped USB device from FD 7
Probing for Generic unknown SPI chip (REMS), 0 kB:
    compare_id: id1 0xa1, id2 0x2818
Found Unknown flash chip "SFDP-capable chip" (16384 kB, SPI).
```

It worked. The CH341A was talking to the BIOS chip. Through my phone. Over USB. Without root.

## The Recovery

With the connection established, I did a full backup first:

```bash
termux-usb -r -e ./flash_backup /dev/bus/usb/001/003
```

The backup took about 2 minutes for the full 16MB chip. Then I verified it — the hash matched between two reads, confirming a stable connection.

Next, I flashed the correct BIOS — the actual MR9A-H BIOS I had backed up to Google Drive:

```bash
termux-usb -r -E -e './build/flashrom -p ch341a_spi \
  -w /storage/emulated/0/Download/backup_chip_full.rom -V'
```

The flash took about 6 minutes. Flashrom reported:

```
Found Unknown flash chip "SFDP-capable chip" (16384 kB, SPI).
Erasing and writing flash chip... VERIFYING
VERIFIED.
```

I disconnected the CH341A clamps from the motherboard. Reconnected power. Pressed power.

**It booted.**

BIOS screen. Memory detected. CPU running. The motherboard was alive again.

I verified the flash by reading the chip one more time and comparing the hash against the original file:

```
Original file:  5fc52519de9b9b9f41e0e62810307d09
Read back from: 5fc52519de9b9b9f41e0e62810307d09
✅ MATCH
```

## What I Learned

### 1. Budget hardware has limits

A $30 X99 board running a 12-core Xeon is not a sustainable combination. The VRM will give up. If you're running enthusiast-class CPUs, invest in a board that can actually deliver the power.

### 2. Always triple-check your flash files

I had the right backup. I used the wrong file. One filename difference cost me a full day and a CH341A purchase. When flashing firmware, read the filename out loud before pressing Enter.

### 3. Android is Linux, but not *that* Linux

SELinux is there for a reason, but it makes hardware access painful without root. The `libusb_wrap_sys_device()` path is the correct way to handle USB on Android — and it's barely documented.

### 4. The open-source ecosystem is incredible

Flashrom is maintained by coreboot developers who care deeply about hardware freedom. The fact that I could modify it, compile it on a phone, and recover a motherboard — that's the power of open source in action.

### 5. Phones are real computers

I did an entire motherboard firmware recovery on a phone. No laptop. No desktop. Just a phone, a $2 CH341A programmer, and some C code. We're living in the future.

## The Patch

The Android FD support patch for flashrom is available in my working copy. If there's interest, I'll clean it up and submit it upstream to the flashrom Gerrit.

Usage is simple:

```bash
# With wrapper
termux-usb -r -e ./my_wrapper /dev/bus/usb/001/XXX -- -V

# Or with environment variable
ANDROID_USB_FD=7 ./build/flashrom -p ch341a_spi -c FM25W128 -w firmware.bin
```

---

My X99 board is alive. My phone earned its place as a recovery tool. And flashrom now has Android support that didn't exist before this weekend.

Sometimes the best code comes from desperation at 11 PM with no computer and a bricked motherboard staring back at you.

*If you're working on hardware recovery on Android or have questions about the patch, drop a comment below. And if this post helped you, share it — someone out there is probably staring at a bricked board right now with only a phone in their pocket.*

> *See you in the Wired*
