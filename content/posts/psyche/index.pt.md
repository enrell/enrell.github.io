---
date: '2026-04-04'
lastmod: '2026-04-04'
author: 'enrell'
tags: ['rust', 'media-server', 'open-source', 'self-hosted', 'security', 'anime', 'psyche', 'serial-experiments-lain']
categories: ['Rust', 'Announcement']
draft: false
title: "Psyche: O Media Server Que Mantém Seus Dados Seus"
description: 'O Plex te obriga a fazer login nos servidores deles. O Jellyfin é um silo. Todo media server self-hosted que tentei me incomodou de algum jeito. Cansei de esperar e comecei a construir.'
---

Eram 2 da manhã. Eu tava fuçando na minha pasta de anime tentando entender por que o media server não tinha pego os metadados de um episódio novo. Abri o banco de dados SQLite por curiosidade — só pra ver o que tinha lá dentro.

Dava pra ler. Tudo. Cada título. Cada nota. Cada entrada do meu histórico. Texto puro, sem criptografia nenhuma, sentado ali no meu disco.

Fechei o terminal e fiquei olhando pro teto.

É isso. Essa é a história inteira de por que tô construindo isso.

## O Estado do Media Self-Hosted

Você tem o Plex, que começou como projeto comunitário e foi virando lentamente um produto que te pede pra fazer login nos servidores *deles* só pra assistir *seus* arquivos na *sua* máquina. Você tem o Jellyfin — genuinamente bom, mantido pela comunidade — mas em C#, com uma arquitetura que complica coisas que não precisavam ser complicadas. Você tem Navidrome pra música, Kavita pra livros, Komga pra manga. Ferramentas ótimas. Mas cada uma é um silo.

Você assiste anime num app. Lê manga em outro. Ouve música num terceiro. Cada um com seu próprio banco de dados, seu próprio sistema de auth, sua própria ideia de como é a sua biblioteca. E nenhum deles leva segurança a sério do jeito que eu acho que merece.

Nenhum deles criptografa seus metadados por padrão.

Pensa nisso por um segundo. Seu histórico de visualização. Suas notas. Os títulos de tudo que você já consumiu. Num arquivo SQLite em plaintext no seu disco. Se alguém roubar seu HD — ou tiver uns minutinhos sem supervisão perto do seu PC — tem um retrato completo do seu consumo de mídia sem esforço nenhum.

Isso me incomoda.

## O Que Eu Tô Construindo

**Psyche** é um media server local-first, de alta performance e alta segurança, escrito em Rust.

Anime. Manga. Séries. Livros. Música. Um servidor. Uma API. Um frontend.

O nome vem de Serial Experiments Lain (1998). No SEL, o Psyche é o eu — privado, local, criptografado. A fronteira entre o que é seu e o que pertence à rede. É exatamente isso que esse servidor é. Seus dados. Sua máquina. Não é assunto de mais ninguém.

Mas vai além: o histórico é criptografado no disco. Os metadados são criptografados no disco. As miniaturas são criptografadas no disco. Quem conseguir acesso ao sistema de arquivos vai encontrar texto cifrado. O servidor descriptografa em tempo real — plaintext nunca toca o disco.

E quando eu digo local-first, quero dizer no sentido paranoico. Toda funcionalidade remota — AniList sync, APIs de metadados, tradução por LLM, busca de letras — tem uma alternativa local. Dá pra rodar o Psyche com zero conexões externas e não perder nada além de conveniência. Dá pra importar o dump do Kitsu (o time compartilha livremente) e ter metadados completos de anime offline pra sempre.

## A Stack (e Por Que Isso Importa)

Rust. Axum. SQLite via sqlx. Esse é o core.

Escolhi Rust porque precisava que o compilador fosse chato. Sério. Quando você tá construindo algo que lida com dados criptografados, faz streaming e caminha pelo sistema de arquivos, você quer um compilador que fala "não" com frequência. Quero saber em tempo de compilação que não introduzi buffer overflow, corrida de dados ou null dereference. O compilador do Rust é verboso e chato — e é exatamente isso que você quer quando segurança é o core da proposta de valor.

