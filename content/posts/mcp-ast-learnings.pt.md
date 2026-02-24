---
title: "Compartilhando alguns aprendizados sobre MCP e AST"
date: 2025-06-29
lastmod: 2025-06-29
draft: false
author: "enrell"
description: "Trabalho há um tempo com MCP (Model Context Protocol) e aprendi muito sobre manipulação de AST em TypeScript. Quero compartilhar alguns dos meus aprendizados."

tags: ["mcp", "typescript", "ast", "open-source"]
categories: ["Programação", "Tutorial"]

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

# Olá, mundo!

Primeiramente, quero dizer que este é meu primeiro post em muito tempo, e espero escrever mais frequentemente. Trabalhei em um MCP (Model Context Protocol) por um tempo e aprendi muito sobre manipulação de AST em TypeScript. Quero compartilhar alguns dos meus aprendizados.

# O que é um MCP (Model Context Protocol)?

MCP é um protocolo aberto que permite padronizar a forma como aplicações fornecem contexto aos seus modelos.

O que isso significa é que você pode usar o MCP para fornecer contexto (dados) aos LLMs, e os LLMs poderão usar esse contexto para gerar melhores respostas.

Digamos que você pergunte ao LLM "Qual é o clima?" e o LLM não sabe a resposta porque não consegue acessar dados em tempo real. Se você fornecer ao LLM o clima atual no Brasil, ele poderá gerar uma resposta correta, não é?

Pois é, é disso que se trata o MCP. Ele permite que você forneça contexto aos LLMs para que possam gerar melhores respostas.

Você pode usar várias fontes de dados para fornecer contexto aos LLMs, incluindo bancos de dados, APIs e até entrada do usuário. A chave é garantir que o contexto seja relevante e atualizado para que os LLMs possam gerar as melhores respostas possíveis.

# Exemplo de resposta

```json
{
  "city": "Sao Paulo",
  "temperature": 25.5,
  "description": "Sunny"
}
```

Com essa resposta, o LLM poderá gerar uma melhor resposta para a pergunta "Qual é o clima em Sao Paulo?" usando o contexto fornecido pelo servidor MCP.

# AST (Abstract Syntax Tree)

AST (Abstract Syntax Tree) é uma representação da estrutura do código-fonte. É uma estrutura de dados em forma de árvore que representa a sintaxe do código de uma forma fácil de analisar e manipular.

O AST é usado em muitas linguagens de programação para representar a estrutura do código, e é uma ferramenta poderosa para analisar e manipular código.

[Typescript AST viewer site](https://ts-ast-viewer.com/#code/GYVwdgxgLglg9mABACwKYBt1wBQEpEDeAUIqYgE6pQjlIQIDOc6qAdFgObYBEAEhlgA0iAO5xy6ACYBCbrgDcRAL5E0mHLiA)

# Por que estou estudando MCP e AST?

Porque estou trabalhando no [ast-mcp](https://github.com/enrell/ast-mcp.git), um MCP para operações AST, fornecendo um servidor para LLMs interagirem com ASTs.

O projeto ainda está em seus estágios iniciais, mas espero torná-lo uma ferramenta poderosa para desenvolvedores analisarem e manipularem código usando uma abordagem mais eficiente.

Espero que você tenha achado este post útil, e estou ansioso para compartilhar mais aprendizados no futuro. Se tiver alguma dúvida ou sugestão, sinta-se à vontade para entrar em contato no [X](https://x.com/enrellsan) ou [Discord](https://discord.com/users/enrell).

Se quiser contribuir com o projeto, sinta-se à vontade para abrir uma issue no [repositório GitHub](https://github.com/enrell/ast-mcp).
