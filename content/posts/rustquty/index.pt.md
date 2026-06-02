---
title: "rustquty: O Scanner de Qualidade Local pra Projetos Rust"
date: '2026-06-02'
lastmod: '2026-06-02'
author: 'enrell'
description: 'Cansado de rodar fmt, clippy, coverage e o resto manualmente de forma inconsistente? Eu também. Queria um quality gate local, rápido, que impedisse o código de piorar com o tempo — sem depender de CI lento ou SonarQube enterprise. Então construí o rustquty.'
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

Tava no meio de um refactor no animedb, um projeto Rust que eu mantenho. Rodei `cargo fmt --check`, rodei `cargo clippy`, rodei `cargo test`. Tudo verde. Aí subi o PR.

Depois de uns dias, olhando o diff, percebi que uma função tinha inchado pra mais de 100 linhas. Outra tava com nesting de 8 níveis. Ninguém comentou. O CI passou. Porque o CI não olha pra isso.

Eu já tinha visto isso acontecer antes. Qualidade não some de uma hora pra outra. Ela vai degradando devagar, uma função por vez, até o dia que você olha pro módulo e pensa "como que isso virou uma bagunça?"

Ferramentas como SonarQube existem pra isso. Mas são pesadas, precisam de servidor, são overkill pra projeto pessoal ou time pequeno, e eu quero as coisas **local-first**. Sem rede. Sem conta. Sem drama.

Foi aí que eu comecei a escrever o rustquty.

## O Que o rustquty Faz

É um scanner de qualidade local para projetos Rust. Ele roda uma porrada de "collectors", junta as métricas, e compara contra um baseline ou contra thresholds absolutos (inspirados no SonarQube, Detekt, ESLint etc).

Se a qualidade piorou desde o baseline (o famoso "ratchet model"), ele falha. Se você preferir, você fixa regras absolutas tipo "nenhuma função pode ter mais de 80 linhas" ou "cobertura mínima de 80%" e ele respeita isso.

12 collectors no total:

- Os clássicos: fmt, clippy, tests, coverage, deny, audit, hack, mutants
- Os built-in (sem ferramenta externa): duplicates, loc (com enforçamento de line length), size (linhas por arquivo/função + contagem de parâmetros via AST), complexity (ciclamática + profundidade de aninhamento via AST)

Você roda com `rustquty qa` (ou `collect` + `gate` separado). Ele gera três arquivos JSON na pasta `quality/`:

- `metricsSummary.json` — tudo que foi coletado agora
- `baseline.json` — os thresholds atuais (se você rodar init-baseline)
- `qualityReport.json` — o resultado do gate, com violations listadas

E o melhor: sai com exit code 0, 1 ou 2. Perfeito pra CI, pre-commit hook, ou só pra você rodar antes de commitar.

## Como Eu Uso (e Como Você Pode Usar)

No meu fluxo normal:

```bash
# dentro de qualquer projeto Rust
rustquty init          # cria quality/ com baseline vazio
rustquty qa            # roda tudo e gateia
```

Se passar, vida que segue. Se falhar, ele me mostra o que quebrou (e com `--verbose` mostra até `arquivo:linha` das violações de size/complexity/loc).

Quero algo rápido antes de abrir PR? Uso o profile `fast`:

```bash
rustquty qa --profile fast   # só fmt + clippy
```

Quero o full treatment, incluindo os collectors lentos? `full` (padrão, sem mutants) ou `deep` (tudo, inclusive mutation testing que demora pra caralho).

E tem o `doctor` pra ver o que tá disponível no PATH:

```
rustquty doctor
```

Útil quando você tá num ambiente novo ou container.

## Ratchet vs Thresholds Absolutos

Tem dois modos de pensar qualidade e eu quis os dois.

**Ratchet (padrão)**: você roda `rustquty init-baseline` em cima de um metricsSummary bom. Daí pra frente, qualquer degradação falha. É como um "não deixa piorar". Ótimo pra times que querem evoluir qualidade incrementalmente sem quebrar tudo de uma vez. O baseline é só JSON, você versiona junto com o código.

**Absolutes via `[gate.defaults]`**: você põe no `rustquty.toml` coisas tipo:

```toml
[gate.defaults]
max-cyclomatic-per-function = 15
max-nesting-depth = 5
max-lines-per-function = 80
max-lines-per-file = 1000
min-coverage-percent = 80.0
max-clippy-warnings = 0
max-line-length = 120
```