O banco é SQLite. Não Postgres. Não document store. SQLite, porque isso é um servidor *local-first* e me recuso a te obrigar a rodar um daemon de banco só pra assistir seu próprio anime. Async-nativo via sqlx, com verificação de query em tempo de compilação — o SQL é validado contra o schema real antes de compilar. Sem mágica, sem ORM escondendo nada. Migrations em SQL puro em arquivos `.sql` numerados. Totalmente auditável.

A camada HTTP é Axum — Tower-nativo, composável, mantido pelo time do Tokio. Sem surpresa.

## O Ecossistema Próprio

Isso não é só um servidor. É o começo de um ecossistema. No SEL, o NAVI da Lain é o hardware e software que ela usa pra se conectar à Wired. Cada crate nesse projeto é uma camada — um pedaço da stack que deixa o Psyche fazer o que faz.

NAVI:
![navi screen](navi-1.png)

Ela faz um upgrade insano no NAVI dela — e é essa energia que tô trazendo pra essa codebase:
![navi screen](navi-2.png)

Você já conhece o **zantetsu** — meu parser de nomes de arquivo de anime que escrevi alguns meses atrás. É a Layer 00. O core do scanner do Psyche. Ele lida com o caos: `[SubsPlease] Jujutsu Kaisen - 24 (1080p) [A1B2C3D4].mkv`, `One Punch Man S02E03 1080p WEBRip x264.mkv`, tudo isso. 92%+ de precisão só no parser heurístico, com fallback neural DistilBERT + CRF pros casos realmente bizarros.

Mas ainda tô construindo mais duas crates que não existem ainda:

**`psyche-translate`** (Layer 01) é um motor de tradução com modelo de provider plugável. Providers remotos (OpenAI, Anthropic, Gemini), locais via Ollama ou llama.cpp, ou nada. A crate mantém contexto do episódio entre segmentos pra os nomes dos personagens ficarem consistentes. Dá pra traduzir uma trilha de legenda inteira, uma página de manga ou um capítulo de livro com uma chamada só — e o provider é só configuração.

**`fill-metadata`** (Layer 02) é a ambiciosa. É um pipeline de machine learning que analisa arquivos de mídia brutos e *infere* metadados quando não existe nenhum. Análise de cena, fingerprinting de áudio, speech-to-text pra inferir título. Se você tem uma pasta cheia de vídeos sem nome de anos atrás, o `fill-metadata` propõe o que eles são. Você revisa, aprova, ele salva. Sem mágica. Sem commit automático. Você tá sempre no controle.

## O Pipeline de OCR

É aqui que fica interessante.

Legendas PGS — o formato baseado em bitmap que os Blu-rays usam — são imagens. Você não consegue pesquisar, traduzir ou copiar texto delas. O Psyche vai fazer OCR. Extrai o texto. Torna tudo pesquisável.

Mas vai além: páginas de manga e livros recebem o tratamento completo. O OCR extrai regiões de texto com bounding boxes. O `psyche-translate` traduz cada região. Uma passagem de renderização reconstrói a imagem — o texto traduzido é diagramado na região original, o texto original é removido por inpainting, e você tem uma página que parece o original mas lê no seu idioma.

Modelos de OCR diferentes pra domínios diferentes. Painéis de manga e balões de fala não são o mesmo problema que uma página de livro digitalizada. Tratar os dois como o mesmo problema é como você consegue resultado ruim.

Isso não é hack de fim de semana. É um pipeline que vou construir direito, uma crate de cada vez.

## As Integrações

Sonarr. Radarr. Prowlarr. Lidarr. Readarr. Jackett. Discord rich presence. Bot do Discord. Webhooks. AniList sync. Import de playlist do Spotify. Streaming de torrent com priorização sequencial de peças. Tudo isso.

