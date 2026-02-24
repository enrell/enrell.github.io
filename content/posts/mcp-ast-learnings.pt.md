---
title: "Compartilhando alguns aprendizados sobre MCP e AST"
date: 2025-06-29
lastmod: 2025-06-29
draft: false
author: "enrell"
description: "Estou trabalhando em um MCP (Model Context Protocol) há algum tempo e tenho aprendido muito sobre manipulação de AST no TypeScript. Quero compartilhar alguns dos meus aprendizados com vocês."

tags: ["mcp", "typescript", "ast", "open-source"]
categories: ["Programming", "Tutorial"]

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

# Hello, world!

Primeiramente, quero dizer que este é o meu primeiro post em muito tempo, e espero continuar escrevendo com mais frequência. Tenho trabalhado em um MCP (Model Context Protocol) há algum tempo e tenho aprendido muito sobre a manipulação de AST no TypeScript. Quero compartilhar um pouco dos meus aprendizados com vocês.

# O que é um MCP (Model Context Protocol)?

O MCP é um protocolo aberto que permite padronizar a forma como as aplicações fornecem contexto aos seus modelos.

Isso significa que você pode usar o MCP para fornecer contexto (dados) aos LLMs, e os LLMs poderão usar esse contexto para gerar respostas melhores.

Digamos que você pergunte ao LLM "Como está o clima?" e o LLM não saiba a resposta, porque ele não tem acesso a dados em tempo real. Se você fornecer ao LLM o clima atual no Brasil, ele será capaz de gerar uma resposta correta, certo?

Bom, é exatamente disso que se trata o MCP. Ele permite que você forneça contexto aos LLMs para que eles possam gerar respostas melhores.

Você pode usar uma variedade de fontes de dados para fornecer contexto aos LLMs, incluindo bancos de dados, APIs e até inputs do usuário. A chave é garantir que o contexto seja relevante e atualizado para que os LLMs possam gerar as melhores respostas possíveis.

Para este exemplo, você pode usar um servidor MCP simples que recebe o nome de uma cidade, por exemplo "São Paulo", e retorna o clima atual nessa cidade.

```python
from mcp.server.fastmcp.server import FastMCP
import requests
mcp = FastMCP()
@mcp.tool()
def get_weather(city: str, state: str, country: str) -> dict:
    """
    Get the current weather for a given city, state, and country using OpenWeatherMap API.
    """
    API_KEY = "YOUR_API_KEY"
    # Step 1: Get latitude and longitude
    geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={city},{state},{country}&limit=1&appid={API_KEY}"
    geo_resp = requests.get(geo_url)
    geo_data = geo_resp.json()
    if not geo_data:
        return {"error": "Location not found"}
    lat = geo_data[0]["lat"]
    lon = geo_data[0]["lon"]
    # Step 2: Get weather data
    weather_url = f"https://api.openweathermap.org/data/3.0/onecall?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
    weather_resp = requests.get(weather_url)
    weather_data = weather_resp.json()
    if "current" not in weather_data:
        return {"error": "Weather data not found"}
    return {
        "city": city,
        "temperature": weather_data["current"]["temp"],
        "description": weather_data["current"]["weather"][0]["description"].capitalize()
    }
```

Com este servidor MCP, você pode fornecer contexto aos LLMs chamando o método `get_weather` com o nome da cidade e do país. O servidor então retornará o clima atual nessa cidade.

# Exemplo de uma resposta

```json
{
  "city": "Sao Paulo",
  "temperature": 25.5,
  "description": "Sunny"
}
```

Com essa resposta, o LLM será capaz de gerar uma resposta melhor para a pergunta "Como está o clima em São Paulo?" usando o contexto fornecido pelo servidor MCP, que obtém as informações climáticas atuais da API do OpenWeatherMap.

# AST (Abstract Syntax Tree)

AST (Abstract Syntax Tree - Árvore Sintática Abstrata) é uma representação da estrutura do código-fonte. É uma estrutura de dados em formato de árvore que representa a sintaxe do código de uma forma que seja fácil de analisar e manipular.

O AST é usado em muitas linguagens de programação para representar a estrutura do código e é uma ferramenta poderosa para analisar e manipular código.

[Site do Typescript AST viewer](https://ts-ast-viewer.com/#code/GYVwdgxgLglg9mABACwKYBt1wBQEpEDeAUIqYgE6pQjlIQIDOc6qAdFgObYBEAEhlgA0iAO5xy6ACYBCbrgDcRAL5E0mHLiA)

# Por que estou estudando MCP e AST?

Porque estou trabalhando no [ast-mcp](https://github.com/enrell/ast-mcp.git), um MCP para operações em AST, que fornece um servidor para que os LLMs interajam com ASTs.

O projeto ainda está em seus estágios iniciais, mas espero torná-lo uma ferramenta poderosa para que desenvolvedores possam analisar e manipular código usando uma abordagem mais eficiente.

Espero que você tenha achado este post útil e mal posso esperar para compartilhar mais aprendizados com vocês no futuro. Se você tiver alguma dúvida ou sugestão, sinta-se à vontade para me chamar no [X](https://x.com/enrellsan) ou no [Discord](https://discord.com/users/enrell).

Se quiser contribuir com o projeto, fique à vontade para abrir uma issue no [repositório do GitHub](https://github.com/enrell/ast-mcp).
