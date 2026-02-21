---
title: "Sharing some learnings about MCP and AST"
date: 2025-06-29
lastmod: 2025-06-29
draft: false
author: "enrell"
description: "I have been working on a MCP (Model Context Protocol) for a while now, and I have been learning a lot about typescript AST manipulation. I want to share some of my learnings with you."

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

First of all, I want to say that this is my first post in a long time, and I hope to keep writing more often. I have been working on a MCP (Model Context Protocol) for a while now, and I have been learning a lot about typescript AST manipulation. I want to share some of my learnings with you.

# What is a MCP (Model Context Protocol)?

MCP is an open protocol that allows you to standardize the way that applications provide context to their models.

What this means is that you can use the MCP to provide context (data) to LLMs, and the LLMs will be able to use this context to generate better responses.

Let's say that you ask the LLM "What is the weather?" and the LLM doesn't know the answer, because they can access real-time data. If you provide to LLM the current weather in Brazil, it will be able to generate a correct response right?

Well, that's what the MCP is all about. It allows you to provide context to the LLMs so that they can generate better responses.

You can use a variety of data sources to provide context to the LLMs, including databases, APIs, and even user input. The key is to make sure that the context is relevant and up-to-date so that the LLMs can generate the best possible responses.

For this example you can use a simple MCP server that receives a City name for example "Sao Paulo" and returns the current weather in that city.

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

With this MCP server, you can provide context to the LLMs by calling the `get_weather` method with a city and country name. The server will then return the current weather in that city.

# Example of a response

```json
{
  "city": "Sao Paulo",
  "temperature": 25.5,
  "description": "Sunny"
}
```

With this response, the LLM will be able to generate a better response to the question "What is the weather in Sao Paulo?" by using the context provided by the MCP server, that gets the current weather information from OpenWeatherMap API.

# AST (Abstract Syntax Tree)

AST (Abstract Syntax Tree) is a representation of the structure of source code. It is a tree-like data structure that represents the syntax of the code in a way that is easy to analyze and manipulate.

AST is used in many programming languages to represent the structure of the code, and it is a powerful tool for analyzing and manipulating code.

[Typescript AST viewer site](https://ts-ast-viewer.com/#code/GYVwdgxgLglg9mABACwKYBt1wBQEpEDeAUIqYgE6pQjlIQIDOc6qAdFgObYBEAEhlgA0iAO5xy6ACYBCbrgDcRAL5E0mHLiA)

![AST](/assets/ast/ast.png)

# Why i'm study MCP and AST?

Because I'm working on [ast-mcp](https://github.com/enrell/ast-mcp.git), a MCP for AST operations, providing a server for LLMs to interact with ASTs.

The project is still in its early stages, but I hope to make it a powerful tool for developers to analyze and manipulate code using a more efficient approach.

I hope you found this post useful, and I look forward to sharing more learnings with you in the future. If you have any questions or suggestions, feel free to reach out to me on [X](https://x.com/enrellsan) or [Discord](https://discord.com/users/enrell).

If you want to contribute to the project, feel free to open an issue on the [GitHub repository](https://github.com/enrell/ast-mcp).
