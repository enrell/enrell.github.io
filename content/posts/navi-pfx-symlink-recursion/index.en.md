---
date: '2026-07-24'
lastmod: '2026-07-24'
author: 'enrell'
tags: ['navi-agent', 'rust', 'symlink', 'filesystem', 'debugging', 'wine', 'proton']
categories: ['Rust', 'navi-agent']
draft: false
title: "Zombie process and cyclic symlink: an interesting NAVI bug"
description: "A headless NAVI process stuck in infinite recursion because of a `pfx -> .` symlink in a Wine/Proton prefix. How I reproduced it, proved it, and fixed it."
---

I was wrapping up the NAVI 0.3.8 release when I noticed a `navi` process running with high CPU. Nothing crazy — a headless process that didn't terminate, probably a stuck task. I went to investigate.

## The diagnosis

`btop` showed two threads at ~70% CPU each. `ps` confirmed:

```text
$ ps -p 425090 -L
  PID   LWP TTY      STAT TIME COMMAND
425090 425090 ?      S    0:00 navi
425090 425124 ?      R    10:28 tokio-rt-worker
425090 425125 ?      R    10:27 tokio-rt-worker
```

Two `tokio-rt-worker` threads with over 10 hours of accumulated CPU time. The main thread was sleeping (`S`). Those two were running (`R`) non-stop.

`lsof` showed dozens of file descriptors open against the same path:

```text
/home/enrell/Games/umu/umu-default
```

`umu-default` is a Wine/Proton prefix. Inside it there's a symlink that's standard for this structure:

```text
pfx -> .
```

`pfx` points to its own directory. So `pfx/pfx` is the same directory. `pfx/pfx/pfx` too. And so on, infinitely.

## The bug

NAVI was running headless (`navi --no-tui`). The model had called `search` (`list` or `find`) on a path that included this prefix. The directory traversal was the standard code you find everywhere:

```rust
for entry in fs::read_dir(path)?.flatten() {
    let path = entry.path();
    if path.is_dir() {
        collect_files_recursive(&path, ...);
    } else if path.is_file() {
        files.push(...);
    }
}
```

The killer detail: `path.is_dir()` resolves symlinks. When it hit `pfx`, it saw a directory, entered it, and found `pfx` again.

```text
pfx
pfx/pfx
pfx/pfx/pfx
...
```

The function never returned. `tokio::task::spawn_blocking` never returned. The Tokio runtime doesn't shut down while blocking pool threads are still running. Process became a zombie.

The same pattern existed in three places:

- `search_tool.rs`: `collect_files_recursive` (list/find), `collect_matches` (grep), `build_tree` (tree)
- `repo_intelligence.rs`: `collect_source_files` (repository indexing)

## Reproduce before fixing

Instead of just slapping an `if` on it, I wrote tests that reproduced the exact scenario:

```rust
#[test]
#[cfg(unix)]
fn collect_files_recursive_respects_symlink_cycle() {
    let tempdir = tempfile::tempdir().unwrap();
    let root = tempdir.path();
    std::fs::write(root.join("a.txt"), "a").unwrap();
    std::os::unix::fs::symlink(".", root.join("pfx")).unwrap();

    let mut files = Vec::new();
    collect_files_recursive(root, root, &config, 0, 50, &mut files);

    assert_eq!(files.len(), 1);
}
```

Before the fix, it returned 42 entries. All `a.txt`, but with paths like `pfx/pfx/pfx/.../a.txt`. Loop confirmed.

For `repo_intelligence` (`build_index`), the test didn't even return. Timeout. The same symlink took down the entire indexing.

## The fix

The rule is simple: in recursive traversal, use `DirEntry::file_type()` instead of `path.is_dir()`. `file_type()` doesn't resolve symlinks — it tells you the actual type of the entry:

```rust
let file_type = entry.file_type()?;

if file_type.is_symlink() {
    // symlink to directory: skip
    // symlink to file: can still list
    continue;
}

if file_type.is_dir() {
    collect_files_recursive(&path, ...);
} else if file_type.is_file() {
    files.push(...);
}
```

The `tree` action now renders symlinks as leaf nodes with `type: "symlink"` and `children: 0`, instead of descending into them. I also added depth limits (100 levels) in `search` and `repo_intelligence` — not the main fix, but a safety belt for genuinely deep trees.

After the fix:

```bash
$ cargo test -p navi-core -- --test-threads=4
# 1079 + 22 tests passed
```

Commit: `fix(core): prevent infinite directory traversal on symlink cycles`.

## Why this is easy to get wrong

`Path::is_dir()` and `Path::is_file()` follow symlinks. The docs say so, but it's the kind of thing you don't think about when writing a recursive traversal for the nth time. The code works for 99% of directories. The problem only surfaces when someone has a Wine/Proton prefix in the search path — and `pfx -> .` is a symlink that Wine creates by design.

`spawn_blocking` makes it worse because a stuck task holds the whole process hostage. The main thread might be done, but if a blocking thread is in an infinite loop, the Tokio runtime won't shut down. You close the TUI, close the terminal, and the process is still there. Zombie.

If you write tools that walk the filesystem, it's worth reviewing your loops. `is_dir()` follows symlinks. `file_type()` doesn't. The difference seems small until someone has a Wine prefix in the search path.

> See you in the Wired.
