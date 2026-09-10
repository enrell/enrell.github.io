---
title: "Eu Apaguei o Framework de Agentes: Como o Matrix Virou um Kernel"
date: '2026-09-10'
lastmod: '2026-09-10'
author: 'enrell'
description: 'O Matrix começou como um runtime de agentes. Ficou interessante quando apaguei os agentes e passei a tratar identidade, tempo, autoridade e cleanup como partes da composição.'
tags: ['rust', 'matrix', 'runtime', 'distributed-systems', 'open-source', 'architecture']
categories: ['Rust', 'Architecture']
draft: false
toc:
  enable: true
  auto: true
comment:
  enable: true
share:
  enable: true
---

O primeiro commit do Matrix tinha uma TUI, um `Agent`, um `Model`, um `Tool` e até implementações chamadas `EchoTool` e `CannedModel`.

Dois dias depois eu apaguei tudo isso.

Geralmente não é um ótimo sinal quando você remove justamente as classes que pareciam definir o projeto. Nesse caso foi a melhor decisão que tomei. Eu estava tentando construir duas coisas ao mesmo tempo: uma aplicação de agentes e a infraestrutura que manteria seus componentes vivos. O resultado não fazia nenhuma das duas direito.

Sem o agente, sobrou a pergunta que realmente estava me incomodando.

O que acontece com uma chamada quando o componente do outro lado é substituído enquanto ela está em voo?

