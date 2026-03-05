---
date: '2026-03-05'
lastmod: '2026-03-05'
author: 'enrell'
tags: ['cli', 'rust', 'depg']
categories: ['rust', 'depg']
draft: false
title: "Estamos Voando às Cegas: Por Que Construí um Visualizador de Grafo de Dependências em Rust"
description: 'Criei uma CLI para visualizar o grafo de dependências das nossas bases de código.'
---

Recentemente, assisti a um vídeo do canal Veritasium chamado "The Internet Was Weeks Away From Disaster and No One Knew" (A Internet Estava a Semanas do Desastre e Ninguém Sabia). O vídeo detalha a história do "backdoor" no XZ Utils — um ataque de engenharia social incrivelmente inteligente que durou anos e quase comprometeu o OpenSSH, junto com grande parte da comunidade de código aberto. O invasor passou anos conquistando confiança e começou a inserir código malicioso, aos poucos, dentro de uma biblioteca de compressão super específica que é base para muitas outras ferramentas fundamentais.

Assistindo a esse vídeo, a ideia para este projeto surgiu. Passamos bem perto de uma catástrofe global nas redes, e isso me fez refletir.

No fundo, quantos de nós realmente entendemos o conteúdo que estamos rodando? Temos a rotina de rodar `npm install`, `cargo build` ou `bun install`, e só assistimos ao terminal enlouquecer com downloads. O `node_modules` – e pastas do tipo – acabaram virando caixas-pretas completas para nós. O equivalente a você conectar sua cabeça diretamente in "The Wired" e não checar nenhuma de suas rotas. Se uma única dependência vital for comprometida, basicamente não teríamos para onde fugir.

Eu não gosto de agir às cegas ou no escuro. Minha vibe trabalhando nos projetos passa por entender o ecossistema ali dentro. Gosto de ver de onde vêm os exageros, checar a estrutura geral dessas dependências e os elos frágeis – compreender de perto quem e o que eu estou puxando pra rodar na minha máquina.

Sendo assim, resolvi criar algo que lidasse com isso.

### Conheça o `depg` (Grafo de Dependências)

Meu objetivo era ter uma ferramenta absurdamente rápida e local para mapear tudo que um projeto tem de dependência. Nada daquelas doideiras de ficar exportando seu arquivo "Cargo.lock" para serviços web aleatórios de terceiros – apenas uma ferramenta CLI robusta, direta e local capaz de rastrear as árvores de código, gerando um grafo visual completo e interativo em um segundo.

Codificar ela com Rust (Edition 2024) fluiu bem. Afinal, se formos focar em ferramentas pelo terminal (CLI), velocidade real, performance na memória das operações assíncronas e eficiência em recursos já devem ser prioridades garantidas.

### Código Fonte & Como Instalar

O código-fonte completo já está aberto aqui: [https://github.com/enrell/dependencies-graph](https://github.com/enrell/dependencies-graph)

**Para macOS ou Linux:**
```sh
curl -fsSL https://raw.githubusercontent.com/enrell/dependencies-graph/main/install.sh | sh
```

**Para Windows (com PowerShell):**
```powershell
irm https://raw.githubusercontent.com/enrell/dependencies-graph/main/install.ps1 | iex
```

**Via Cargo:**
```sh
cargo install --git https://github.com/enrell/dependencies-graph.git
```

### Como Usar

```sh
depg run
depg run --depth 2 --port 8080 --open
```

### O Que Rola Por Baixo do Capô

- Ao chamar o `depg`, ele faz uma busca na sua localização por lockfiles comuns.
- Ao encontrar, o CLI lê completamente as árvores e garante o suporte necessário baseando-se nas abordagens ecossistêmicas adequadas.
- Estes dados dos grafos de dependências recebem serialização, viram uma estrutura pronta e são acessados junto a um servidor local super otimizado via web feito localmente por meio do Axum.
- Já do lado da aplicação em renderizar este grafo, conseguimos acessar isso quase que instantâneo em uma área responsiva visual – tudo puxado com a força orientada com suporte à física local também.

### Aspectos da Arquitetura

- **Núcleo Interno**: Rust em formato puro garantindo solidez, usando Clap, Anyhow & Serde.
- **Sistema Integrado do Parser**: Toda a estrutura aqui cresce via suporte das chamadas Traits tornando incrivelmente fácil incluir as próximas linguagens futuramente.
- **Estruturação do Server**: Usa a estrutura Axum + modelagem sob o runtime Tokio (com arquivos fixos que fecham junto dentro da compilação de binários final).
- **No lado Visual**: É a flexibilidade com Cytoscape.js rodando puramente no JS padrão sem pesar a máquina.

A ideia é: um único comando, no enter – e a diversão magicamente acontece visualizando os projetos no seu navegador padrão abrindo uma estrutura de conexões orgânica focada nessas dependências do código em poucos cliques. Poder acessar detalhes, e chegar exatamente mais fundo mapeando partes distantes que conectam no fundo toda e qualquer base de operações ali no seu trabalho.

### Saber Metade de Tudo

Isso que gerou o `depg` focou além em apenas fazer uns desenhos agradáveis. Era retornar com nosso controle visual de verdade para ver se o que colocavam com os escândalos daquelas partes envolvendo bibliotecas do backdoors do XZ na vida real podem parar nas portas desses grandes códigos fontes base abertos que nós temos plena certeza confiar antes e também se garantir que não somos completamente cegos para não acompanhar quem estamos absorvendo com tudo nas costas sem validar nada.

Quando criamos as próprias formas ágeis de podermos observar os detalhes destas fiações visuais fundamentais – a premissa volta para tentar detectar coisas fora do padrão rapidamente um pouco antes dos processos alcançarem locais perigosos da operação de produções globais que operam essas ferramentas.

Verifiquem com os códigos de portas sempre abertas; testem rodar na base gigante dos seus trabalhos codificados – o local com os traços das estruturas se parecem hoje com bairros projetados logicamente organizados de prédios conectados bem ajustados ali? Ou aquilo mais já parece uma tempestade sem fim e de muito caos amarrado sem direção ali?

See you in the The Wired.
