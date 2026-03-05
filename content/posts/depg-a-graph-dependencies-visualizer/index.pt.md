---
date: '2026-03-05'
lastmod: '2026-03-05'
author: 'enrell'
tags: ['cli', 'rust', 'depg']
categories: ['rust', 'depg']
draft: false
title: "Estamos Voando às Cegas: Por Que Construí um Visualizador de Grafo de Dependências em Rust"
description: 'Eu criei uma CLI para visualizar um grafo de dependências para repositórios de código.'
---

Recentemente, eu assisti a um vídeo do Veritasium chamado "The Internet Was Weeks Away From Disaster and No One Knew" (A Internet Estava a Semanas do Desastre e Ninguém Sabia). Ele mergulha fundo na história do backdoor do XZ Utils — uma campanha de engenharia social altamente sofisticada e de vários anos que quase comprometeu o OpenSSH e todo o ecossistema de código aberto. Um ator malicioso passou anos ganhando confiança, lentamente introduzindo commits maliciosos em uma biblioteca de compressão profunda da qual todo o resto depende.

Enquanto assistia a esse vídeo, a ideia para este projeto me veio à mente. Estivemos a centímetros de uma catástrofe global, e isso me fez pensar.

Quantos de nós realmente sabemos o que estamos executando? Nós rodamos `npm install`, `cargo build` ou `bun install`, e vemos o terminal acender com centenas de pacotes sendo baixados. Tratamos o `node_modules` ou as pastas de build como uma caixa-preta. É como plugar seu cérebro diretamente na Wired sem verificar se a conexão está comprometida. Se uma dependência central for sequestrada, somos todos alvos fáceis.

Eu odeio voar às cegas. Quando trabalho em um projeto, quero ver o sistema nervoso. Quero olhar para o grafo de dependências e ver onde estão os elos fracos, de onde vem o inchaço e o que exatamente estou convidando para minha máquina.

Então, eu construí algo para consertar isso.

### Entra o `depg` (Dependency Graph)

Eu queria uma maneira localizada e incrivelmente rápida de visualizar exatamente do que o meu projeto depende. Nada de fazer upload do meu Cargo.lock para um serviço web de terceiros duvidoso. Apenas uma ferramenta CLI limpa e instantânea que roda localmente e mapeia toda a árvore de dependências em um grafo interativo.

Eu a construí em Rust (Edition 2024), naturalmente, porque se estamos construindo ferramentas de CLI, queremos que elas sejam rápidas, seguras de memória e consigam lidar com concorrência sem esforço.

### Código Fonte & Instalação

O código fonte está disponível em: [https://github.com/enrell/dependencies-graph](https://github.com/enrell/dependencies-graph)

**macOS / Linux:**
```sh
curl -fsSL https://raw.githubusercontent.com/enrell/dependencies-graph/main/install.sh | sh
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/enrell/dependencies-graph/main/install.ps1 | iex
```

**Cargo:**
```sh
cargo install --git https://github.com/enrell/dependencies-graph.git
```

### Uso

```sh
depg run
depg run --depth 2 --port 8080 --open
```

### Como Funciona

- O `depg` procura no diretório atual por arquivos de lock conhecidos.
- Ele analisa toda a árvore de dependências, lidando com semânticas de resolução específicas de cada ecossistema.
- Os dados do grafo são serializados e servidos através de um servidor web Axum embutido de alta performance.
- O cliente busca o grafo e o renderiza instantaneamente num canvas responsivo guiado por física.

### Arquitetura

- **Núcleo do Backend**: Rust (Clap, Anyhow, Serde)
- **Motor Extensível de Parser**: Construído usando um sistema de traits dinâmicas, tornando fácil plugar suporte a novas linguagens.
- **Servidor Web**: Axum + Tokio (ativos estáticos compilados diretamente no binário).
- **Motor do Frontend**: Vanilla JS + Cytoscape.js.

Você roda um comando e pronto: seu navegador abre uma constelação das dependências do seu projeto, totalmente interativa e baseada em física. Você pode aplicar zoom, traçar caminhos e finalmente compreender a pura escala dos ombros em que seu código está apoiado.

### Saber é Metade da Batalha

Construir o `depg` não foi apenas sobre fazer um visualizador legal; foi sobre recuperar visibilidade. O backdoor do XZ provou que software de código aberto depende fortemente de confiança, mas confiança não deve significar ignorância voluntária.

Se tivermos as ferramentas para visualizar facilmente e auditar as raízes do nosso software, quem sabe poderemos identificar anomalias antes que cheguem a produção.

Você pode checar o código fonte e tentar por si mesmo. Rode ele no seu maior projeto e me diga — o seu grafo de dependências parece uma cidade bem estruturada, ou uma confusão caótica?

Vejo você na Wired.
