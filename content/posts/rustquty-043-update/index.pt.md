---
title: "rustquty 0.4.3: Quality Gates Confiáveis Precisam de Métricas Confiáveis"
date: '2026-06-28'
lastmod: '2026-06-28'
author: 'enrell'
description: 'rustquty 0.4.3 corrige os collectors de duplicates e LOC, trocando contagem barulhenta de linhas repetidas por detecção de blocos via tokens e deixando long lines explicáveis.'
tags: ['rust', 'quality', 'tools', 'open-source', 'ci', 'rustquty']
categories: ['Rust', 'Tools']
toc:
  enable: true
  auto: true
comment:
  enable: true
share:
  enable: true
---

As primeiras versões públicas do rustquty saíram com uma ideia que eu ainda gosto bastante: quality gates locais para projetos Rust.

Roda um comando. Coleta métricas. Compara contra um baseline ou thresholds absolutos. Falha se a qualidade piorou.

Esse modelo continua fazendo sentido pra mim.

Mas essa semana eu encontrei aquela parte que todo autor de ferramenta encontra uma hora: o momento em que a ferramenta diz algo tão obviamente errado que você para de confiar no relatório inteiro.

No rustquty, isso aconteceu em dois collectors: `duplicates` e `loc`.

A versão `0.4.3` é uma release de correção. Não é uma release cheia de feature brilhante. É uma release para recuperar confiança.

## O Detector de Duplicatas Ruim

O collector antigo de duplicatas era ingênuo demais.

Ele passava por todos os arquivos `.rs`, dava `trim` em cada linha, ignorava linhas vazias e comentários óbvios, e contava linhas repetidas no projeto inteiro.

Se uma linha aparecesse mais de uma vez, cada ocorrência contava como duplicação.

Isso parece quase razoável até você lembrar como código Rust se parece:

```rust
}
);
},
#[test]
return;
```

Essas linhas repetem o tempo todo em qualquer projeto real. Uma chave fechando em duas funções diferentes não é código duplicado. É sintaxe.

O resultado era matematicamente correto para o algoritmo e completamente errado para o produto.

Eu vi relatórios apontando porcentagens gigantes de duplicação, não porque a codebase tinha funções de 20 linhas copiadas pra todo lado, mas porque tokens comuns apareciam milhares de vezes.

Isso é pior que inútil. Isso treina você a ignorar o gate.

## O Que Mudou no 0.4.3

O collector de duplicatas agora trabalha no nível de blocos de tokens.

Em vez de perguntar "essa linha apareceu em outro lugar?", o rustquty agora tokeniza o código Rust e procura janelas repetidas de tokens. Os defaults são conservadores de propósito:

- pelo menos 100 tokens
- pelo menos 6 linhas de código fonte
- match exato de tokens normalizados
- comentários e whitespace não importam
- janelas sobrepostas são mescladas em blocos duplicados

Isso significa que chaves, atributos e pontuação repetida não disparam mais duplicação.

O que dispara agora é estrutura repetida de verdade: aquele copy-paste em que um corpo de função, branch de parser, bloco de mapping ou setup aparece duas vezes com o mesmo fluxo de tokens.

O output também ficou mais útil. O `metricsSummary.json` agora inclui detalhes estruturados e limitados dos blocos duplicados:

```json
{
  "duplicateLines": 594,
  "filesWithDuplicates": 6,
  "duplicateBlocks": [
    {
      "lines": 12,
      "tokens": 143,
      "occurrences": [
        { "file": "src/a.rs", "startLine": 10, "endLine": 21 },
        { "file": "src/b.rs", "startLine": 42, "endLine": 53 }
      ]
    }
  ]
}
```

Essa é a diferença entre "você tem duplicatas, boa sorte" e "aqui está o bloco duplicado, vai olhar ele".

## O Collector de LOC Também Omitia Informação

O collector de linhas de código tinha outro problema.

Internamente, ele usava line length máximo de 120. Essa parte estava ok.

Mas depois da coleta, a camada de agregação esquecia de copiar vários campos para o `metricsSummary.json` final:

