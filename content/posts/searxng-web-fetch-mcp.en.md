---
title: "Building a Crystal MCP for Web Search and Content Extraction"
date: 2026-03-25
lastmod: 2026-03-25
draft: false
author: "enrell"
description: "I needed web search and content extraction for my local LLM setup. So I built it in Crystal. Here's how searxng-web-fetch-mcp came to life."

tags: ["mcp", "crystal", "search", "searxng", "open-source"]
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

It was 7pm on a Wednesday. I was staring at my terminal, watching OpenCode try to answer a question about a library it had never seen before.

The LLM was doing its best. But it was hallucinating API endpoints that didn't exist.

And I thought: *"Why can't my AI just... search the web?"*

## The Problem

I use OpenCode, Claude Code and some times Crush as my daily coding companion. It's powerful. But it has a blind spot: The native web fetch can't access claudflare protected sites.

That means:
- A lot of fails and wasted tokens.
- High anti-bot protected site? Inaccessible.
- Current news from big sources? Unknown.

I needed something that lets my LLM search the web and fetch content on demand. Something lightweight. Something I control.

## The Idea [searxng-web-fetch-mcp](https://github.com/enrell/searxng-web-fetch-mcp)

I wanted an MCP (Model Context Protocol) server that does two things:

1. **Search the web** — Using my local SearXNG instance
2. **Fetch content** — Extract clean text from any URL

That's it. No bloat. No vendor lock-in. Just search and fetch.

## Why Crystal?

