---
title: "Eu Criei um Pacote NPM para Fazer o Parse de Nomes de Arquivos de Anime — Aqui Está a Minha História"
date: 2026-02-21
lastmod: 2026-02-21
draft: false
author: "enrell"
description: "Depois de anos fazendo o parse manual de nomes bagunçados de arquivos de anime, finalmente criei uma ferramenta para automatizar isso. Conheça o Zantetsu — meu primeiro pacote NPM."

tags: ["npm", "typescript", "rust", "anime", "parser", "open-source"]
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

Eram 3 da manhã de uma terça-feira. Eu estava olhando para a minha pasta de animes, rolando por nomes de arquivos como:

```
[SubsPlease] Spy x Family - 01 (1080p) [A4DAF3D9].mkv
[Coalgirls] Clannad (1920x1080 Blu-Ray FLAC) [1234ABCD]/[Coalgirls] Clannad - 01 (1920x1080 Blu-Ray FLAC) [1234ABCD].mkv
One Punch Man S02E03 1080p WEBRip x264-PandoR.mkv
```

E pensei comigo mesmo: *"Tem que haver um jeito melhor."*

Soa familiar? Se você já montou uma biblioteca de mídia, sabe exatamente do que estou falando. Esses nomes de arquivos bagunçados e inconsistentes — eles me deixam louco. E os parsers existentes? Ou eram muito lentos, muito rígidos ou não lidavam com a variedade selvagem de convenções de nomenclatura que nós, fãs de anime, usamos.

Então eu mesmo construí um.

## Conheça o Zantetsu

**Zantetsu** (japonês para "lâmina que corta ferro" — afiada, rápida, precisa) é a minha solução para este problema. É um parser de metadados de anime incrivelmente rápido que extrai o título, número do episódio, resolução, codecs e muito mais de qualquer nome de arquivo que você jogar nele.

```
npm install zantetsu
```

Uma linha. Isso é tudo que você precisa para começar a fazer o parse.

## Por Que Isso Importa

Aqui está o que o Zantetsu consegue fazer:

```typescript
import { parse } from 'zantetsu';

const result = parse('[SubsPlease] Spy x Family - 01 (1080p).mkv');

// Resultado:
// {
//   title: "Spy x Family",
//   episode: { type: 'single', episode: 1 },
//   resolution: 'FHD1080',
//   group: 'SubsPlease',
//   video_codec: 'H264',
//   audio_codec: 'AAC',
//   source: 'WEB',
//   confidence: 0.85
// }
```

Mas fica ainda melhor. O Zantetsu lida com o caos:

- Arquivos com múltiplos episódios? ✅
- Notações de temporada (S01E03)? ✅
- Variantes de resolução (1080p, 1080i, 1080)? ✅
- Release groups e codecs? ✅
- Processamento em lote (batch) para pastas inteiras? ✅

## A História Por Trás Disso

Eu não acordei simplesmente e decidi escrever um parser. Esse projeto começou porque eu precisava dele para o meu próprio servidor de mídia. Eu estava cansado de renomear arquivos manualmente ou usar ferramentas desajeitadas que não conseguiam acompanhar as convenções criativas de nomenclatura da comunidade de anime.

Então fiz o que qualquer desenvolvedor faz: resolvi o meu próprio problema.

Mas eu não queria apenas mais um parser baseado em regex. Eu queria algo **rápido**. Algo que pudesse processar milhares de nomes de arquivos em segundos. É por isso que escolhi **Rust** para o motor principal — ele me dá performance nativa com as garantias de segurança que preciso.

As bindings para TypeScript? Isso é para a experiência do desenvolvedor. Porque fazer o parse deve ser agradável, não um pesadelo de debugging.

## A Stack

Aqui está o que faz o Zantetsu funcionar:

| Camada | Tecnologia | Por quê |
|-------|------------|-----|
| Parser Principal | Rust | Velocidade bruta, segurança de memória |
| Bindings | TypeScript | Experiência do desenvolvedor |
| Build | Cargo + npm | O melhor dos dois mundos |

O resultado? Um pacote que é **10x mais rápido** do que alternativas em JavaScript puro — mas que ainda parece JavaScript nativo na hora de usar.

## Exemplo do Mundo Real

Digamos que você tenha uma pasta com conteúdo misto:

```typescript
import { parseBatch } from 'zantetsu';

const files = [
  '[SubsPlease] Spy x Family - 01 (1080p).mkv',
  '[Coalgirls] Clannad - 02 (720p) [ABC123].mkv',
  'One Punch Man S02E03 1080p WEBRip.mkv',
  '[Erai-raws] Made in Abyss S1 - 04 [1080p][Multiple Subtitle].mkv'
];

const results = parseBatch(files);

// Processe-os como quiser
results.forEach(r => {
  console.log(`${r.title} - Episódio ${r.episode?.episode}`);
});
```

Saída:
```
Spy x Family - Episódio 1
Clannad - Episódio 2
One Punch Man - Episódio 3
Made in Abyss - Episódio 4
```

Lindo, não é?

## O Que Eu Aprendi

Esta foi a minha primeira vez publicando um pacote NPM e, uau — há muito mais nisso do que eu esperava:

- **Versionamento importa** — Versionamento semântico não é opcional
- **Definições de tipos são essenciais** — Seus usuários vão te agradecer
- **Documentação é uma feature** — Passei tanto tempo na documentação quanto no código
- **Testes não são negociáveis** — Mínimo de 80% de cobertura de testes
- **O feedback da comunidade vale ouro** — Os primeiros usuários encontram bugs que você nunca imaginou

## O Que Vem a Seguir

Estou apenas começando. Aqui está o que está no roadmap:

- Parse turbinado por ML — Para os nomes de arquivos realmente bizarros
- Detecção de múltiplos episódios — Lidando com lançamentos em lote (batch)
- API de regras customizadas — Adicione seus próprios padrões de parse
- Mais tipos de mídia — Suporte para filmes, séries de TV, músicas

## Experimente

Eu tornei o Zantetsu open-source porque acredito em retribuir à comunidade que o inspirou. Seja você alguém construindo um servidor de mídia, um indexador de torrents ou apenas precisando organizar sua pasta de animes — esta ferramenta é para você.

```bash
npm install zantetsu
```

E se você tiver problemas, encontrar um bug ou tiver um pedido de feature — o [repositório no GitHub](https://github.com/enrell/zantetsu) está sempre aberto. Eu adoraria ouvir o seu feedback.

---

*E quanto a você? Existe algum problema no seu fluxo de trabalho diário que você tem adiado para resolver? Deixe-me saber nos comentários — talvez juntos possamos construir algo incrível.*

*Além disso, se você achou isso útil, compartilhe com outros desenvolvedores. Ajuda mais do que você imagina.*
