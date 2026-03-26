---
title: "Construindo um MCP em Crystal para Busca na Web e Extração de Conteúdo"
date: 2026-03-25
lastmod: 2026-03-25
draft: false
author: "enrell"
description: "Eu precisava de busca na web e extração de conteúdo para o meu setup local de LLM. Então eu construí isso em Crystal. Veja como o searxng-web-fetch-mcp ganhou vida." 

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

Eram 19h de uma quarta-feira. Eu estava olhando para o meu terminal, vendo o OpenCode tentar responder a uma pergunta sobre uma biblioteca que ele nunca tinha visto antes.

O LLM estava fazendo o seu melhor. Mas estava alucinando *endpoints* de API que não existiam.

E eu pensei: *"Por que minha IA não pode simplesmente... pesquisar na web?"*

## O Problema

Eu uso o OpenCode, o Claude Code e às vezes o Crush como meus companheiros diários de programação. É poderoso. Mas tem um ponto cego: a busca nativa na web não consegue acessar sites protegidos pela Cloudflare.

Isso significa:
- Muitas falhas e tokens desperdiçados.
- Sites com alta proteção anti-bot? Inacessíveis.
- Notícias atuais de grandes fontes? Desconhecidas.

Eu precisava de algo que permitisse ao meu LLM pesquisar na web e buscar conteúdo sob demanda. Algo leve. Algo que eu controlasse.

## A Ideia [searxng-web-fetch-mcp](https://github.com/enrell/searxng-web-fetch-mcp)

Eu queria um servidor MCP (Model Context Protocol) que fizesse duas coisas:

1. **Buscar na web** — Usando minha instância local do SearXNG
2. **Buscar conteúdo** — Extrair texto limpo de qualquer URL

É isso. Sem *bloat* (inchaço). Sem *vendor lock-in*. Apenas busca e extração.

## Por que Crystal?

