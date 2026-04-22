---
title: "I Rewrote My Crystal MCP in Go — And It Got Better: Better Search MCP"
date: 2026-04-21
lastmod: 2026-04-21
draft: false
author: "enrell"
description: "I already built a Crystal MCP for web search and content extraction. Then I rewrote it in Go with smarter extraction, structured responses, and batch fetching. Here's why — and what changed."

tags: ["mcp", "go", "search", "searxng", "open-source", "content-extraction"]
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

![Better Search MCP in Claude Code](/images/screenshot-2026-04-22_19-22-33.png)

If you read my last post, you know I built searxng-web-fetch-mcp — a Crystal MCP server that gives AI assistants web search and content fetching. It worked. It was fast. I shipped it in a night.

But after a few weeks of daily use, things started to bother me.

The extraction was good, but not great. Some articles came back with navigation junk. Others had the main content buried under sidebar text. And the batch fetch, while fast, didn't give me the control I wanted over what came back and how.

I kept patching. Then I realized: I wasn't patching a bug. I was patching an architecture.

## The Problem, Revisited

Here's what kept nagging me:

- **Extraction quality** — The Crystal version used a ported go-trafilatura heuristic. It worked for most articles, but the scoring wasn't aggressive enough. Sidebars with long text still slipped through.
- **Response structure** — The original returned plain JSON strings. The AI had to parse text inside text. No structured content. No metadata schema. No way for the client to know what was a title and what was body text.
- **Batch control** — Batch fetch was all-or-nothing. No per-URL timeouts. No truncation limits. No way to say "fetch these 10 URLs but only give me 4000 characters each."
- **The dependency story** — Crystal is beautiful, but the ecosystem is small. Every time I needed a new HTML parsing feature, I was writing it from scratch or porting it from another language.

And the biggest one: **the MCP protocol was evolving**. Structured content, `_meta` fields, schema versioning — the spec was moving toward richer response shapes. My Crystal code wasn't built for that.

So I did what any reasonable developer does at 11 PM with a working project: I rewrote it.

## Why Go

I already use Go for navi-agent. I already think in Go when I reach for concurrency. And the Go standard library — specifically `golang.org/x/net/html` — gives you a production-grade HTML parser right out of the box. No porting. No FFI. No prayer.

Three reasons, same as last time but different:

1. **Ecosystem** — Go's net/html parser, its concurrency primitives, its testing framework. All batteries included.
2. **Structured responses** — Go's type system makes it trivial to define exact response shapes with JSON tags. No runtime type gymnastics.
3. **Single binary** — `go install` and you're done. Same deployment story as Crystal, but with a deeper standard library behind it.

## Meet Better Search MCP

**Better Search MCP** is the Go rewrite that does everything the Crystal version did — and does it better. Same two tools: search and fetch. Same SearXNG + Byparr stack. But the extraction is smarter, the responses are structured, and the batch fetching has real control.

```bash
go install github.com/enrell/better-search@latest
```

One command. Binary lands in `$HOME/go/bin/better-search`. Done.

## What Changed

### Smarter Content Extraction

The Go extractor uses a different scoring algorithm. Instead of just checking class names, it walks the DOM and scores every candidate node based on:

1. **Text density** — How much actual text vs. HTML tags
2. **Link density** — High link-to-text ratio? Probably navigation, not content
3. **Boost patterns** — Class names and IDs like "content", "article", "post", "entry", "main"
4. **Penalty patterns** — Class names like "comment", "sidebar", "footer", "widget", "ad", "social"
5. **Tag preference** — `<article>`, `<main>`, `<section>` get natural boosts over generic `<div>` soup

The result: cleaner extractions on messy sites. The kind of sites that have three sidebars, a cookie banner, a newsletter popup, and one paragraph of actual content.

### Structured Content Responses

This is the big one. Every tool response now includes `structuredContent` alongside the legacy `content` field:

```json
{
  "content": "...",
  "structuredContent": {
    "success": true,
    "tool": "web_fetch",
    "results": [...]
  },
  "_meta": {
    "tool": "web_fetch",
    "schemaVersion": "1.0"
  }
}
```

The AI client doesn't have to parse JSON out of a string inside a string. It gets a real object with real fields. Title is a title. Author is an author. Date is a date. No guessing.

Errors are structured too:

```json
{
  "success": false,
  "tool": "web_fetch",
  "error": {
    "code": "tool_error",
    "message": "..."
  },
  "generatedAt": "2026-04-18T12:00:00Z"
}
```

No more parsing error messages out of freeform text. The client always knows what happened.

### Batch Fetch With Real Control

The Crystal version had batch fetching. The Go version has *configurable* batch fetching:

```json
{
  "urls": [
    "https://example.com/article-1",
    "https://example.com/article-2",
    "https://example.com/article-3"
  ],
  "timeout_seconds": 20,
  "max_content_chars": 4000,
  "fail_fast": true,
  "include_metadata": true,
  "preserve_links": false,
  "prefer_readable_text": true
}
```

Every parameter you'd want:

| Parameter | Purpose | Default |
|-----------|---------|---------|
| `url` | Single URL fetch | — |
| `urls` | Batch fetch (up to 25) | — |
| `include_metadata` | Title, author, date, language | `true` |
| `timeout_seconds` | Per-request timeout (1-120) | `30` |
| `max_content_chars` | Truncate output | No limit |
| `preserve_links` | Keep Markdown links | `true` |
| `raw_html` | Include extracted HTML | `false` |
| `prefer_readable_text` | Article-focused vs. full page | `true` |
| `fail_fast` | Stop batch on first error | `false` |

