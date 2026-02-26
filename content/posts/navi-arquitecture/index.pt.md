---
date: '2026-02-23'
lastmod: '2026-02-23'
author: 'enrell'
tags: ['navi', 'go', 'hexagonal-architecture', 'ai']
categories: ['Go', 'Navi']
draft: false
title: "Definindo as decisões de arquitetura do Navi"
description: 'Neste post, quero compartilhar algumas decisões arquiteturais sobre o meu projeto de orquestração de IA chamado Navi'
---

Eram 3 da manhã quando tive a ideia do Navi, alguns meses atrás. Eu estava na cama pensando sobre o impacto dos LLMs nas *hard skills* dos desenvolvedores. Antes do boom dos LLMs, eu melhorava minhas habilidades de programação construindo projetos para o meu próprio uso. Mas quando a OpenAI lançou o GPT-3, vi que essa tecnologia poderia ser útil. Passei muito tempo brincando com a geração de código do GPT-3, e lembro da sensação que tive quando o usei para aprender POO (Programação Orientada a Objetos). Eu fiquei tipo: "Que p*rra é essa! Como esses caras fazem isso?". Essa foi a faísca que fez meu hiperfoco ativar para estudar a área.

Estudei o básico para entender as arquiteturas dos modelos e, recentemente, concluí a disciplina de Recuperação de Informação e Inteligência Artificial na faculdade. Agora tenho um conhecimento sólido para começar a entender o presente e o futuro dos LLMs.

Neste artigo, vou apresentar as decisões arquiteturais por trás do Navi e alguns insights úteis sobre os pontos fortes e fracos dos agentes, com base no meu humilde conhecimento sobre LLMs.

## A diferença entre agentes e agência

Olha, estou imerso na área de IA há um bom tempo e posso te dizer uma coisa: **todo mundo joga a palavra "agente" para todo lado como se não houvesse amanhã**. Mas a questão é a seguinte — um agente por si só? É apenas uma chamada de função chique com fobia de compromisso.

Deixa eu explicar isso com algo real. Imagine que você tem um único modelo de IA que pode responder a perguntas. Legal, né? Isso é um **agente**. Ele é reativo. Você pergunta, ele responde. Você dá o prompt, ele gera o output. Não há nada de errado com isso — mas não é exatamente... autônomo.

Agora, e se essa mesma IA pudesse **decidir** quando pesquisar na web, **escolher** chamar um banco de dados e **optar** por salvar os resultados em algum lugar? Ainda é um agente. Mas no momento em que você conecta vários agentes, dá a eles papéis, responsabilidades e uma forma de se comunicarem?

É aí que você tem uma **agência**.

### A Armadilha do Agente Solitário

Já vi esse erro vezes demais. Desenvolvedores criam um "super agente" que tenta fazer de tudo:

```go
// Não faça isso
func (a *Agent) HandleEverything(input string) string {
	// Verifica se precisa pesquisar
	// Verifica se precisa calcular
	// Verifica se precisa salvar
	// Verifica se precisa chamar uma API
	// ...você entendeu a ideia
}
```

Isso é o que eu chamo de padrão "agente deus" (*god agent*). Funciona para demonstrações, mas desmorona em produção. Por quê? Porque **agentes únicos não têm perspectiva**. Eles tentam ser tudo ao mesmo tempo.

### A Abordagem de Agência

Uma agência é diferente. Pense nela como uma equipe:

```go
// Este é o caminho
type Agency struct {
	Planner    *Agent // Decide os passos (Planejador)
	Researcher *Agent // Pesquisa e coleta informações (Pesquisador)
	Coder      *Agent // Escreve e revisa código (Programador)
	Executor   *Agent // Roda ferramentas e APIs (Executor)
}
```

Cada agente tem uma **responsabilidade única**. O planejador não programa. O programador não executa. O executor não planeja. Eles se especializam, se comunicam e, juntos, resolvem problemas que sobrecarregariam qualquer agente individual.

### Por que isso importa para o Navi

