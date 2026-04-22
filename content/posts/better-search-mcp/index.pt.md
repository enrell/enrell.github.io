---
title: "Eu Reescrevi Meu MCP em Crystal para Go — E Ficou Melhor: Better Search MCP"
date: 2026-04-21
lastmod: 2026-04-21
draft: false
author: "enrell"
description: "Eu já tinha construído um MCP em Crystal para busca web e extração de conteúdo. Então reescrevi em Go com extração mais inteligente, respostas estruturadas e batch fetching. Aqui está o porquê — e o que mudou."

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

![Better Search MCP no Claude Code](/images/screenshot-2026-04-22_19-22-33.png)

Se você leu meu último post, sabe que eu construí o searxng-web-fetch-mcp — um servidor MCP em Crystal que dá a assistentes de IA busca na web e fetching de conteúdo. Funcionou. Foi rápido. Eu shippinguei em uma noite.

Mas depois de algumas semanas de uso diário, as coisas começaram a me incomodar.

A extração era boa, mas não ótima. Alguns artigos voltavam com lixo de navegação. Outros tinham o conteúdo principal enterrado sob texto de sidebar. E o batch fetch, embora rápido, não me dava o controle que eu queria sobre o que voltava e como.

Eu ficava remendando. Então percebi: eu não estava remendando um bug. Eu estava remendando uma arquitetura.

## O Problema, Revisitado

Aqui está o que continuava me incomodando:

- **Qualidade de extração** — A versão em Crystal usava uma heurística portada do go-trafilatura. Funcionava para a maioria dos artigos, mas o scoring não era agressivo o suficiente. Sidebars com texto longo ainda passavam despercebidas.
- **Estrutura de resposta** — O original retornava strings JSON puras. A IA tinha que parsear texto dentro de texto. Sem conteúdo estruturado. Sem schema de metadata. Sem jeito do cliente saber o que era título e o que era corpo do texto.
- **Controle de batch** — Batch fetch era tudo-ou-nada. Sem timeouts por URL. Sem limites de truncamento. Sem jeito de dizer "busca essas 10 URLs mas só me dê 4000 caracteres cada."
- **A história das dependências** — Crystal é bonito, mas o ecossistema é pequeno. Toda vez que eu precisava de um novo feature de parsing HTML, eu estava escrevendo do zero ou portando de outra linguagem.

E o maior: **o protocolo MCP estava evoluindo**. Conteúdo estruturado, campos `_meta`, versionamento de schema — a spec estava caminhando para response shapes mais ricas. Meu código em Crystal não foi construído para isso.

Então fiz o que qualquer desenvolvedor razoável faz às 11 da noite com um projeto funcionando: reescrevi.

## Por Que Go

Eu já uso Go para o navi-agent. Eu já penso em Go quando alcanço concorrência. E a standard library do Go — especificamente `golang.org/x/net/html` — te dá um parser HTML de produção grade direto da caixa. Sem porting. Sem FFI. Sem prece.

Três razões, igual da última vez mas diferentes:

1. **Ecossistema** — O parser net/html do Go, suas primitivas de concorrência, seu framework de testes. Tudo incluído.
2. **Respostas estruturadas** — O sistema de tipos do Go torna trivial definir response shapes exatas com JSON tags. Sem ginástica de tipos em runtime.
3. **Binário único** — `go install` e pronto. Mesma história de deployment que Crystal, mas com uma standard library mais profunda atrás.

## Conheça o Better Search MCP

**Better Search MCP** é a reescrita em Go que faz tudo que a versão em Crystal fazia — e faz melhor. Mesmas duas ferramentas: busca e fetch. Mesma stack SearXNG + Byparr. Mas a extração é mais inteligente, as respostas são estruturadas, e o batch fetching tem controle real.

```bash
go install github.com/enrell/better-search@latest
```

Um comando. Binário cai em `$HOME/go/bin/better-search`. Pronto.

## O Que Mudou

