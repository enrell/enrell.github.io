---
title: "rustquty 0.4.3: Trustworthy Quality Gates Need Trustworthy Metrics"
date: '2026-06-28'
lastmod: '2026-06-28'
author: 'enrell'
description: 'rustquty 0.4.3 fixes the duplicate and LOC collectors, replacing noisy repeated-line counting with token-based duplicate block detection and making long-line reports explainable.'
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

The first public versions of rustquty shipped with a nice idea: local-first quality gates for Rust projects.

Run one command. Collect metrics. Compare against a baseline or absolute thresholds. Fail if quality regressed.

That model still feels right to me.

But this week I hit the part every tool author eventually hits: the moment where the tool says something so obviously wrong that you stop trusting the entire report.

For rustquty, that happened in two collectors: `duplicates` and `loc`.

Version `0.4.3` is a correction release. Not a flashy feature release. A trust repair release.

## The Bad Duplicate Detector

The old duplicate collector was too naive.

It walked every `.rs` file, trimmed every line, skipped blank lines and obvious comments, then counted repeated lines across the entire codebase.

If a line appeared more than once, every occurrence counted as duplication.

That sounds almost reasonable until you remember what Rust code looks like:

```rust
}
);
},
#[test]
return;
```

Those lines repeat constantly in any real project. A closing brace appearing in two different functions is not duplicated code. It is syntax.

The result was mathematically correct for the algorithm and completely wrong for the product.

I saw reports claiming massive duplicate percentages, not because the codebase had copied 20-line functions everywhere, but because common tokens were repeated thousands of times.

That is worse than useless. It trains you to ignore the gate.

## What Changed in 0.4.3

The duplicate collector now works at the token-block level.

Instead of asking "did this single line appear somewhere else?", rustquty now tokenizes Rust source and searches for repeated windows of tokens. The defaults are intentionally conservative:

- at least 100 tokens
- at least 6 source lines
- exact normalized token matches
- comments and whitespace do not matter
- overlapping windows are merged into duplicate blocks

This means repeated braces, attributes, and punctuation do not trigger duplication anymore.

What triggers it now is actual repeated structure: the kind of copy-paste where a function body, parser branch, mapping block, or setup routine exists twice with the same token stream.

The output also became more useful. `metricsSummary.json` now includes capped structured duplicate block details:

```json
{
  "duplicateLines": 594,
  "filesWithDuplicates": 6,
  "duplicateBlocks": [
    {
      "lines": 12,
      "tokens": 143,
      "occurrences": [
        { "file": "src/a.rs", "startLine": 10, "endLine": 21 },
        { "file": "src/b.rs", "startLine": 42, "endLine": 53 }
      ]
    }
  ]
}
```

That is the difference between "you have duplicates, good luck" and "here is the duplicated block, go look at it."

## The LOC Collector Was Also Lying by Omission

The line-of-code collector had a different problem.

Internally, it used a max line length of 120. That part was fine.

But after collection, the aggregation layer forgot to copy several fields into the final `metricsSummary.json`:

- `maxLineLengthAllowed`
- `filesWithLongLines`
- `longLineFiles`
- long-line detail entries

So the raw collector knew the threshold and the files, but the final JSON could show things like:

```json
"maxLineLengthAllowed": 0,
"filesWithLongLines": 0,
"longLineFiles": []
```

while still reporting thousands of long lines.

That is exactly the kind of inconsistency that makes a quality gate feel haunted.

There was another subtle mismatch: gate messages could mention the baseline max observed line length instead of the actual threshold used by the collector.

So a message could imply "these lines exceed 284" when the collector actually checked against 120.

Again: not acceptable for a tool whose whole job is to create confidence.

## LOC Is Now Configured Where It Matters

In `0.4.3`, line length is configured at collection time.

If you put this in `rustquty.toml`:

```toml
[gate.defaults]
max-line-length = 120
```

the LOC collector uses that value while scanning. The JSON stores it as `maxLineLengthAllowed`. The gate message reports that same threshold. `--verbose` uses the same number.

No split-brain between "what was checked" and "what was reported."

The verbose output now has file:line details too:

```text
loc: 20 lines exceed max length (120)
  rustquty/src/main.rs:198  length 143 > 120
  rustquty-core/src/gate.rs:167  length 138 > 120
```

The details are capped so huge repositories do not explode the report, but the failure is now explainable.

## A Small File-Scanning Fix

While fixing this, I also made the built-in Rust source collectors skip directories that should not be scanned:

- `target/`
- `.git/`
- `quality/`

This matters more than it looks. After a build, `target/` can contain generated `.rs` files from dependencies. A local quality scanner should scan your project, not generated build output.

## Why This Release Matters

The main lesson is simple:

**A quality gate is only as useful as the trust you have in its metrics.**

False positives are not harmless. They create a habit:

1. The tool fails.
2. The failure looks wrong.
3. You ignore it.
4. The next real failure gets ignored too.

That is how a quality tool becomes terminal noise.

I would rather have a smaller, stricter detector that catches fewer things but reports real problems than a noisy detector that reports everything and teaches people to stop reading.

## Release Notes

`rustquty 0.4.3` and `rustquty-core 0.4.3` are published on crates.io.

Install or update:

```bash
cargo install rustquty --force
```

Main changes:

- replaced repeated-line duplicate detection with token-based duplicate block detection
- preserved LOC aggregation fields in `metricsSummary.json`
- made `maxLineLengthAllowed` report correctly
- made line-length checking use the configured threshold during collection
- fixed LOC gate messages to report the actual collector threshold
- added capped duplicate and long-line details for `--verbose`
- skipped `target/`, `.git/`, and `quality/` during built-in Rust source scanning

## What Comes Next

The next thing I want from rustquty is not more collectors for the sake of more collectors.

I want better explanations.

When a gate fails, I want the report to answer:

- what failed?
- where?
- compared to what threshold?
- why does this matter?
- what should I inspect first?

The `0.4.3` release moves in that direction. It makes the two noisiest collectors less magical and more inspectable.

That is the kind of boring improvement that makes a tool survive daily use.

Repository: [github.com/enrell/rustquty](https://github.com/enrell/rustquty)

```bash
rustquty qa --verbose
```

If it fails now, it should fail for a reason you can actually see.

---

> See you in the Wired.