Quando comecei a projetar o Navi, cometi o erro do agente primeiro. Construí um agente monolítico que tentava lidar com orquestração, execução de ferramentas, gerenciamento de memória e formatação de respostas, tudo de uma vez.

Foi uma bagunça.

A virada de chave veio quando percebi: **O Navi não é um agente. O Navi é uma agência.** É um sistema onde agentes especializados trabalham juntos, cada um com limites e propósitos claros.

| Aspecto         | Agente               | Agência                  |
|-----------------|----------------------|--------------------------|
| Escopo          | Tarefa única         | Fluxo de trabalho coordenado |
| Tomada de Decisão| Reativa             | Estratégica + Reativa    |
| Modo de Falha   | Tudo ou nada         | Degradação graciosa (*Graceful degradation*) |
| Escalabilidade  | Limitada             | Horizontal               |
| Manutenção      | Difícil de debugar   | Responsabilidade clara   |

No momento em que você entende essa diferença, toda a sua abordagem para orquestração de IA muda. Você para de perguntar "Como deixo meu agente mais inteligente?" e começa a perguntar "Como faço meus agentes trabalharem melhor juntos?".

Essa é a base sobre a qual o Navi foi construído.

## Os Pontos Fracos dos LLMs

Eu amo essa tecnologia. Eu a estudei. Eu criei coisas com ela. Estou construindo o **Navi** em cima dela. Mas aqui está o que aprendi da pior maneira: se você não entende onde os LLMs quebram, você não está construindo infraestrutura — está construindo um castelo de cartas.

Deixa eu compartilhar o que descobri depois de inúmeras sessões de debug às 4 da manhã.

### A Barreira de Contexto Que Ninguém Comenta

Todo mundo comemora janelas de contexto maiores como se tivéssemos resolvido tudo. Legal, mas aqui está o que realmente acontece: seu modelo começa a esquecer coisas antes mesmo de atingir o limite.

Eu estava construindo uma funcionalidade onde o Navi precisava lembrar do histórico da conversa, mais os resultados das ferramentas, mais as instruções do sistema. Parece simples, certo? Bem, por volta do token 8.000 em um modelo de 32K, as coisas ficaram esquisitas. O modelo começou a:

- Ignorar instruções que coloquei no início
- Começar a dar respostas genéricas
- Alucinar com mais frequência
- Perder o controle das restrições

É como quando você estuda por 8 horas seguidas e, na hora 7, você está apenas... lendo palavras sem absorver nada.

```go
// O que eu achei que funcionaria
func BuildContext(history, tools, instructions string) string {
	return instructions + history + tools // Concatenação simples, certo?
}

// O que realmente acontece dentro do modelo
// Diluição de atenção = 📉
```

A lição? **Mais contexto ≠ mais inteligência**. Às vezes, mais contexto = mais confusão.

### O Problema da Confiança

LLMs não fazem ideia de quando estão errados. Nenhuma. Zero. Eles vão te dar a resposta mais confiantemente incorreta com 99% de certeza.

Fiz um teste onde fiz a mesma pergunta 100 vezes com pequenas variações. O modelo dava respostas contraditórias, mas soando absolutamente certo em todas as vezes. Foi aí que me dei conta: **confiança ≠ exatidão**.

```go
type LLMResponse struct {
	Answer     string
	Confidence float64 // Este número não significa nada
	IsCorrect  bool    // O modelo não sabe disso
}
```

Se você está construindo sistemas que executam código, lidam com dinheiro ou tocam em segurança — e está confiando na confiança auto-relatada do modelo — cara, você vai ter problemas.

### A Memória Que Não Existe

LLMs não têm memória. Eles não aprendem com as conversas. Eles não atualizam seu conhecimento. Após cada resposta, é como se nascessem de novo — uma amnésia pura, mas cheia de marra.

Tudo o que você acha que é "memória" é, na verdade, construído pelo desenvolvedor. Sem uma arquitetura de memória externa, você tem um peixinho dourado com um PhD. Brilhante, mas esquece tudo em 3 segundos.

