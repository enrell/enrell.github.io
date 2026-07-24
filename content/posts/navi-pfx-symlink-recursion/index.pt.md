---
date: '2026-07-24'
lastmod: '2026-07-24'
author: 'enrell'
tags: ['navi-agent', 'rust', 'symlink', 'filesystem', 'debugging', 'wine', 'proton']
categories: ['Rust', 'navi-agent']
draft: false
title: "Processo zombie e symlink cíclico: um bug interessante no NAVI"
description: "Um processo NAVI headless preso em recursão infinita por causa de um symlink `pfx -> .` num prefixo Wine/Proton. Como reproduzi, provei e consertei."
---

Estava terminando o release 0.3.8 do NAVI quando notei que tinha um processo `navi` rodando com CPU alta. Nada de outro mundo — processo headless que não terminou, provavelmente alguma task presa. Fui investigar.

## O diagnóstico

`btop` mostrou duas threads em ~70% de CPU cada. `ps` confirmou:

```text
$ ps -p 425090 -L
  PID   LWP TTY      STAT TIME COMMAND
425090 425090 ?      S    0:00 navi
425090 425124 ?      R    10:28 tokio-rt-worker
425090 425125 ?      R    10:27 tokio-rt-worker
```

Duas `tokio-rt-worker` threads com mais de 10 horas de CPU acumulada. A main thread estava dormindo (`S`). Essas duas estavam correndo (`R`) sem parar.

`lsof` mostrou dezenas de file descriptors abertos para o mesmo path:

```text
/home/enrell/Games/umu/umu-default
```

`umu-default` é um prefixo Wine/Proton. Dentro dele tem um symlink que é padrão dessa estrutura:

```text
pfx -> .
```

`pfx` aponta para o próprio diretório. Então `pfx/pfx` é o mesmo diretório. `pfx/pfx/pfx` também. E assim infinitamente.

## O bug

O NAVI estava rodando headless (`navi --no-tui`). O modelo tinha chamado `search` (`list` ou `find`) num path que incluía esse prefixo. O directory traversal era o código padrão que você encontra em qualquer lugar:

```rust
for entry in fs::read_dir(path)?.flatten() {
    let path = entry.path();
    if path.is_dir() {
        collect_files_recursive(&path, ...);
    } else if path.is_file() {
        files.push(...);
    }
}
```

O detalhe que mata: `path.is_dir()` resolve symlinks. Quando encontrou `pfx`, viu um diretório, entrou, e lá dentro tinha `pfx` de novo.

```text
pfx
pfx/pfx
pfx/pfx/pfx
...
```

A função nunca parava. `tokio::task::spawn_blocking` nunca retornava. O runtime do Tokio não shutdowna enquanto threads do blocking pool não terminam. Processo virou zombie.

O mesmo padrão existia em três lugares:

- `search_tool.rs`: `collect_files_recursive` (list/find), `collect_matches` (grep), `build_tree` (tree)
- `repo_intelligence.rs`: `collect_source_files` (indexação do repositório)

## Reproduzir antes de consertar

Em vez de sair aplicando `if`, escrevi testes que reproduziam o cenário exato:

```rust
#[test]
#[cfg(unix)]
fn collect_files_recursive_respects_symlink_cycle() {
    let tempdir = tempfile::tempdir().unwrap();
    let root = tempdir.path();
    std::fs::write(root.join("a.txt"), "a").unwrap();
    std::os::unix::fs::symlink(".", root.join("pfx")).unwrap();

    let mut files = Vec::new();
    collect_files_recursive(root, root, &config, 0, 50, &mut files);

    assert_eq!(files.len(), 1);
}
```

Antes do fix, devolveu 42 entradas. Todas `a.txt`, mas com paths tipo `pfx/pfx/pfx/.../a.txt`. O loop estava confirmado.

Para `repo_intelligence` (`build_index`), o teste nem retornou. Timeout. O mesmo symlink derrubava a indexação inteira.

## O fix

A regra é simples: em recursive traversal, use `DirEntry::file_type()` em vez de `path.is_dir()`. `file_type()` não resolve symlinks — te diz o tipo real da entrada:

```rust
let file_type = entry.file_type()?;

if file_type.is_symlink() {
    // symlink para diretório: ignora
    // symlink para arquivo: pode listar
    continue;
}

if file_type.is_dir() {
    collect_files_recursive(&path, ...);
} else if file_type.is_file() {
    files.push(...);
}
```

A ação `tree` agora renderiza symlinks como folhas com `type: "symlink"` e `children: 0`, em vez de descer. Também coloquei limites de profundidade (100 níveis) em `search` e `repo_intelligence` — não é o fix principal, mas é cinto de segurança para árvores genuinamente profundas.

Depois do fix:

```bash
$ cargo test -p navi-core -- --test-threads=4
# 1079 + 22 testes passaram
```

Commit: `fix(core): prevent infinite directory traversal on symlink cycles`.

## Por que isso é fácil de errar

`Path::is_dir()` e `Path::is_file()` seguem symlinks. A documentação diz isso, mas é o tipo de coisa que você não pensa quando escreve um recursive traversal pela enésima vez. O código funciona para 99% dos diretórios. O problema só aparece quando alguém tem um prefixo Wine/Proton no path — e `pfx -> .` é um symlink que o Wine cria por design.

`spawn_blocking` complica porque uma task presa prende o processo inteiro. A main thread pode ter terminado, mas se uma blocking thread estiver em loop infinito, o runtime do Tokio não desliga. Você fecha a TUI, fecha o terminal, e o processo continua lá. Zombie.

Se você escreve ferramentas que andam pelo filesystem, vale revisar seus loops. `is_dir()` segue symlinks. `file_type()` não. A diferença parece pequena até alguém ter um prefixo Wine no path de busca.

> See you in the Wired.