Mas — e isso é importante — tudo é opt-in. Cada integração é desabilitada por padrão. Você ativa o que quer. E pra cada integração remota, tem uma alternativa local. A stack arr já é local. O Jackett já é local. Pro resto: dump offline do Kitsu, Ollama local, NFO sidecar files.

O caminho do usuário paranoico é totalmente suportado. Não como pensamento posterior. Como requisito de design.

## Plugins e a Wired

É aqui que a metáfora do SEL passa de estética pra estrutural.

O sistema de plugins é sandboxed. Terceiros podem adicionar providers de metadados, estratégias de scanner, backends de tradução, formatos de exportação — sem fazer fork, sem tocar no core. A fronteira do plugin é explícita e aplicada. O que roda dentro do plugin não alcança fora sem passar por uma interface definida. Não é só boa arquitetura. É a única arquitetura que aceito pra um servidor que guarda seus dados criptografados.

E mais além — tem a Wired.

No SEL, a Wired é a rede que conecta toda consciência. O lugar onde a fronteira entre o eu e o outro se dissolve — mas só se você escolher entrar. Essa é a camada P2P opt-in da comunidade. Feeds de atividade. Notas. Listas compartilhadas. Descentralizada — nenhum servidor central controla nada. Você ativa aceitando explicitamente os termos. Estado padrão: totalmente desligado. Nenhum dado sai da sua máquina a não ser que você diga.

Honestamente ainda não sei exatamente como construir a Wired. Sistemas distribuídos nesse nível estão fora da minha expertise atual — e esse é um dos motivos pelos quais estou escrevendo esse post. Mas sei como ela precisa parecer: você é sempre a Lain, conectando nos seus próprios termos. A rede não te consome. Você alcança ela e puxa o que quer.

O modelo de monetização é simbólico e opcional. Loja de recompensas cosméticas — ícones, badges, packs de emoji, cargos no Discord. Estilo Discord: você paga por identidade, nunca por feature. A receita vai pra me manter focado em construir isso em vez de procurar outra forma de pagar o aluguel.

App Android. App desktop via Tauri. Web primeiro, apps nativos quando a experiência web estiver estável.

## Por Que GPL v3

Escolhi a GNU General Public License versão 3 de propósito.

A GPL v3 é a licença de copyleft mais forte disponível. Se alguém fizer fork do Psyche e distribuir — comercialmente ou não — tem que liberar o código-fonte completo nos mesmos termos. Você não pega o Psyche, fecha o código e vende. Não tem caminho de exceção enterprise. Não tem truque de "dual licensing". A comunidade construiu, a comunidade mantém.

Já vi projetos self-hosted demais serem acqui-contratados ou lentamente enshittificados. O Jellyfin existe porque o Emby fechou o código. Isso não vai acontecer com o Psyche. A licença torna isso estruturalmente impossível.

## O Estado Atual

Tô na Fase 0. O workspace Cargo está bootstrapped. O template do frontend React existe (tá bonito, por sinal). Os docs estão escritos: visão, arquitetura, modelo de segurança, contrato de criptografia.

A Fase 1 é a próxima: sistema de auth, scanner de sistema de arquivos, API de anime, streaming, servindo o frontend como binário único. Cada fatia é testada antes da próxima começar. TDD, sem exceção. Um cume de cada vez.

Isso vai levar anos pra atingir a visão completa. Sei disso. Não vou fingir o contrário.

Mas a fundação tá sendo construída direito. As decisões de arquitetura estão documentadas. O modelo de segurança foi escrito antes da primeira linha de código de produção. O contrato de criptografia especifica exatamente o que é criptografado, o que não é, e por quê.

É assim que você constrói algo que dura.

## Você Leu Até Aqui. Isso Significa Algo.

Sério. A maioria saiu no primeiro parágrafo. Você não.

Isso me diz que você é o tipo de pessoa que realmente pensa sobre essas coisas. Que percebe quando algo tá errado e fica se perguntando se podia ser melhor. Que ficou um pouco incomodada com a ideia de um arquivo plaintext no disco catalogando tudo que você já assistiu. Que olhou pra fragmentação do media self-hosted e pensou "alguém deveria consertar isso."