### Extração de Conteúdo Mais Inteligente

O extrator em Go usa um algoritmo de scoring diferente. Em vez de só checar nomes de classe, ele caminha o DOM e pontua cada nó candidato baseado em:

1. **Densidade de texto** — Quanto texto real vs. tags HTML
2. **Densidade de links** — Razão link-para-texto alta? Provavelmente navegação, não conteúdo
3. **Padrões de boost** — Nomes de classe e IDs como "content", "article", "post", "entry", "main"
4. **Padrões de penalidade** — Nomes de classe como "comment", "sidebar", "footer", "widget", "ad", "social"
5. **Preferência de tag** — `<article>`, `<main>`, `<section>` recebem boosts naturais sobre sopa de `<div>` genérico

O resultado: extrações mais limpas em sites bagunçados. O tipo de site que tem três sidebars, um banner de cookies, um popup de newsletter e um parágrafo de conteúdo real.

### Respostas com Conteúdo Estruturado

Essa é a grande. Toda resposta de ferramenta agora inclui `structuredContent` junto com o campo `content` legado:

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

O cliente de IA não precisa parsear JSON de uma string dentro de uma string. Ele recebe um objeto real com campos reais. Título é título. Autor é autor. Data é data. Sem achismo.

Erros são estruturados também:

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

Sem mais parsear mensagens de erro de texto freeform. O cliente sempre sabe o que aconteceu.

### Batch Fetch Com Controle Real

A versão em Crystal tinha batch fetching. A versão em Go tem batch fetching *configurável*:

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

Todo parâmetro que você quereria:

| Parâmetro | Propósito | Padrão |
|-----------|-----------|--------|
| `url` | Fetch de URL única | — |
| `urls` | Batch fetch (até 25) | — |
| `include_metadata` | Título, autor, data, idioma | `true` |
| `timeout_seconds` | Timeout por request (1-120) | `30` |
| `max_content_chars` | Truncar output | Sem limite |
| `preserve_links` | Manter links Markdown | `true` |
| `raw_html` | Incluir HTML extraído | `false` |
| `prefer_readable_text` | Foco em artigo vs. página completa | `true` |
| `fail_fast` | Parar batch no primeiro erro | `false` |

URLs em batch preservam ordem. URLs duplicadas são mantidas. O array de resultados tem a mesma cardinalidade que a entrada. Sem surpresas.

### Concorrência Que Escala

O batch fetch usa um padrão de semáforo — canais do Go agindo como semáforo contador:

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

Mesma ideia que as fibers do Crystal, mas goroutines do Go são igualmente leves e o padrão é mais explícito. A env var `MAX_CONCURRENT_REQUESTS` (padrão: 30) controla o teto.

### Validação de Config na Inicialização

Configuração inválida falha rápido. Se `SEARXNG_URL` ou `BYPARR_URL` não é uma URL HTTP/HTTPS válida com um host, o servidor se recusa a iniciar:

```
configuration error: SEARXNG_URL must be a valid http or https URL with a host
```

Sem misconfiguração silenciosa. Sem sessões de debug de "por que a busca retorna resultados vazios?" às 2 da manhã.

### Logging de Requests

Cada request é logada com atributos estruturados:

```json
{"level":"DEBUG","msg":"completed request","request_id":"req-000001","method":"tools/call","elapsed_ms":342}
```

Set `LOG_LEVEL=DEBUG` para ver tudo. Set `LOG_LEVEL=ERROR` para silêncio. Produção fica limpa. Desenvolvimento fica observável.

## A Stack

| Componente | Tecnologia | Por Quê |
|------------|-----------|---------|
| Linguagem | Go 1.23+ | Parser HTML da stdlib, goroutines, binário único |
| Parsing HTML | golang.org/x/net/html | DOM walking de produção grade |
| Scoring de Conteúdo | Motor heurístico custom | Boost/penalidade por pattern matching |
| Rendering Markdown | Conversor DOM-based | Preserva estrutura, não só texto |
| Protocolo MCP | JSON-RPC sobre stdio | Padrão, sem overhead de HTTP |
| Clientes HTTP | Clientes SearXNG + Byparr | Separação limpa, testável |