Esses valores vêm de referências reais (SonarQube, Detekt, etc). Quando você seta um, ele **sobrescreve** o valor do baseline pra aquela métrica. Quer usar ratchet pra duplicatas mas hard-cap de complexidade? Pode. Quer tudo absoluto? Pode também. Omitir um campo = usa o baseline.

Precedência é clara: flag CLI > rustquty.toml > defaults internos.

## Os Collectors que Eu Mais Gosto (os Built-in)

Os collectors que rodam ferramentas externas são legais, mas os que realmente me deram valor novo foram os que eu implementei com parsing de AST:

- **duplicates**: acha linhas idênticas entre arquivos fonte Rust. Simples, mas surpreendentemente útil pra detectar copy-paste que virou dívida técnica.
- **loc + line length**: conta linhas totais/código/comentários/blank, e ainda reclama de linhas que passam de 120 chars (configurável). O parser de comentários block (`/* */`) foi mais chato do que parecia.
- **size**: por arquivo e por função. Linhas totais, linhas de código, parâmetros. Usa `syn` v2 pra parsear de verdade, não regex. A gente detecta função com 256 linhas e 4 parâmetros? Sim. E reporta violation com nome da fn.
- **complexity**: cyclomatic (pontos de decisão: if, match, loops, &&, ||, ?) + nesting depth máximo. De novo, tudo via AST. Função com complexidade 50 e nesting 7? Vai aparecer no report.

Esses quatro não precisam de nada além do rustquty instalado. Zero dependência externa. Rápidos. E rodam em paralelo com rayon junto com os outros.

## Configuração

Crie um `rustquty.toml` na raiz do workspace:

```toml
[profile]
default = "full"

[collectors]
mutants = false   # desliga os lentos por padrão

[gate.size]
max_lines_per_file = 500
max_lines_per_function = 80
max_parameters_per_function = 5

[gate.complexity]
max_cyclomatic_per_function = 10
max_nesting_depth = 5

[gate.loc]
max_line_length = 120
```

Ou use os defaults absolutos que eu mencionei antes. Funciona pros dois.

## Integração com CI

Tem um composite action no próprio repo. Exemplo básico:

```yaml
- uses: rustquty/rustquty/.github/actions/rustquty@main
  with:
    profile: full
```

Ou você copia a action local e customiza. Quando falha, ele pode até upar os JSONs como artifact pra você inspecionar.

## Estado Atual e Honestidade

A versão atual é 0.4.1. Tem suporte completo aos 12 collectors, verbose mode, absolute thresholds (adicionado no 0.4), API pública no rustquty-core pra quem quiser embeddar isso em outra ferramenta, e o gate bem refatorado.

O próprio rustquty usa ele mesmo (tem quality/ versionado). E adivinha? O report atual mostra algumas violações de size e complexity, porque eu ainda tô limpando código legado das fases iniciais. O ratchet tá me ajudando a não piorar enquanto eu conserto.

Eu uso ele no animedb e planejo trazer pros outros crates Rust que eu mantenho.

## O Que Eu Aprendi Construindo Isso

- Parsing Rust de verdade com `syn` é absurdamente mais confiável que qualquer regex ou tree-sitter meia-boca pra métricas de complexidade/tamanho. O custo de manter um parser correto é zero — o compilador faz o trabalho.
- O ratchet model é uma ideia genial que eu roubei da engenharia de software "séria". Ele remove a discussão "mas tá bom o suficiente?". Se piorou em relação ao que era ontem, falhou. Ponto.
- Collectors opcionais e profiles são obrigatórios. Se você obriga o cara a rodar `cargo mutants` toda hora, ele desliga a ferramenta. Deixa ele escolher a profundidade.
- JSON schema versionado + timestamps ISO + exit codes bem definidos faz toda diferença quando você quer integrar com outras coisas depois.
- Escrever tooling que as pessoas realmente vão usar no dia a dia exige mais atenção em UX de terminal (os ✓ ✗ ○ ⚠ , o output humano legível, o --verbose que realmente ajuda) do que em features exóticas.

## Experimente

```bash
cargo install rustquty
```

Ou baixa binário pré-compilado dos releases.

```bash
cd seu-projeto-rust
rustquty init
rustquty qa --verbose
```

O repositório é [github.com/enrell/rustquty](https://github.com/enrell/rustquty). Issues, PRs, sugestões de novos collectors, tudo é bem-vindo.

Se você já usa algum linter/quality tool no seu fluxo Rust e sente que falta alguma coisa, me conta. Tô curioso pra ver o que outras pessoas sentem falta.

---

> See you in the Wired.