### A Armadilha do Generalista

LLMs sabem tudo e nada ao mesmo tempo. Perguntar sobre Kubernetes, física quântica, roteiros de anime e história medieval na mesma conversa? Sem problema. Mas se aprofunde em qualquer um desses tópicos e você encontrará os limites.

Eles são generalistas estatísticos. Reconhecedores de padrões anabolizados. O que é incrível para amplitude, mas perigoso quando você precisa de profundidade.

Aprendi isso quando estava fazendo *vibe coding* com revisão ativa usando os modelos Claude Opus. Ele gerava um código que parecia perfeito, mas tinha bugs sutis. O modelo conhecia a sintaxe, entendia o padrão, mas deixava passar os *edge cases* (casos extremos) porque ele não *entende* código de verdade — ele prevê tokens com base em padrões que já viu.

### A Realidade da Alucinação

Vamos ser claros: **alucinação não é um bug, é uma feature**. Bom, não exatamente uma feature, mas um subproduto inevitável de como esses modelos funcionam. Eles preveem tokens de forma probabilística. Às vezes, essa previsão está errada. E eles não fazem a menor ideia de quando isso acontece.

O que piora a situação:
- Instruções ambíguas
- Contexto conflitante
- Excesso de informação
- Perguntas sobre coisas que não existem

```go
// A parte assustadora
response := model.Ask("Algo que não existe")
fmt.Println(response)              // Retorna algo plausível
fmt.Println(model.KnowsItsWrong()) // false - esse método não existe
```

### Por Que Sistemas Multi-Agentes Realmente Importam

Então, por que falar tanto sobre fraquezas? Porque entendê-las muda tudo sobre como você constrói as coisas.

A maioria das pessoas acha que sistemas multi-agentes são sobre velocidade. Paralelização. Fazer as coisas mais rápido. Elas estão erradas.

**É sobre distribuição cognitiva.**

Quando dividi o Navi em agentes especializados, algo interessante aconteceu:

| Agente Único               | Agência                          |
|----------------------------|----------------------------------|
| Diluição de contexto       | Contexto focado por agente       |
| Alta taxa de alucinação    | Menor alucinação por agente      |
| Difícil de debugar         | Limites de falha claros          |
| Respostas genéricas        | Saídas especializadas            |
| Tudo falha junto           | Degradação graciosa (*Graceful degradation*) |

Cada agente opera em um escopo cognitivo menor. Escopo menor significa menos confusão, melhor adesão às instruções e debug mais fácil.

```go
// Antes: Um agente tentando fazer tudo
type GodAgent struct {
	// Planejamento
	// Pesquisa
	// Programação
	// Execução
	// Verificação
	// Memória
	// Tudo...
}

// Depois: Agentes especializados
type Agency struct {
	Planner    *Agent // Apenas planeja
	Researcher *Agent // Apenas pesquisa
	Coder      *Agent // Apenas programa
	Executor   *Agent // Apenas executa
	Verifier   *Agent // Apenas verifica
}
```

Uma agência não é necessariamente mais rápida por padrão. **Ela é mais estável.** Velocidade é um efeito colateral. Estabilidade é o objetivo.

## A Decisão pela Arquitetura Hexagonal

O cenário de IA está em constante fluxo. Novas versões de API, capacidades de modelos, provedores e tecnologias surgem todo mês.

Então, como isso se conecta à arquitetura? Simples: se os LLMs são inerentemente voláteis e o campo da IA evolui tão rapidamente, sua arquitetura precisa ser desacoplada para proteger seu sistema dessas mudanças.

A arquitetura hexagonal (portas e adaptadores) me dá:

- **Fronteiras claras** entre a lógica do LLM e a lógica de negócios
- **Interfaces testáveis** sem precisar chamar modelos reais
- **Implementações intercambiáveis** (troque implementações sem alterar o núcleo)
- **Isolamento** de componentes propensos a alucinações