I chose [Crystal](https://crystal-lang.org/) for three reasons:

1. **Speed** — Crystal compiles to native code. Fast. Blazing fast.
2. **Ergonomics** — Ruby-like syntax that's beautiful to read and write. You can build a full app in just a few lines of code.
3. **Maintainability** — Strong typing catches bugs at compile time. The code base stays clean and easy to maintain.

A 12MB binary that starts in milliseconds? That's Crystal's sweet spot.

**Fun fact:** I started this project on March 25 at 7 PM. By midnight, the core was working. That's how fast Crystal is to develop with.

## The Stack

| Component | Purpose |
|-----------|---------|
| Crystal | Core server, performance |
| Lexbor | HTML parsing |
| MCP Protocol | AI assistant integration |
| SearXNG | Decentralized search |
| Byparr | Anti-captcha proxy for fetching |

## Code Stats

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Language              Files        Lines         Code     Comments       Blanks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Crystal                   9          815          689            6          120
 Shell                     4          414          348            4           62
 YAML                      1           26           20            0            6
─────────────────────────────────────────────────────────────────────────────────
 Markdown                  2          241            0          160           81
 |- BASH                   2           36           16           11            9
 |- Crystal                1           13           10            2            1
 |- Dockerfile             1           18           17            0            1
 |- JSON                   1           30           30            0            0
 |- YAML                   1           82           72            0           10
 (Total)                              420          145          173          102
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Total                    16         1675         1202          183          290
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

689 lines of Crystal. Not bad for a full MCP server, with content extraction and Batch Fetching.

## How It Works

Here's the basic flow:

```
LLM → MCP → searxng-web-fetch-mcp
                ↓
        searxng_web_search()
                ↓
        web_fetch()
                ↓
        Clean Markdown → Back to LLM
```

Simple. Elegant. Fast.

### Tool 1: searxng_web_search

```crystal
class SearxngWebSearch < MCP::AbstractTool
  @@tool_name = "searxng_web_search"
  @@tool_description = "Search the web using SearXNG"
  
  def invoke(params)
    query = params["query"].as_s
    num_results = params["num_results"]?.try(&.as_i) || 10
    
    # Call SearXNG API
    response = HTTP::Client.get("#{SEARXNG_URL}/search", 
      headers: HTTP::Headers{"Accept" => "application/json"},
      query: URI::Params.encode({"q" => query, "format" => "json"})
    )
    
    parse_results(response.body)
  end
end
```

### Tool 2: web_fetch

```crystal
class WebFetch < MCP::AbstractTool
  @@tool_name = "web_fetch"
  @@tool_description = "Fetch and extract content from a URL"
  
  def invoke(params)
    url = params["url"].as_s
    
    # Fetch through anti-captcha proxy
    html = HTTP::Client.get(url)
    
    # Extract main content
    extractor = TrafilaturaExtractor.new
    result = extractor.extract(html.body)
    
    # Convert to clean Markdown
    markdown = HtmlToMarkdown.convert(result.content)
    
    { success: true, text: markdown, metadata: result.metadata }
  end
end
```

## The Extraction Algorithm

The hardest part was content extraction. Websites are messy. Sidebars, ads, navigation menus — all noise.

I ported the core logic from [go-trafilatura](https://github.com/go-eeus/trafilatura), which uses smart heuristics:

1. **Remove noise** — Scripts, styles, nav, footer, ads
2. **Score elements** — Based on text density, link density
3. **Boost patterns** — Class names like "content", "article", "main"
4. **Penalty patterns** — Class names like "comment", "sidebar", "footer"
5. **Extract metadata** — Title, author, date, language from meta tags

It works surprisingly well for most articles.

## Multi-Platform Support

Because why not? The install script detects your platform automatically:

```bash
curl -sL https://raw.githubusercontent.com/enrell/searxng-web-fetch-mcp/main/install.sh | bash
```

Supported platforms:
- Linux: x86_64, arm64, riscv64
- macOS: x86_64, arm64 (Apple Silicon)
- Windows: x86_64

One command. Binary lands in `~/.local/bin`. Done.

## Configuration

```json
{
  "mcp": {
    "searxng-web": {
      "type": "local",
      "command": ["~/.local/bin/searxng-web-fetch-mcp"],
      "environment": {
        "SEARXNG_URL": "http://localhost:8888",
        "BYPARR_URL": "http://localhost:8191"
      }
    }
  }
}
```

Add to your OpenCode config. Restart. The AI can now search and fetch.

## What I Learned

This project taught me several things:

### 1. Environment variables are tricky

Crystal's `ENV.fetch` evaluates at compile time. Passing env vars to child processes? Surprisingly nuanced. I spent hours debugging why npx wasn't receiving my variables.

### 2. Linting early saves time

Running Ameba (Crystal's linter) on every commit caught 14 issues in one go. Block parameter names, trailing whitespace, formatting — all fixed before they became problems.

### 3. Multi-platform releases are a must

Users on different OSes and architectures need pre-built binaries. GitHub Actions + Crystal's static linking = magic.

### 4. Keep it minimal

Two tools. No database. No auth. No complexity. Just search and fetch. That's why it works.

## Real World Example

After building this, I asked OpenCode to research a library:

```
> Search for the latest "crystal-pg" documentation
> Fetch the README from the GitHub repo
> Show me how to connect to PostgreSQL
```

And it did. Because it had real information. Not hallucinated guesses.

## What's Next

- 🤖 **Better content extraction** — Handle more website formats
- 📊 **Response caching** — Cache search/fetch results for repeated queries
- 🔍 **Search engine aggregation** — Support more search engines
- 📦 **Docker compose** — One-click deployment of all services

---

## Update: Concurrency Support (v0.2.1)

I just released v0.2.1 with fiber-based concurrency! The MCP protocol processes requests sequentially, but I added batch URL fetching that processes multiple URLs in parallel within a single request.

### How It Works

Crystal's `spawn` creates lightweight fibers. Combined with a semaphore channel, this limits concurrent I/O operations:

```crystal
module Utils
  module ConcurrentHTTP
    def self.run_parallel(max_concurrent : Int32, tasks : Array(Proc(T))) : Array(T) forall T
      semaphore = Channel(Nil).new(max_concurrent)
      channels = Array(Channel(T | Exception)).new(tasks.size)

      tasks.each do |task|
        channel = Channel(T | Exception).new
        spawn do
          semaphore.send(nil)
          begin
            result = task.call
            channel.send(result)
          rescue ex
            channel.send(ex)
          ensure
            semaphore.receive
          end
        end
      end
      # Collect results...
    end
  end
end
```

### Performance

| Mode | Throughput |
|------|-----------|
| Sequential search | ~2 req/s |
| Batch concurrent (10 URLs) | **33 URLs/s** |
| Batch concurrent (30 URLs) | **25 URLs/s** |

That's ~10-15x faster than sequential processing!

### Usage

```json
{
  "urls": [
    "https://example.com/article1",
    "https://example.com/article2",
    "https://example.com/article3"
  ]
}
```

Configure the concurrency limit with `MAX_CONCURRENT_REQUESTS` (default: 30).

The key insight: Crystal fibers are lightweight (KB each) vs OS threads (MB each), making them perfect for I/O-bound workloads like HTTP requests.

## Try It

```bash
# Install
curl -sL https://raw.githubusercontent.com/enrell/searxng-web-fetch-mcp/main/install.sh | bash

# Configure (add to your MCP config)
# Then use with OpenCode, Claude Code, or any MCP-compatible client
```

The [GitHub repo](https://github.com/enrell/searxng-web-fetch-mcp) is open. Issues and PRs welcome.

---

*What about you? Is there a capability your AI assistant is missing? Let me know in the comments.*

> *See you in the Wired*