Batch URLs preserve order. Duplicate URLs are kept. The result array has the same cardinality as the input. No surprises.

### Concurrency That Scales

The batch fetch uses a semaphore pattern — Go's channels acting as a counting semaphore:

```go
semaphore := make(chan struct{}, maxConcurrent)
results := make([]FetchResult, len(urls))
var wg sync.WaitGroup

for i, u := range urls {
    wg.Add(1)
    go func(idx int, rawURL string) {
        defer wg.Done()
        semaphore <- struct{}{}
        defer func() { <-semaphore }()
        results[idx] = fetchSingleResult(cfg, rawURL, options)
    }(i, u)
}

wg.Wait()
```

Same idea as Crystal's fibers, but Go goroutines are equally lightweight and the pattern is more explicit. The `MAX_CONCURRENT_REQUESTS` env var (default: 30) controls the ceiling.

### Config Validation on Startup

Invalid configuration fails fast. If `SEARXNG_URL` or `BYPARR_URL` isn't a valid HTTP/HTTPS URL with a host, the server refuses to start:

```
configuration error: SEARXNG_URL must be a valid http or https URL with a host
```

No silent misconfiguration. No "why is search returning empty results?" debugging sessions at 2 AM.

### Request Logging

Every request is logged with structured attributes:

```json
{"level":"DEBUG","msg":"completed request","request_id":"req-000001","method":"tools/call","elapsed_ms":342}
```

Set `LOG_LEVEL=DEBUG` to see everything. Set `LOG_LEVEL=ERROR` for silence. Production stays clean. Development stays observable.

## The Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | Go 1.23+ | Stdlib HTML parser, goroutines, single binary |
| HTML Parsing | golang.org/x/net/html | Production-grade DOM walking |
| Content Scoring | Custom heuristic engine | Boost/penalty pattern matching |
| Markdown Rendering | DOM-based converter | Preserves structure, not just text |
| MCP Protocol | JSON-RPC over stdio | Standard, no HTTP overhead |
| HTTP Clients | SearXNG + Byparr clients | Clean separation, testable |

## Code Stats

```
2146 lines of Go across the entire project.
```

That's a full MCP server with search, batch fetch, content extraction, Markdown rendering, structured responses, config validation, and request logging. In 2146 lines.

Go's standard library does a lot of the heavy lifting. No framework. No ORM. No magic.

## The Architecture

```
cmd/server/            → Binary entrypoint
internal/clients/      → HTTP clients for SearXNG and Byparr
internal/config/       → Config loading and validation
internal/extractor/    → Content extraction and Markdown rendering
internal/mcp/          → JSON-RPC / MCP server and tool registry
internal/tools/        → Tool orchestration and response models
```

Each package has a single responsibility. The extractor doesn't know about MCP. The MCP server doesn't know about Byparr. The tools package orchestrates the pieces. Clean, testable, and easy to extend.

## How It Works

```
AI Assistant → MCP Request → better-search
    ↓
searxng_web_search() or web_fetch()
    ↓
Search → SearXNG → Results
Fetch → Byparr → HTML → Extract → Markdown
    ↓
Structured response → Back to AI
```

Same flow as before. Better execution.

## What I Learned

### 1. Rewrite when the architecture is wrong, not the code

The Crystal version worked. The code was clean. But the architecture didn't support structured responses, per-URL fetch options, or the evolving MCP spec. Patching would have taken longer than rewriting.

### 2. Go's net/html parser is underrated

I ported a Go extraction algorithm to Crystal for the first version. Then I rewrote the whole thing in Go and used the original parser directly. The DOM walking API is clean, the memory model is predictable, and the `golang.org/x/net/html` package handles edge cases I didn't even know existed.

### 3. Structured responses are the future of MCP

Plain-text-in-JSON works for demos. For production, the AI client needs to know exactly what it's getting. `structuredContent` with typed fields and `_meta` with schema versions — this is how MCP tools should be built going forward.

### 4. Config validation saves hours

The most common support question for the Crystal version was "search returns empty." The answer was always a misconfigured URL. Now the server won't start with invalid config. Problem eliminated at the root.

### 5. The standard library is the framework

No web framework. No router. No middleware chain. The MCP server reads JSON-RPC from stdin, dispatches to tools, writes responses to stdout. That's it. Go's concurrency primitives handle the rest. When your protocol is this simple, adding a framework just adds complexity.

## Configuration

```json
{
  "mcp": {
    "better-search": {
      "type": "local",
      "command": ["$HOME/go/bin/better-search"],
      "environment": {
        "SEARXNG_URL": "http://localhost:8888",
        "BYPARR_URL": "http://localhost:8191",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

Add to your OpenCode or Claude Code config. Restart. Your AI can now search and fetch — with structured responses.

## Try It

```bash
# Install
go install github.com/enrell/better-search@latest

# Run locally with debug logging
SEARXNG_URL=http://localhost:8888 \
BYPARR_URL=http://localhost:8191 \
LOG_LEVEL=DEBUG \
better-search
```

The [GitHub repo](https://github.com/enrell/better-search) is open. Issues and PRs welcome.

---

*What about you? Is there a tool you've rewritten because the architecture didn't match the problem anymore? Let me know in the comments.*

*Also, if you found this useful, share it with fellow developers. It helps more than you know.*

See you in the Wired.