- `maxLineLengthAllowed`
- `filesWithLongLines`
- `longLineFiles`
- detalhes das long lines

Então o collector bruto sabia o threshold e os arquivos, mas o JSON final podia mostrar algo assim:

```json
"maxLineLengthAllowed": 0,
"filesWithLongLines": 0,
"longLineFiles": []
```

ao mesmo tempo em que reportava milhares de linhas longas.

Esse é exatamente o tipo de inconsistência que faz um quality gate parecer assombrado.

Tinha mais um desalinhamento sutil: mensagens do gate podiam mencionar o maior line length observado no baseline em vez do threshold real usado pelo collector.

Então uma mensagem podia sugerir "essas linhas excedem 284" quando o collector tinha checado contra 120.

De novo: inaceitável para uma ferramenta cujo trabalho é criar confiança.

## LOC Agora É Configurado Onde Importa

No `0.4.3`, line length é configurado na hora da coleta.

Se você coloca isso no `rustquty.toml`:

```toml
[gate.defaults]
max-line-length = 120
```

o collector de LOC usa esse valor enquanto escaneia. O JSON grava isso em `maxLineLengthAllowed`. A mensagem do gate reporta esse mesmo threshold. O `--verbose` usa o mesmo número.

Sem dupla personalidade entre "o que foi checado" e "o que foi reportado".

O verbose agora também mostra `arquivo:linha`:

```text
loc: 20 lines exceed max length (120)
  rustquty/src/main.rs:198  length 143 > 120
  rustquty-core/src/gate.rs:167  length 138 > 120
```

Os detalhes são limitados para não explodir relatórios em repositórios grandes, mas a falha agora é explicável.

## Um Pequeno Ajuste no Scan de Arquivos

Enquanto corrigia isso, também fiz os collectors built-in que leem código Rust ignorarem diretórios que não devem entrar no scan:

- `target/`
- `.git/`
- `quality/`

Isso importa mais do que parece. Depois de um build, `target/` pode conter arquivos `.rs` gerados por dependências. Um scanner local de qualidade deve escanear o seu projeto, não artefato gerado pelo build.

## Por Que Essa Release Importa

A lição principal é simples:

**Um quality gate só é útil na medida em que você confia nas métricas dele.**

Falso positivo não é inofensivo. Ele cria um hábito:

1. A ferramenta falha.
2. A falha parece errada.
3. Você ignora.
4. A próxima falha real também é ignorada.

É assim que uma ferramenta de qualidade vira ruído no terminal.

Eu prefiro um detector menor e mais rígido, que captura menos coisas mas reporta problemas reais, do que um detector barulhento que reporta tudo e ensina as pessoas a parar de ler.

## Release Notes

`rustquty 0.4.3` e `rustquty-core 0.4.3` já estão publicados no crates.io.

Para instalar ou atualizar:

```bash
cargo install rustquty --force
```

Principais mudanças:

- troquei detecção de duplicatas por linhas repetidas por detecção de blocos via tokens
- preservei os campos de agregação de LOC no `metricsSummary.json`
- corrigi o `maxLineLengthAllowed`
- fiz o line-length usar o threshold configurado durante a coleta
- corrigi mensagens do gate de LOC para reportar o threshold real do collector
- adicionei detalhes limitados de duplicatas e long lines no `--verbose`
- ignorei `target/`, `.git/` e `quality/` no scan dos collectors built-in de Rust

## O Que Vem Depois

A próxima coisa que eu quero do rustquty não é mais collector só por ter mais collector.

Eu quero explicações melhores.

Quando um gate falha, eu quero que o relatório responda:

- o que falhou?
- onde?
- comparado com qual threshold?
- por que isso importa?
- o que eu devo olhar primeiro?

A release `0.4.3` anda nessa direção. Ela deixa os dois collectors mais barulhentos menos mágicos e mais inspecionáveis.

Esse é o tipo de melhoria chata que faz uma ferramenta sobreviver ao uso diário.

Repositório: [github.com/enrell/rustquty](https://github.com/enrell/rustquty)

```bash
rustquty qa --verbose
```

Se falhar agora, deve falhar por um motivo que você consegue ver.

---

> See you in the Wired.
