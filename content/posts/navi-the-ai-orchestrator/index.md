---
date: '2026-02-23'
lastmod: '2026-02-23'
author: 'enrell'
tags: ['navi', 'openclaw', 'ai-orchestrator', 'go', 'hexagonal-architecture', 'ports-and-adapters']
categories: ['AI Orchestrators', 'Go Programming', 'Software Architecture']
draft: false
title: 'Eu estou fazendo o Navi um orquestrador de AI seguro e útil de verdade | chora openclaw'
description: 'Navi is a powerful, high-performance AI orchestrator built with Go that supports multiple interaction modes: TUI, API, and messaging bots (Discord, Telegram). It features a hexagonal architecture (Ports and Adapters) for maximum flexibility and testability.'
---

# Hello world guys!

O TLDR é: Eu testei o openclaw e outros orquestradores de AI e eles sempre seguem o mesmo padrão: 

> Eles são criados como um produto para a venda, e não como um projeto open-source para a comunidade. Eles são criados pelo o hype e para o hype, com uma ideia genéria de agencia, um produto que tem um monte de features, skills, e etc, mas no final das contas, eles não são tão úteis assim, porque eles não são criados para resolver problemas reais, e sim para a venda, para o hype, marketing e para vender assinaturas das big techs. 
Por isso a OpenAI contratou o Peter Steinberger, um acqui-hire clássico para ter um meio para vender suas chaves de API e subscriptions, e não para resolver problemas reais.

Posso citar exemplos de projetos que seguem o mesmo padrão:

- Windsurf
- Adept
- Covariant

Todos hypados como “próxima geração de agents/coding/robotics”. Google, Amazon e Meta fazem licensing e pegam fundadores/time.

Resultado: startups viram “ghost company” ou skeleton crew. Funcionários choram em all-hands, produto morre ou fica irrelevante, enquanto o time vai trabalhar pros modelos/cloud da big tech.

# O diferencial do Navi

Eu levantei pontos inúteis do openclaw, você deve se perguntar, o porque eu estou tacando o pau no openclaw, e não em outros orquestradores de AI, e a resposta é simples, porque o openclaw é o mais popular, o mais hypado, o mais vendido, e o mais usado, e por isso ele é o melhor exemplo para exemplificar. Quem é da bolha tech e nunca ouviu falar de openclaw nas últimas semanas está morando em uma caverna.

Eu não nego que estou em uma bolha, e que os LLMs são uma bolha, que pode estourar a qualquer momento, e que o AI winter vai chegar cedo ou tarde. Mas o que eu quero dizer é que, mesmo que seja uma bolha, e mesmo que o hype seja grande, e mesmo que as big techs estejam investindo pesado, algumas empresas vão sobreviver, modelos open-source vão continuar existindo, porque de fato há um valor real, há demanda real, só não é o tipo de valor e demanda que as big techs estão vendendo, e sim um valor e demanda mais nichada, mais específica, mais real, mais útil, e é isso que o Navi tem como objetivo, sobreviver ao estouro da bolha.

Eu acredito que a bolha vai estourar, e que as empresas que sobreviverem vão ser aquelas que realmente entregarem valor, seja ele um produto, um serviço ou modelos de base.
LLM é uma tecnologia que tem utilidade, principalmente nessas áreas (não está em ordem):

## A utilidade dos agentes

Nunca foi tão fácil tirar um projeto do papel. Testar ideias, aprender um framework novo ou só meter um "vibe coding" pra ver se um produto para em pé ficou bizarramente rápido. A armadilha aqui é pra quem só copia e cola sem entender o que tá rolando por baixo dos panos. (Se quiser fugir disso e aprender algo útil, veja esse post: como usar LLMs da forma correta).

Suporte ao cliente sem dor de cabeça. Esqueça aqueles bots burros de antigamente. Um agente inteligente integrado no WhatsApp ou nos sistemas internos resolve de 60% a 80% das buchas diárias 24/7. Tenho amigos que já tramparam em suporte e a real é uma só: 90% dos problemas são coisas banais, muitas vezes de idosos ou de quem tem zero letramento digital. A IA resolve isso sem suar.

Vendas e Marketing em escala (sem parecer um robô). Dá pra automatizar desde a qualificação de leads (SDR agents) até a recuperação de carrinhos perdidos e análise de calls. É gerar conteúdo e mandar emails personalizados em massa, mas que ainda soam naturais.

Achar as coisas na própria empresa (o famoso RAG): Sabe aquela documentação legada gigantesca ou as políticas internas que ninguém sabe onde estão? Bota um chat interno apontado pra isso. Se bem implementado, documentar e consultar o conhecimento da empresa vira algo trivial.

Cibersegurança e Blue/White Hats: Analisar log na mão é chato e repetitivo. Um modelo bem tunado consegue mastigar logs, detectar ameaças, fazer um pentest superficial e gerar relatório rapidinho. É uma mão na roda absurda pra quem trabalha com segurança e precisa reduzir o tempo de resposta a incidentes.

