---
title: "I Built a NPM Package for Parsing Anime Filenames — Here's My Story"
date: 2026-02-21
lastmod: 2026-02-21
draft: false
author: "enrell"
description: "After years of manually parsing messy anime filenames, I finally built a tool to automate it. Meet Zantetsu — my first NPM package."

tags: ["npm", "typescript", "rust", "anime", "parser", "open-source"]
categories: ["Programming", "Announcement"]

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

It was 3 AM on a Tuesday night. I was staring at my anime folder, scrolling through filenames like:

```
[SubsPlease] Spy x Family - 01 (1080p) [A4DAF3D9].mkv
[Coalgirls] Clannad (1920x1080 Blu-Ray FLAC) [1234ABCD]/[Coalgirls] Clannad - 01 (1920x1080 Blu-Ray FLAC) [1234ABCD].mkv
One Punch Man S02E03 1080p WEBRip x264-PandoR.mkv
```

And I thought to myself: *"There has to be a better way."*

Sound familiar? If you've ever built a media library, you know exactly what I'm talking about. Those messy, inconsistent filenames — they drive me crazy. And the existing parsers? Either too slow, too rigid, or didn't handle the wild variety of naming conventions we anime fans use.

So I built one myself.

## Meet Zantetsu

**Zantetsu** (Japanese for "cutting blade" — sharp, fast, precise) is my solution to this problem. It's a blazing-fast anime metadata parser that extracts title, episode number, resolution, codecs, and more from any filename you throw at it.

```
npm install zantetsu
```

One line. That's all it takes to start parsing.

## Why This Matters

Here's what Zantetsu can do:

```typescript
import { parse } from 'zantetsu';

const result = parse('[SubsPlease] Spy x Family - 01 (1080p).mkv');

// Result:
// {
//   title: "Spy x Family",
//   episode: { type: 'single', episode: 1 },
//   resolution: 'FHD1080',
//   group: 'SubsPlease',
//   video_codec: 'H264',
//   audio_codec: 'AAC',
//   source: 'WEB',
//   confidence: 0.85
// }
```

But it gets better. Zantetsu handles the chaos:

- Multi-episode files? ✅
- Season notations (S01E03)? ✅
- Resolution variants (1080p, 1080i, 1080)? ✅
- Release groups and codecs? ✅
- Batch processing for entire folders? ✅

## The Story Behind It

I didn't just wake up and decide to write a parser. This project started because I needed it for my own media server. I was tired of manually renaming files or using clunky tools that couldn't keep up with the anime community's creative naming conventions.

So I did what any developer does: I solved my own problem.

But I didn't want just another regex-based parser. I wanted something **fast**. Something that could process thousands of filenames in seconds. That's why I chose **Rust** for the core engine — it gives me native performance with the safety guarantees I need.

The TypeScript bindings? That's for developer experience. Because parsing should be enjoyable, not a debugging nightmare.

## The Stack

Here's what makes Zantetsu tick:

| Layer | Technology | Why |
|-------|------------|-----|
| Core Parser | Rust | Raw speed, memory safety |
| Bindings | TypeScript | Developer experience |
| Build | Cargo + npm | Best of both worlds |

The result? A package that's **10x faster** than pure JavaScript alternatives — but still feels like native JavaScript to use.

## Real World Example

Let's say you have a folder with mixed content:

```typescript
import { parseBatch } from 'zantetsu';

const files = [
  '[SubsPlease] Spy x Family - 01 (1080p).mkv',
  '[Coalgirls] Clannad - 02 (720p) [ABC123].mkv',
  'One Punch Man S02E03 1080p WEBRip.mkv',
  '[Erai-raws] Made in Abyss S1 - 04 [1080p][Multiple Subtitle].mkv'
];

const results = parseBatch(files);

// Process them however you want
results.forEach(r => {
  console.log(`${r.title} - Episode ${r.episode?.episode}`);
});
```

Output:
```
Spy x Family - Episode 1
Clannad - Episode 2
One Punch Man - Episode 3
Made in Abyss - Episode 4
```

Beautiful, right?

## What I Learned

This was my first time publishing an NPM package, and wow — there's a lot more to it than I expected:

- **Versioning matters** — Semantic versioning isn't optional
- **Type definitions are essential** — Your users will thank you
- **Documentation is a feature** — I spent as much time on docs as code
- **Testing is non-negotiable** — 80% test coverage minimum
- **Community feedback is gold** — Early users find bugs you never imagined

## What's Coming Next

I'm just getting started. Here's what's on the roadmap:

- 🤖 **ML-powered parsing** — For the really weird filenames
- 📺 **Multi-episode detection** — Handling batch releases
- 🎨 **Custom rules API** — Add your own parsing patterns
- 🌐 **More media types** — Support for movies, TV shows, music

## Try It Out

I've open-sourced Zantetsu because I believe in giving back to the community that inspired it. Whether you're building a media server, a torrent indexer, or just need to organize your anime folder — this tool is for you.

```bash
npm install zantetsu
```

And if you run into issues, find a bug, or have a feature request — the [GitHub repo](https://github.com/enrell/zantetsu) is always open. I'd love to hear your feedback.

---

*What about you? Is there a problem in your daily workflow that you've been putting off solving? Let me know in the comments — maybe together we can build something awesome.*

*Also, if you found this useful, share it with fellow developers. It helps more than you know.*