## Stats de Código

```
2146 linhas de Go em todo o projeto.
```

Isso é um MCP server completo com busca, batch fetch, extração de conteúdo, rendering Markdown, respostas estruturadas, validação de config e logging de requests. Em 2146 linhas.

A standard library do Go faz boa parte do trabalho pesado. Sem framework. Sem ORM. Sem mágica.

## A Arquitetura

```
cmd/server/            → Entrypoint do binário
internal/clients/      → Clientes HTTP para SearXNG e Byparr
internal/config/       → Carregamento e validação de config
internal/extractor/    → Extração de conteúdo e rendering Markdown
internal/mcp/          → Servidor JSON-RPC / MCP e registro de tools
internal/tools/        → Orquestração de tools e modelos de resposta
```

Cada package tem uma única responsabilidade. O extrator não sabe sobre MCP. O servidor MCP não sabe sobre Byparr. O package tools orquestra as peças. Limpo, testável e fácil de extender.

## Como Funciona

```
Assistente de IA → Request MCP → better-search
    ↓
searxng_web_search() ou web_fetch()
    ↓
Busca → SearXNG → Resultados
Fetch → Byparr → HTML → Extrair → Markdown
    ↓
Resposta estruturada → De volta para a IA
```

Mesmo fluxo de antes. Execução melhor.

## O Que Eu Aprendi

### 1. Reescreva quando a arquitetura está errada, não o código

A versão em Crystal funcionava. O código era limpo. Mas a arquitetura não suportava respostas estruturadas, opções de fetch por URL, ou a spec MCP em evolução. Remendar teria levado mais tempo que reescrever.

### 2. O parser net/html do Go é subestimado

Eu portei um algoritmo de extração de Go para Crystal para a primeira versão. Então reescrevi tudo em Go e usei o parser original diretamente. A API de DOM walking é limpa, o modelo de memória é previsível, e o package `golang.org/x/net/html` lida com edge cases que eu nem sabia que existiam.

### 3. Respostas estruturadas são o futuro do MCP

Texto-puro-em-JSON funciona para demos. Para produção, o cliente de IA precisa saber exatamente o que está recebendo. `structuredContent` com campos tipados e `_meta` com versões de schema — é assim que ferramentas MCP devem ser construídas daqui para frente.

### 4. Validação de config economiza horas

A pergunta de suporte mais comum para a versão em Crystal era "busca retorna vazio." A resposta era sempre uma URL mal configurada. Agora o servidor não inicia com config inválida. Problema eliminado na raiz.

### 5. A standard library é o framework

Sem framework web. Sem router. Sem chain de middleware. O servidor MCP lê JSON-RPC do stdin, despacha para tools, escreve respostas no stdout. É isso. As primitivas de concorrência do Go cuidam do resto. Quando seu protocolo é simples assim, adicionar um framework só adiciona complexidade.

## Configuração

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

Adicione na sua config do OpenCode ou Claude Code. Reinicie. Sua IA agora pode buscar e fetchar — com respostas estruturadas.

## Experimente

```bash
# Instalar
go install github.com/enrell/better-search@latest

# Rodar localmente com logging de debug
SEARXNG_URL=http://localhost:8888 \
BYPARR_URL=http://localhost:8191 \
LOG_LEVEL=DEBUG \
better-search
```

O [repositório no GitHub](https://github.com/enrell/better-search) está aberto. Issues e PRs são bem-vindos.

---

*E você? Tem alguma ferramenta que você reescreveu porque a arquitetura não correspondia mais ao problema? Me conta nos comentários.*

*Se achou útil, compartilha com outros desenvolvedores. Ajuda mais do que você imagina.*

See you in the Wired.