Essa pessoa é exatamente quem estou procurando. E digo isso no sentido mais amplo possível.

Sou técnico. Consigo escrever Rust, projetar schema de banco, conectar API. Tenho experiência com machine learning, desenvolvimento mobile e sistemas P2P. Mas tenho pontos cegos reais — e esse projeto precisa de mais do que quem sabe programar.

**Não tenho experiência nenhuma em construir comunidades.** Zero. Não sei fazer servidor do Discord crescer, não sei escrever anúncio que faz as pessoas se sentirem parte de algo, não sei criar cultura em torno de um projeto. Se você já fez isso — em qualquer projeto, qualquer comunidade — esse conhecimento vale mais pro Psyche agora do que mais um PR em Rust.

**Não tenho experiência com UI/UX além do ok.** O template do frontend ficou limpo, mas não sou designer full time. Não sei como um leitor deve se sentir virando página de manga. Não sei como é a experiência perfeita de player de música. Se você se importa com isso — se você já redesenhou algo e fez parecer *certo* — tem uma tela em branco aqui com seu nome.

**Não tenho expertise profunda em criptografia avançada.** Conheço o suficiente pra projetar o pipeline AES-256-GCM, escolher Argon2id e escrever um modelo de ameaça. Mas quem consegue olhar meu esquema de derivação de chave e achar a falha sutil que eu não vi — essas pessoas ainda não estão na minha rede.

**Não tenho experiência com pentest avançado.** Consigo escrever código seguro e pensar em modelos de ameaça. Mas quem ataca sistemas profissionalmente, quem encontra os edge cases que eu nem sabia que existiam, quem consegue me dizer exatamente onde minhas suposições de segurança quebram — preciso dessas pessoas.

**Não falo nada além de inglês e português.** Isso vai precisar falar todos os idiomas eventualmente — não só no frontend, mas na documentação, na comunidade e no suporte. Se você fala outro idioma e se importa com esse projeto, tem espaço pra você aqui.

Não tenho equipe. Não tenho financiamento. Não tenho empresa por trás disso. Tenho uma visão, um compilador e uma licença GPL v3 que garante que isso vai ficar livre pra sempre.

O que estou pedindo é simples: **se algo nesse post te fez pensar "eu poderia ajudar com isso" — entra em contato.**

Não só devs. Designers, escritores, construtores de comunidade, pesquisadores de ML, devs mobile, pesquisadores de segurança, pessoas com opiniões fortes sobre o que deveria ser uma boa experiência de biblioteca de mídia. Tradutores — isso vai precisar falar todos os idiomas eventualmente. Quem só quer reportar bugs com bons screenshots e logs. Quem quer escrever documentação porque sabe como é se sentir perdido num projeto sem nenhuma.

O guia de contribuição é rigoroso com qualidade de código porque segurança é o core. Mas não tem barra pra *se importar*. Se você se importa, tem espaço pra você aqui.

A codebase tem um arquivo `AGENTS.md` que explica como trabalhamos — foi escrito pra ser lido por humanos e agentes de IA igualmente, porque uso ferramentas de IA e espero que contribuidores também usem. A regra não é "sem IA." A regra é "você é dono de cada linha." Lê, entende e traz seu eu completo — ferramentas incluídas.

Manda mensagem pra **enrell@proton.me**. Me conta o que você faz, no que gostaria de trabalhar, ou só que leu isso e ressoou. Isso já é suficiente pra começar uma conversa.

Ou abre uma issue. Ou dá uma estrela no repositório e aparece quando algo te mover. Não precisa de compromisso pra se importar com algo.

---

O sonho é ambicioso. A montanha é alta. Mas tô olhando pra esses nomes de arquivo de anime bagunçados na minha pasta local há anos, esperando a ferramenta certa existir.

Cansei de esperar.

Nos vemos na Wired.