Eu escolhi [Crystal](https://crystal-lang.org/) por três motivos:

1. **Velocidade** — Crystal compila para código nativo. Rápido. Extremamente rápido.
2. **Ergonomia** — Sintaxe semelhante a Ruby, que é linda de ler e escrever. Você pode construir um aplicativo completo em apenas algumas linhas de código.
3. **Manutenibilidade** — A tipagem forte captura bugs em tempo de compilação. A base de código permanece limpa e fácil de manter.

Um binário de 12MB que inicia em milissegundos? Esse é o ponto forte do Crystal.

**Curiosidade:** Comecei este projeto no dia 25 de março às 19h. À meia-noite, o núcleo estava funcionando. É assim que é rápido desenvolver em Crystal.

## A Stack

| Componente | Propósito |
|-----------|---------|
| Crystal | Servidor principal, desempenho |
| Lexbor | Parsing de HTML |
| MCP Protocol | Integração com assistente de IA |
| SearXNG | Busca descentralizada |
| Byparr | Proxy anti-captcha para extração |

## Estatísticas do Código

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Language            Files        Lines         Code     Comments        Blanks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Crystal                 9          815          689            6           120
 Shell                   4          414          348            4            62
 YAML                    1           26           20            0             6
─────────────────────────────────────────────────────────────────────────────────
 Markdown                2          241            0          160            81
 |- BASH                 2           36           16           11             9
 |- Crystal              1           13           10            2             1
 |- Dockerfile           1           18           17            0             1
 |- JSON                 1           30           30            0             0
 |- YAML                 1           82           72            0            10
 (Total)                            420          145          173           102
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Total                  16         1675         1202          183           290
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

689 linhas de Crystal. Nada mal para um servidor MCP completo, com extração de conteúdo e busca em lote (*Batch Fetching*).

## Como Funciona

Aqui está o fluxo básico:

```
LLM → MCP → searxng-web-fetch-mcp
                ↓
        searxng_web_search()
                ↓
        web_fetch()
                ↓
        Markdown Limpo → De volta ao LLM
```

Simples. Elegante. Rápido.

### Ferramenta 1: searxng_web_search

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

### Ferramenta 2: web_fetch

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

## O Algoritmo de Extração

A parte mais difícil foi a extração de conteúdo. Sites são uma bagunça. Barras laterais, anúncios, menus de navegação — tudo ruído.

Eu portei a lógica principal do [go-trafilatura](https://github.com/go-eeus/trafilatura), que usa heurísticas inteligentes:

1. **Remover ruído** — Scripts, estilos, navegação, rodapé, anúncios
2. **Pontuar elementos** — Com base na densidade de texto, densidade de links
3. **Impulsionar padrões** — Nomes de classes como "content", "article", "main"
4. **Penalizar padrões** — Nomes de classes como "comment", "sidebar", "footer"
5. **Extrair metadados** — Título, autor, data, idioma das meta tags

Funciona surpreendentemente bem para a maioria dos artigos.

## Suporte Multiplataforma

Porque não? O script de instalação detecta sua plataforma automaticamente:

```bash
curl -sL [https://raw.githubusercontent.com/enrell/searxng-web-fetch-mcp/main/install.sh](https://raw.githubusercontent.com/enrell/searxng-web-fetch-mcp/main/install.sh) | bash
```

Plataformas suportadas:
- Linux: x86_64, arm64, riscv64
- macOS: x86_64, arm64 (Apple Silicon)
- Windows: x86_64

Um comando. O binário cai em `~/.local/bin`. Feito.

## Configuração

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

Adicione à sua configuração do OpenCode. Reinicie. A IA agora pode pesquisar e extrair.

## O Que Aprendi

Este projeto me ensinou várias coisas:

### 1. Variáveis de ambiente são complicadas

O `ENV.fetch` do Crystal é avaliado em tempo de compilação. Passar variáveis de ambiente para processos filhos? Surpreendentemente cheio de nuances. Passei horas depurando por que o npx não estava recebendo minhas variáveis.

### 2. Fazer linting cedo economiza tempo

Rodar o Ameba (linter do Crystal) em cada commit pegou 14 problemas de uma vez só. Nomes de parâmetros de bloco, espaços em branco no final, formatação — tudo corrigido antes que se tornassem problemas.

### 3. Lançamentos multiplataforma são essenciais

Usuários em diferentes sistemas operacionais e arquiteturas precisam de binários pré-compilados. GitHub Actions + linkagem estática do Crystal = mágica.

### 4. Mantenha as coisas mínimas

Duas ferramentas. Sem banco de dados. Sem autenticação. Sem complexidade. Apenas busca e extração. É por isso que funciona.

## Exemplo no Mundo Real

Depois de construir isso, pedi ao OpenCode para pesquisar sobre uma biblioteca:

```
> Pesquise a documentação mais recente do "crystal-pg"
> Busque o README do repositório no GitHub
> Mostre-me como me conectar ao PostgreSQL
```

E ele fez. Porque tinha informações reais. Não palpites alucinados.

## O Que Vem a Seguir

- 🤖 **Melhor extração de conteúdo** — Lidar com mais formatos de sites
- 📊 **Cache de respostas** — Armazenar resultados de busca/extração em cache para consultas repetidas
- 🔍 **Agregação de motores de busca** — Suportar mais motores de busca
- 📦 **Docker compose** — Implantação de todos os serviços em um clique

---

## Atualização: Suporte a Concorrência (v0.2.1)

Acabei de lançar a v0.2.1 com concorrência baseada em *fibers*! O protocolo MCP processa requisições sequencialmente, mas adicionei a busca em lote de URLs (*batch fetching*), que processa múltiplas URLs em paralelo dentro de uma única requisição.

### Como Funciona

O `spawn` do Crystal cria *fibers* leves. Combinado com um canal de semáforo, isso limita as operações concorrentes de E/S (I/O):

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

### Desempenho

| Modo | Taxa de Transferência (Throughput) |
|------|-----------|
| Busca sequencial | ~2 req/s |
| Lote concorrente (10 URLs) | **33 URLs/s** |
| Lote concorrente (30 URLs) | **25 URLs/s** |

Isso é ~10-15x mais rápido que o processamento sequencial!

### Uso

```json
{
  "urls": [
    "[https://example.com/article1](https://example.com/article1)",
    "[https://example.com/article2](https://example.com/article2)",
    "[https://example.com/article3](https://example.com/article3)"
  ]
}
```

Configure o limite de concorrência com `MAX_CONCURRENT_REQUESTS` (padrão: 30).

A principal sacada: os *fibers* do Crystal são leves (KB cada) em comparação com as *threads* do SO (MB cada), tornando-os perfeitos para cargas de trabalho limitadas por E/S (*I/O-bound*), como requisições HTTP.

## Experimente

```bash
# Instalar
curl -sL [https://raw.githubusercontent.com/enrell/searxng-web-fetch-mcp/main/install.sh](https://raw.githubusercontent.com/enrell/searxng-web-fetch-mcp/main/install.sh) | bash

# Configurar (adicione à sua configuração do MCP)
# Em seguida, use com OpenCode, Claude Code ou qualquer cliente compatível com MCP
```

O [repositório no GitHub](https://github.com/enrell/searxng-web-fetch-mcp) está aberto. Issues e PRs são bem-vindos.

---

*E você? Existe alguma capacidade que está faltando no seu assistente de IA? Deixe-me saber nos comentários.*

> *Nos vemos na Wired*
