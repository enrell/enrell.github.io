---
title: "rustquty: The Local Quality Scanner Rust Projects Deserve"
date: '2026-06-02'
lastmod: '2026-06-02'
author: 'enrell'
description: 'Tired of manually running fmt, clippy, coverage and the rest in inconsistent ways? Me too. I wanted a local quality gate that was fast and prevented code from slowly rotting — without depending on slow CI or enterprise SonarQube. So I built rustquty.'
tags: ['rust', 'quality', 'tools', 'open-source', 'ci', 'rustquty']
categories: ['Rust', 'Tools']
toc:
  enable: true
  auto: true
comment:
  enable: true
share:
  enable: true
---

I was in the middle of a refactor in animedb, one of my Rust projects. Ran `cargo fmt --check`, ran `cargo clippy`, ran `cargo test`. All green. Pushed the PR.

A few days later, looking at the diff, I noticed one function had ballooned to over 100 lines. Another had 8 levels of nesting. Nobody commented. CI passed. Because CI doesn't look at that.

I'd seen this happen before. Quality doesn't disappear overnight. It degrades slowly, one function at a time, until one day you look at a module and think "how did this turn into such a mess?"

Tools like SonarQube exist for this. But they're heavy, require a server, are overkill for personal projects or small teams, and I want things **local-first**. No network. No account. No drama.

That's when I started writing rustquty.

## What rustquty Does

It's a local-first quality scanner for Rust projects. It runs a bunch of "collectors", assembles the metrics, and compares them against a baseline or against absolute thresholds (inspired by SonarQube, Detekt, ESLint, etc.).

If quality got worse since the baseline (the "ratchet model"), it fails. If you prefer, you can pin absolute rules like "no function over 80 lines" or "minimum 80% coverage" and it will enforce them.

12 collectors total:

- The classics: fmt, clippy, tests, coverage, deny, audit, hack, mutants
- The built-in ones (no external tools): duplicates, loc (with line length enforcement), size (lines per file/function + parameter count via AST), complexity (cyclomatic + max nesting depth via AST)

You run it with `rustquty qa` (or `collect` + `gate` separately). It produces three JSON files in the `quality/` directory:

- `metricsSummary.json` — everything collected right now
- `baseline.json` — the current thresholds (if you run init-baseline)
- `qualityReport.json` — the gate result, with listed violations

And the best part: it exits with code 0, 1, or 2. Perfect for CI, pre-commit hooks, or just running before you commit.

## How I Use It (and How You Can)

Normal flow in any Rust project:

```bash
rustquty init          # creates quality/ with empty baseline
rustquty qa            # runs everything and gates
```

If it passes, life goes on. If it fails, it shows you exactly what broke (and with `--verbose` it even shows `file:line` for size/complexity/loc violations).

Want something quick before opening a PR? Use the `fast` profile:

```bash
rustquty qa --profile fast   # fmt + clippy only
```

Want the full treatment, including the slow collectors? `full` (default, skips mutants) or `deep` (everything, including mutation testing which takes forever).

There's also `doctor` to see what's available on your PATH:

```
rustquty doctor
```

Handy when you're on a fresh machine or in a container.

## Ratchet vs Absolute Thresholds

There are two ways to think about quality and I wanted both.

**Ratchet (default)**: you run `rustquty init-baseline` on top of a good metricsSummary. From then on, any degradation fails the gate. It's a "don't let it get worse" mechanism. Great for teams that want to improve quality incrementally without breaking everything at once. The baseline is just JSON, you version it with the code.

**Absolutes via `[gate.defaults]`**: you put in `rustquty.toml` things like:

```toml
[gate.defaults]
max-cyclomatic-per-function = 15
max-nesting-depth = 5
max-lines-per-function = 80
max-lines-per-file = 1000
min-coverage-percent = 80.0
max-clippy-warnings = 0
max-line-length = 120
```

These values come from real references (SonarQube, Detekt, etc). When you set one, it **overrides** the baseline value for that metric. Want to use ratchet for duplicates but hard-cap complexity? You can. Want everything absolute? Also works. Omit a field = falls back to baseline.

Precedence is clear: CLI flag > rustquty.toml > built-in defaults.

## The Collectors I Like Most (the Built-ins)

The collectors that call external tools are nice, but the ones that actually gave me new value were the ones I implemented using real AST parsing:

- **duplicates**: finds identical lines across Rust source files. Simple, but surprisingly useful for catching copy-paste that turned into technical debt.
- **loc + line length**: counts total/code/comment/blank lines, and also complains about lines exceeding 120 chars (configurable). The block comment (`/* */`) parser was more annoying than it looked.
- **size**: per-file and per-function. Total lines, code lines, parameter counts. Uses `syn` v2 to actually parse, not regex. We detect a 256-line function with 4 parameters? Yes. And it reports the violation with the function name.
- **complexity**: cyclomatic (decision points: if, match, loops, &&, ||, ?) + maximum nesting depth. Again, everything via AST. A function with complexity 50 and nesting 7? It will show up in the report.

These four require nothing but rustquty installed. Zero external dependencies. Fast. And they run in parallel with rayon alongside the others.

## Configuration

Create a `rustquty.toml` at the root of your workspace:

```toml
[profile]
default = "full"

[collectors]
mutants = false   # turn off the slow ones by default

[gate.size]
max_lines_per_file = 500
max_lines_per_function = 80
max_parameters_per_function = 5

[gate.complexity]
max_cyclomatic_per_function = 10
max_nesting_depth = 5

[gate.loc]
max_line_length = 120
```

Or use the absolute defaults I mentioned earlier. Works for both models.

## CI Integration

There's a composite action in the repo itself. Basic example:

```yaml
- uses: rustquty/rustquty/.github/actions/rustquty@main
  with:
    profile: full
```

Or you copy the action locally and tweak it. On failure it can even upload the JSONs as artifacts for inspection.

## Current State and Honesty

Current version is 0.4.1. Full support for all 12 collectors, verbose mode, absolute thresholds (added in 0.4), public API in rustquty-core if you want to embed this in another tool, and a nicely refactored gate.

rustquty uses itself (has a versioned quality/ directory). And guess what? The current report shows some size and complexity violations, because I'm still cleaning up legacy code from the early phases. The ratchet is helping me not make it worse while I fix things.

I use it on animedb and plan to bring it to my other Rust crates.

## What I Learned Building This

- Real Rust parsing with `syn` is absurdly more reliable than any regex or half-baked tree-sitter for complexity/size metrics. The cost of maintaining a correct parser is zero — the compiler does the work.
- The ratchet model is a brilliant idea I stole from "serious" software engineering. It removes the "but it's good enough?" discussion. If it got worse compared to yesterday, it failed. Period.
- Optional collectors and profiles are mandatory. If you force people to run `cargo mutants` every time, they will turn the tool off. Let them choose the depth.
- Versioned JSON schemas + ISO timestamps + well-defined exit codes make all the difference when you want to integrate with other things later.
- Writing tooling that people will actually use day-to-day requires more attention to terminal UX (the ✓ ✗ ○ ⚠ markers, the human-readable output, the --verbose that actually helps) than to exotic features.

## Try It

```bash
cargo install rustquty
```

Or download pre-built binaries from the releases.

```bash
cd your-rust-project
rustquty init
rustquty qa --verbose
```

The repository is [github.com/enrell/rustquty](https://github.com/enrell/rustquty). Issues, PRs, suggestions for new collectors — everything is welcome.

If you already use some linter/quality tool in your Rust workflow and feel like something is missing, tell me. I'm curious what other people wish existed.

---

> See you in the Wired.