É dessa pergunta que nasceu o [Matrix](https://github.com/enrell/matrix) como ele existe hoje: um kernel experimental em Rust para compor componentes locais e remotos. Modelos, ferramentas, memória, interface e regras de negócio ficam fora dele. O Matrix cuida da parte ingrata: identidade, dependências, autoridade, recursos e ciclo de vida.

## A Função Compilou. E Agora?

Quando comecei, eu ainda pensava em composição como encaixe de interfaces. Um plugin oferece uma função; outro chama. Os tipos batem, o programa compila, vida que segue.

Só que a chamada não acontece fora do tempo.

Enquanto um componente trabalha, o processo pode cair. A credencial pode ser revogada. O operador pode instalar uma versão nova. A conexão pode sumir sem dizer se o outro host executou o efeito. Um stream antigo pode chegar quando outro processo já assumiu o mesmo nome.

O problema deixou de ser apenas “quem oferece esta interface?”. Virou “qual instância oferecia esta interface quando a operação foi admitida, e essa autorização ainda vale?”.

É isso que eu chamo de composição espaço-temporal.

O espaço é a localização: mesmo processo, outro processo local ou outro host. O tempo aparece nas gerações. Se `provider` reiniciar, o novo `provider` pode ter o mesmo nome lógico, mas não é a mesma coisa que morreu.

Uma referência no Matrix carrega época do kernel, identidade da instância e geração. Conhecer o nome `provider` não basta para fabricar uma referência. Também não concede permissão para chamá-lo.

Eu sei que “kernel de composição espaço-temporal” parece o tipo de frase que alguém escreve antes de criar 48 traits e nunca executar nada. Então deixa eu contar o bug que fez essa ideia deixar de ser só arquitetura bonita.

## O Chunk Que Quase Foi Entregue ao Processo Errado

Na composição remota, o controlador valida uma instância e escolhe uma sessão para entregar chamadas, eventos e streams. Uma versão anterior do caminho carregava o nome lógico longe demais.

O fluxo era mais ou menos este:

```text
validar provider geração 7
        ↓
guardar "provider"
        ↓
resolver "provider" outra vez na hora de entregar
```

Entre a validação e a entrega, a geração 7 podia sair. A geração 8 entrava com o mesmo nome. Quando o código fazia a segunda resolução, encontrava a geração nova.

Pronto: um chunk velho tinha caminho para um processo que nunca participou daquela operação.

O conserto não foi colocar mais um `if`. A referência validada precisava atravessar o caminho inteiro até a seleção da sessão. Nada de voltar ao nome lógico no meio. Se a instância desapareceu, a entrega falha como obsoleta. A geração nova não herda o correio da antiga.

Esse bug resume o Matrix melhor do que qualquer diagrama. “O componente existe?” é uma pergunta fraca. A pergunta útil é “esta é ainda a mesma instância para a qual eu fui autorizado a enviar isto?”.

## Eu Não Queria Mentir Com um `Disposed`

Outra decisão que parece preciosismo até dar problema é o estado `CleanupPending`.

O lifecycle atual segue esta linha:

```text
Registered → Waiting → Preparing → Active
    → Quiescing → CleanupPending → Disposed
```

`Waiting` aparece quando falta uma dependência obrigatória. `Quiescing` bloqueia chamadas novas enquanto o runtime drena ou cancela o que já entrou. Até aí, nada muito exótico.

O detalhe é que `Disposed` significa que os recursos gerenciados foram liberados. Não significa “parei de ver o processo”.

Imagine que um componente remoto adquiriu uma inscrição e uma task. O host some durante a retirada. Posso afirmar que os recursos acabaram? Não. Posso afirmar que continuam lá? Também não.

Marcar `Disposed` seria inventar uma certeza. O Matrix fica em `CleanupPending` e registra a pendência.

O mesmo raciocínio vale para timeout remoto. Se a conexão cai no momento errado, “não recebi resposta” não quer dizer “a operação não executou”. Existe um resultado `outcome-unknown` para isso. O runtime não pega uma ação potencialmente irreversível e tenta de novo por boa vontade.

Cancelar uma task também não desfaz o e-mail que ela já enviou. O Matrix administra timers, tasks, inscrições e outros recursos que passam por seus hosts, mas não vende rollback mágico de efeitos externos. Dinheiro, deploy, mensagem e escrita em outro serviço precisam de idempotência ou compensação definida pela aplicação.

Essa limitação é parte do contrato. Esconder seria bem mais confortável. Também seria errado.

## O Timeout Que Reiniciava o Relógio

Teve outro bug que mudou minha maneira de olhar para a camada de transporte.

Eu precisava garantir um prazo total para enviar um frame. A solução óbvia no Linux parecia ser configurar o timeout do socket e chamar `write_all`. Só tinha um problema: progresso parcial podia rearmar a espera. O frame avançava um pouco e ganhava mais tempo. O “deadline total” não era total.

A implementação final usa envio não bloqueante, espera com `poll(POLLOUT)` e calcula tudo contra um instante absoluto. Se parte do frame foi enviada e o restante falhou, a conexão é envenenada e fechada. Reutilizá-la deixaria o receptor diante de um frame cortado sem saber onde começa o próximo.

É um detalhe bem distante da frase “plugins locais e remotos”. Também é onde promessas de infraestrutura costumam quebrar.

Eu poderia ter escrito no README que existiam deadlines assim que apareceu um campo `timeout`. Preferi deixar a suíte adversarial provar o que a palavra queria dizer.

## Dependência Solicitada Não É Dependência Autorizada

Um componente declara as capacidades que oferece e as interfaces das quais depende. O consumidor pode pedir `provider.echo@1`, por exemplo. Esse pedido sozinho não libera nada.

O operador concede a aresta entre consumidor e capability. Na ativação, o kernel entrega um binding opaco ligado ao contexto e à geração. Se o provider some, os consumidores obrigatórios deixam de ser admitidos. Quando ele volta, entra como outra instância e os bindings são refeitos.

Essa separação evita dois atalhos que eu não quero no projeto. O SDK não pode escolher escondido “qualquer outro provider” porque o original caiu. E saber o nome de uma capability não pode virar autoridade por acidente.

Ownership é separado do grafo de dependências. A árvore de contexto responde quem deve ser limpo junto. O grafo diz quem precisa de quem para ficar ativo. Misturar os dois deixa shutdown em cascata com uma lógica que parece funcionar até aparecer compartilhamento.

Componentes também não recebem IDs crus de recursos para guardar por aí. Eles recebem handles ligados ao dono. Release repetido é idempotente; tentar liberar o recurso de outra ativação é recusado.

São regras meio chatas. Essa é precisamente a função do kernel: ser chato uma vez para que cada aplicação não invente sua própria versão incompleta delas.

## A Parte Multilíngue Ficou Maior do Que Eu Esperava

Rust é a referência, mas eu nunca quis que “escrever plugin” significasse “reescrever seu projeto em Rust”. O protocolo é o contrato comum. Os SDKs só traduzem esse contrato para a linguagem.

Hoje existem caminhos para Rust, Python, JavaScript e TypeScript, Go, Crystal, Elixir, C#, C e C++. C++ usa RAII sobre o transporte C. Go expõe cancelamento com `context.Context`; JavaScript usa `AbortSignal`; C# usa `CancellationToken`. O vocabulário muda, a autoridade não.

Eu achei que a parte difícil seria framing. Não foi.

Um dos bugs do SDK C veio de um relógio errado numa condition variable. O deadline era calculado com `CLOCK_MONOTONIC`, mas a condvar usava `CLOCK_REALTIME`. A espera expirava quase imediatamente e virava um spin disfarçado. Nos testes pequenos parecia rápida. Com uma chamada interna de 1,5 segundo, a mentira apareceu.

No Elixir, uma mailbox intermediária tornava a fila teoricamente limitada numa fila ilimitada de verdade. No Crystal, esperar pelo processo fechava os pipes, então stdout e stderr precisavam ser drenados antes do reap. Cada linguagem encontrou um jeito particular de testar se “mesma semântica” era uma afirmação séria ou só uma tabela com vários checks verdes.

O harness cruza Python com JavaScript, Go com C#, Crystal com Elixir e C com C++. Também monta uma cadeia JavaScript → Go → Rust e põe uma perna em outro host. Os componentes não implementam mTLS ou leases; a rota fica no serviço gerenciado.

Isso não torna local e remoto iguais. Local usa IPC e supervisão de processos. Remoto envolve TLS mútuo, sessões, leases, fences, reconexão e reconciliação. O código de negócio usa o mesmo modelo, mas o runtime continua admitindo que a rede é a rede e vai fazer coisas horríveis.

## O Que Existe de Verdade Hoje

O Matrix está em `0.1.0` e é experimental. Não tem promessa de estabilidade 1.0.

O contrato público inclui a fachada Rust `matrix_runtime::api`, o serviço e CLI `matrix-managed`, o verificador `matrix-conform` e os SDKs. Um harness externo cria uma aplicação fora do checkout e usa apenas artefatos empacotados e documentação pública. Fiz isso porque compilar dentro do monorepo prova muito pouco sobre adoção.

Ainda há uma lista grande de “não”:

- só Linux x86_64 foi testado;
- a publicação nos registries ainda está em andamento;
- browser, Deno, Bun, Windows, macOS e WASM não são suportes anunciados;
- o SDK C é um cliente IPC, não uma ABI para embutir o kernel;
- não existe promessa de `exactly once` entre hosts;
- ainda não publiquei números de performance.

Rust não prova isolamento sozinho. Uma suíte grande não vira prova formal. E uma demo funcionando não responde se o custo operacional do modelo vale a pena num produto real.

Esse último ponto é o que quero descobrir agora.

## Rodando

Enquanto os pacotes não terminam de chegar aos registries, o caminho é gerar os artefatos no checkout:

```bash
git clone https://github.com/enrell/matrix.git
cd matrix
./scripts/package.sh
```

O diretório `dist/` recebe binários, SDKs e um manifesto com hashes. Cada SDK tem um scaffold próprio. As instruções estão em [`docs/INSTALL.md`](https://github.com/enrell/matrix/blob/master/docs/INSTALL.md).

A menor demonstração da ideia roda assim:

```bash
python3 scripts/demo-composition.py
```

Ela cria uma cadeia Rust → Python, remove uma dependência e a introduz de novo. A parte interessante não é o echo chegar. É observar que a geração antiga perde a validade e que o consumidor só volta quando recebe um binding novo.

## A Pergunta Que Sobrou

Em menos de uma semana, o Matrix saiu de um scaffold de agentes para um runtime com composição local, remota e multilíngue. Isso foi rápido. Talvez rápido demais em alguns lugares; os bugs acima apareceram justamente quando parei de aceitar contagem de testes como resposta e comecei a atacar as fronteiras.

Agora quero usá-lo em aplicações separadas, medir latência e contenção e ver quais invariantes realmente pagam o próprio custo. Se eu descobrir que metade dessa arquitetura é desnecessária, ótimo. Apago metade.

Já apaguei o agente inteiro e o projeto ficou melhor.