Apesar de todos os benefícios que os agentes trazem, a maioria das pessoas tem uma visão exagerada dos agentes, na maioria das vezes dão super poderes que esses agentes não deveriam ter. A pegadinha é achar que agentes resolvem tudo, e não poderia estar mais errado, eles devem fazer parte do processo, e não tomar o processo inteiro para sí.


## A segurança

Uma das coisas mais tristes na bolha tech atualmente é a negligencia à seguraça, não precisa ser nível enterprise, mas deve ser sólida, tenha o mínimo de responsabilidade.
Não faça como certos devs, não suba um projeto de hobby com portas abertas, credenciais em plaintext e Remote Code Execution de um clique, mesmo avisando explicitamente várias vezes não é o suficiente, é a receita para o desastre.

## Navi project

Depois desse extensivo desabafo está na hora de falar sobre o projeto que vem pulsando na minha mente, o Navi. A ideia veio a anos atrás como um projeto pessoal (claramente estou atrazado não? XD), eu sempre busquei a automatização no meu ambiente de desenvolvimento, seja ela aplicações auto-hospedadas, ferramentas CLI, e scripts de automação, mas nunca fiquei satisfeito em como a automação era feita, e eu descobrir o porque. 

A automação de tarefas principalmente no linux é extremamente descrentralizada, isso significa que temos muitas ferramentas para automação, mas elas não se comunicam de forma nativa e padronizada. Você tem um script bash para uma coisa, um cronjob para outra, e várias ferramentas CLI excelentes que exigem que você faça um "glue code" (código cola) feio pra caramba para fazer uma conversar com a outra. As ferramentas não se conversão, e nem deveriam por questão de segurança.

O Navi nasce exatamente para ser esse elo, o maestro dessa orquestra, mas com uma regra de ouro: o controle é sempre seu e a segurança é inegociável. Ele não é um "agente autônomo mágico" que vai rodar um rm -rf / porque alucinou no meio de uma task ou interpretou mal um prompt solto.

O nome veio do NAVI um computador do anime [Serial Experiments Lain (1998)](https://anilist.co/anime/339/serial-experiments-lain/) um dos meus animes favoritos, recomendo assistir, é denso, intelectual e filosófico, emfim, esse computador é usado pela protagonista `Lain` para acessar a Wired (a rede global ultra-avançada do anime, tipo uma internet que mistura realidade virtual, consciência coletiva e muito mais). A NAVI é o conjunto de hardware + software para acessar a wired. Ele tem uma interface por navegação e por voz.

NAVI: 
![navi screen](navi-1.png) 

Ela faz um upgrade insano no NAVI:
![navi screen](navi-2.png)

> O propósito do Navi é ser um orquestrador de agentes útil, seguro e para a comunidade tech/dev.

# A Arquitetura do Navi
Para garantir que o projeto seja robusto, escalável e, acima de tudo, testável, eu escolhi escrever o Navi em Go. Além de entregar uma performance absurda e compilar tudo para um binário único (o que facilita muito a vida no Linux), Go me permite lidar com concorrência de forma muito elegante e direta.

A base do projeto segue a Arquitetura Hexagonal (Ports and Adapters).

Isso significa que o "core" da inteligência e orquestração do Navi é completamente isolado das ferramentas externas e das interfaces. Se amanhã eu quiser trocar o provedor de LLM, o banco de dados local ou a forma como ele executa um script no meu sistema operacional, eu só escrevo um novo "adapter". A lógica de negócio continua intacta e isolada de efeitos colaterais.

## Como você interage com ele?

Como eu falei no começo, o Navi não te prende a uma interface web pesada e proprietária que tenta te empurrar uma assinatura, ou um agente que vai expor suas credenciais. Ele foi pensado para ter múltiplos pontos de entrada (os Ports da nossa arquitetura):

> TUI (Terminal User Interface): Para quem vive no terminal (e quem usa Neovim e um window manager como Sway sabe o valor de não precisar tirar a mão do teclado), ter uma interface rápida, bonita e responsiva direto no console é essencial.

> API REST/gRPC: Se você quiser integrar o Navi em outro sistema, criar um frontend próprio ou disparar webhooks de outras aplicações, a porta está aberta.

> Bots de Mensageria: Integração nativa com Discord e Telegram. Você pode disparar automações no seu servidor ou na sua máquina de casa mandando uma mensagem pelo celular, de forma autenticada e segura.

O roadmap ainda está sendo desenhado, e o core está sendo desenvolvido. A ideia é construir algo open-source, focando em resolver problemas reais de produtividade e orquestração de sistema, sem vender a alma para o hype.

Em breve eu solto o repositório no GitHub para quem quiser dar uma olhada no código (ou dar uns pitacos nas PRs). Até lá, seguimos codando!

-- Present day, present time! hahahahaha
