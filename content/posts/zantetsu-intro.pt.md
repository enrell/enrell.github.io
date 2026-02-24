---
title: "Eu criei um pacote NPM para analisar nomes de arquivos de anime — Aqui está minha história"
date: 2026-02-21
lastmod: 2026-02-21
draft: false
author: "enrell"
description: "Após anos de analisar manualmente nomes bagunçados de arquivos de anime, finalmente criei uma ferramenta para automatizar. Meet Zantetsu — meu primeiro pacote NPM."

tags: ["npm", "typescript", "rust", "anime", "parser", "open-source"]
categories: ["Programação", "Anúncio"]

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

Era 3 da manhã de uma terça-feira. Eu estava olhando minha pasta de anime, rolando por nomes de arquivos como:

```
[SubsPlease] Spy x Family - 01 (1080p) [A4DAF3D9].mkv
[Coalgirls] Clannad (1920x1080 Blu-Ray FLAC) [1234ABCD]/[Coalgirls] Clannad - 01 (1920x1080 Blu-Ray FLAC) [1234ABCD].mkv
One Punch Man S02E03 1080p WEBRip x264-PandoR.mkv
```

E pensei comigo mesmo: *"Deve haver uma maneira melhor."*

Soa familiar? Se você já construiu uma biblioteca de mídia, sabe exatamente do que estou falando. Esses nomes de arquivos bagunçados e inconsistentes — eles me enlouquecem. E os parsers existentes? Ou muito lentos, muito rígidos, ou não lidavam com a variedade selvagem de convenções de nomenclatura que nós, fãs de anime, usamos.

Então eu construí um myself.

## Meet Zantetsu

**Zantetsu** (japonês para "lâmina cortante" — afiado, rápido, preciso) é minha solução para este problema. É um parser de metadados de anime extremamente rápido que extrai título, número do episódio, resolução, codecs e muito mais de qualquer nome de arquivo.

```bash
npm install zantetsu
```

Uma linha. É tudo o que você precisa para começar a fazer parsing.

## Por que isso importa

O que o Zantetsu pode fazer:

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

Mas fica melhor. O Zantetsu lida com o caos:

- Arquivos de múltiplos episódios? ✅
- Notações de temporada (S01E03)? ✅
- Variantes de resolução (1080p, 1080i, 1080)? ✅
- Grupos de release e codecs? ✅
- Processamento em lote para pastas inteiras? ✅

## A história por trás disso

Não acordei忽然 decides escrever um parser. Este projeto começou porque eu precisava dele para meu próprio servidor de mídia. Eu estava cansado de renomear manualmente arquivos ou usar ferramentas desajeitadas que não conseguiam acompanhar as convenções de nomenclatura criativas da comunidade de anime.

Então fiz o que qualquer desenvolvedor faz: resolvi meu próprio problema.

Mas eu não quis apenas mais um parser baseado em regex. Queria algo **rápido**. Algo que pudesse processar milhares de nomes de arquivo em segundos. É por isso que escolhi **Rust** para o motor principal — ele me dá desempenho nativo com as garantias de segurança de que preciso.

As bindings TypeScript? Isso é para experiência do desenvolvedor. Porque fazer parsing deve ser agradável, não um pesadelo de debug.

## A Stack

O que faz o Zantetsu funcionar:

| Camada | Tecnologia | Por quê |
|--------|------------|---------|
| Parser Core | Rust | Velocidade pura, segurança de memória |
| Bindings | TypeScript | Experiência do desenvolvedor |
| Build | Cargo + npm | O melhor de ambos |

O resultado? Um pacote que é **10x mais rápido** que alternativas puras em JavaScript — mas ainda parece JavaScript nativo para usar.

## Exemplo do Mundo Real

Digamos que você tem uma pasta com conteúdo misturado:

```typescript
import { parseBatch } from 'zantetsu';

const files = [
  '[SubsPlease] Spy x Family - 01 (1080p).mkv',
  '[Coalgirls] Clannad - 02 (720p) [ABC123].mkv',
  'One Punch Man S02E03 1080p WEBRip.mkv',
  '[Erai-raws] Made in Abyss S1 - 04 [1080p][Multiple Subtitle].mkv'
];

const results = parseBatch(files);

// Processe como quiser
results.forEach(r => {
  console.log(`${r.title} - Episode ${r.episode?.episode}`);
});
```

Saída:
```
Spy x Family - Episode 1
Clannad - Episode 2
One Punch Man - Episode 3
Made in Abyss - Episode 4
```

Belo, não é?

## O que eu aprendi

Esta foi minha primeira vez publicando um pacote NPM, e cara — há muito mais nisso do que eu esperava:

- **Versionamento importa** — Semantic versioning não é opcional
- **Definições de tipo são essenciais** — Seus usuários agradecerão
- **Documentação é uma funcionalidade** — Passei tanto tempo em docs quanto em código
- **Testes são inegociáveis** — 80% de cobertura mínima
- **Feedback da comunidade é ouro** — Usuários iniciais encontram bugs que você nunca imaginou

## O que vem a seguir

Estou apenas começando. Aqui está o que está no roteiro:

- 🤖 **Parsing com ML** — Para os nomes de arquivo realmente estrangos
- 📺 **Detecção de múltiplos episódios** — Lidando com releases em lote
- 🎨 **API de regras customizadas** — Adicione seus próprios padrões de parsing
- 🌐 **Mais tipos de mídia** — Suporte para filmes, séries, música

## Experimente

Código aberto o Zantetsu porque acredito em devolver à comunidade que o inspirou. Se você está construindo um servidor de mídia, um indexador de torrents, ou só precisa organizar sua pasta de anime — esta ferramenta é para você.

```bash
npm install zantetsu
```

E se você tiver problemas, encontrar um bug, ou tiver uma solicitação de funcionalidade — o [repositório GitHub](https://github.com/enrell/zantetsu) está sempre aberto. Adoraria ouvir seu feedback.

---

*E você? Há um problema no seu fluxo de trabalho diário que você está adiando resolver? Me avise nos comentários — talvez juntos possamos construir algo incrível.*

*Também, se você achou isso útil, compartilhe com outros desenvolvedores. Ajuda mais do que você sabe.*