```go
// Porta: O que o LLM pode fazer
type LLMPort interface {
	Generate(ctx context.Context, prompt Prompt) (Response, error)
	Embed(ctx context.Context, text string) (Vector, error)
}

// Adaptador: Como nós realmente fazemos isso (OpenAI, Anthropic, local, etc.)
type OpenAIAdapter struct {
	client *openai.Client
}

// Núcleo: Lógica de negócios que não se importa com qual é o LLM
type Orchestrator struct {
	llm LLMPort
	// Não sabe nem se importa com a implementação
}
```

Isso não é apenas código limpo — é sobrevivência. Vamos ser realistas sobre o que pode mudar nos próximos 12 meses:

- **Mudanças tecnológicas** — A OpenAI muda sua API. A Anthropic lança um novo protocolo. Sua arquitetura determina se isso será apenas uma atualização de configuração numa tarde de terça-feira ou dias reescrevendo código.
- **Cenários de fallback (contingência)** — A OpenAI cai. Você atinge os limites de taxa (*rate limits*). Sua chave de API é estrangulada (*throttled*). Com arquitetura hexagonal, seu orquestrador não se importa — ele apenas chama a porta, e o adaptador lida com o failover.
- **Implantações híbridas** — Alguns agentes rodam localmente por privacidade, outros na nuvem por potência. Alguns usam OpenAI, outros usam Claude, outros usam modelos open-source que você mesmo hospeda. Mesma interface, adaptadores diferentes.

```go
// O orquestrador não sabe nem se importa
type Orchestrator struct {
	llm LLMPort
	// Pode ser OpenAI
	// Pode ser Anthropic
	// Pode ser sua instância local do Ollama
	// Pode ser um load balancer distribuindo entre 5 provedores
	// Não importa. A interface continua a mesma.
}
```

É por isso que a arquitetura hexagonal não é *overengineering* (excesso de engenharia) — é reconhecer que **o cenário dos LLMs vai mudar**. A questão não é se você precisará se adaptar. É se a sua arquitetura permite que você se adapte em horas ou em meses.

## O Que Eu Aprendi

1. **LLMs são ferramentas, não pensadores** — Eles são reconhecedores de padrões incrivelmente poderosos, mas não "entendem" as coisas como nós.
2. **A arquitetura importa mais do que nunca** — Uma arquitetura ruim com LLMs não apenas quebra, ela quebra de forma imprevisível.
3. **Especialização vence a generalização** — Tanto para agentes quanto para os sistemas que os contêm.
4. **Supervisão humana é inegociável** — Por mais autônomo que seja o seu sistema, mantenha humanos no circuito (*human-in-the-loop*) para decisões críticas.
5. **O ciclo do hype é real** — Ignore o barulho de "A IA vai substituir os desenvolvedores". Construa coisas úteis. Resolva problemas reais.

## O Que Vem a Seguir para o Navi

Ainda estou no início dessa jornada. A arquitetura está se estabilizando, mas ainda há muito código para escrever e decisões para tomar, como:

- Sandbox
- Gerenciamento de memória com *vector stores* (bancos de dados vetoriais)
- Camadas de segurança contra *prompt injection*
- Observabilidade para as interações entre agentes
- Fluxos de trabalho de autocura (*self-healing workflows*)
- Interfaces *human-in-the-loop*

Mas a fundação é sólida. E é sólida porque a projetei em torno dos pontos fracos dos LLMs, não de seus pontos fortes.

---

Se você está construindo com LLMs, eu adoraria ouvir suas histórias de trincheira. Quais erros de arquitetura você cometeu? O que funcionou? O que falhou miseravelmente?

Me dê um toque nos comentários, no [X](https://x.com/enrellsan) ou no [Discord](https://discord.gg/eNsMFGZU). E se você estiver curioso sobre o progresso do Navi, o [repositório no GitHub](https://github.com/enrell/navi) é onde toda a experimentação bagunçada acontece em público (ainda não há código lá, mas em breve terá).

Lembre-se: a infraestrutura sobrevive a bolhas. O hype não.
