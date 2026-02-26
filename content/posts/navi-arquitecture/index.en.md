---
date: '2026-02-23'
lastmod: '2026-02-23'
author: 'enrell'
tags: ['navi', 'go', 'hexagonal-architecture', 'ai']
categories: ['Go', 'Navi']
draft: false
title: "Defining the architecture decisions of Navi"
description: 'In this post I want to share some architectural decisions about my AI orchestrator project called Navi'
---

It was 3 AM when I had the idea for Navi a few months ago. I was in bed thinking about the impact of LLMs on developers' hard skills. Before the LLM boom, I improved my coding skills by building projects for my own use. But when OpenAI launched GPT-3, I saw that this technology could be useful. I spent a lot of time playing with GPT-3 code generation, and I remember the feeling I had when I used it to learn OOP. I was like, "What the F*! How the f* do these guys do that?" That was the spark that made my hyperfocus kick in to study the area.

I studied the basics to understand all model architectures, and recently I completed the Information Retrieval and Artificial Intelligence course in college. Now I have solid knowledge to start understanding the present and future of LLMs.

In this article, I will present the architectural decisions behind Navi, and some useful insights about agent strengths and weaknesses based on my humble LLM knowledge.

## The difference between agents and agency

Look, I've been deep in the AI space for a while now, and I can tell you one thing: **everyone throws around the word "agent" like it's going out of style**. But here's the thing — an agent by itself? It's just a fancy function call with commitment issues.

Let me break it down with something real. Imagine you have a single AI model that can answer questions. Cool, right? That's an **agent**. It's reactive. You ask, it answers. You prompt, it responds. Nothing wrong with that — but it's not exactly... autonomous.

Now, what if that same AI could **decide** when to search the web, **choose** to call a database, and **opt** to save results somewhere? Still an agent. But the moment you connect multiple agents together, give them roles, responsibilities, and a way to communicate?

That's when you have an **agency**.

### The Solo Agent Trap

I've seen this mistake too many times. Developers build a "super agent" that tries to do everything:

```go
// Don't do this
func (a *Agent) HandleEverything(input string) string {
	// Check if it needs to search
	// Check if it needs to calculate
	// Check if it needs to save
	// Check if it needs to call API
	// ...you get the idea
}
```

This is what I call the "god agent" pattern. It works for demos, but falls apart in production. Why? Because **single agents lack perspective**. They're trying to be everything at once.

### The Agency Approach

An agency is different. Think of it like a team:

```go
// This is the way
type Agency struct {
	Planner    *Agent // Decides the steps
	Researcher *Agent // Searches and gathers info
	Coder      *Agent // Writes and reviews code
	Executor   *Agent // Runs tools and APIs
}
```

Each agent has a **single responsibility**. The planner doesn't code. The coder doesn't execute. The executor doesn't plan. They specialize, communicate, and together they solve problems that would overwhelm any single agent.

### Why This Matters for Navi

When I started designing Navi, I made the agent mistake first. I built a monolithic agent that tried to handle orchestration, tool execution, memory management, and response formatting all at once.

It was a mess.

The breakthrough came when I realized: **Navi isn't an agent. Navi is an agency.** It's a system where specialized agents work together, each with clear boundaries and purposes.

| Aspect          | Agent               | Agency                   |
|-----------------|---------------------|--------------------------|
| Scope           | Single task         | Coordinated workflow     |
| Decision Making | Reactive            | Strategic + Reactive     |
| Failure Mode    | All or nothing      | Graceful degradation     |
| Scalability     | Limited             | Horizontal               |
| Maintenance     | Hard to debug       | Clear responsibility     |

The moment you understand this difference, your entire approach to AI orchestration changes. You stop asking "How do I make my agent smarter?" and start asking "How do I make my agents work better together?"

That's the foundation Navi was built on.

## LLM Weaknesses

I love this tech. I studied it. I built with it. I'm building **Navi** on top of it. But here's the thing I learned the hard way: if you don't understand where LLMs break, you're not building infrastructure — you're building a house of cards.

Let me share what I discovered after countless debugging sessions at 4 AM.

### The Context Wall That Nobody Talks About

Everyone celebrates bigger context windows like we solved everything. Cool, but here's what actually happens: your model starts forgetting stuff before it even hits the limit.

I was building this feature where Navi needed to remember conversation history plus tool results plus system instructions. Sounds simple, right? Well, around token 8,000 on a 32K model, things got weird. The model would:

- Ignore instructions I placed at the beginning
- Start giving generic answers
- Hallucinate more frequently
- Lose track of constraints

It's like when you study for 8 hours straight and by hour 7 you're just... reading words without absorbing anything.

```go
// What I thought would work
func BuildContext(history, tools, instructions string) string {
	return instructions + history + tools // Simple concatenation, right?
}

// What actually happens inside the model
// Attention dilution = 📉
```

The lesson? **More context ≠ more intelligence**. Sometimes more context = more confusion.

### The Confidence Problem

LLMs have no idea when they're wrong. None. Zero. They'll tell you the most confidently incorrect answer with 99% certainty.

I built a test where I asked the same question 100 times with slight variations. The model would give contradictory answers, each time sounding absolutely certain. That's when it hit me: **confidence ≠ correctness**.

```go
type LLMResponse struct {
	Answer     string
	Confidence float64 // This number means nothing
	IsCorrect  bool    // The model doesn't know this
}
```

If you're building systems that execute code, handle money, or touch security — and you're trusting self-reported confidence — buddy, you're gonna have a bad time.

### The Memory That Isn't There

LLMs don't have memory. They don't learn from conversations. They don't update their knowledge. After every response, it's like they're born again — pure amnesia with swagger.

Everything you think is "memory" is actually built by the developer. Without external memory architecture, you have a goldfish with a PhD. Brilliant, but forgets everything in 3 seconds.

### The Generalist Trap

LLMs know everything and nothing at the same time. Ask about Kubernetes, quantum physics, anime plot lines, and medieval history in the same conversation? No problem. But dig deeper on any single topic, and you'll find the limits.

They're statistical generalists. Pattern matchers on steroids. Which is incredible for breadth, but dangerous when you need depth.

I learned this when I was vibe coding with active reviewing using Claude Opus models. It was generating code that looked perfect but had subtle bugs. The model knew the syntax, understood the pattern, but missed the edge cases because it doesn't actually *understand* code — it predicts tokens based on patterns it's seen.

### The Hallucination Reality

Let's be clear: **hallucination isn't a bug, it's a feature**. Well, not really a feature, but an inevitable byproduct of how these models work. They predict tokens probabilistically. Sometimes that prediction is wrong. And they have zero idea when it happens.

What makes it worse:
- Ambiguous instructions
- Conflicting context
- Too much information
- Questions about things that don't exist

```go
// The scary part
response := model.Ask("Something that doesn't exist")
fmt.Println(response)              // Returns something plausible
fmt.Println(model.KnowsItsWrong()) // false - method doesn't exist
```

### Why Multi-Agent Systems Actually Matter

So why all this talk about weaknesses? Because understanding them changes everything about how you build.

Most people think multi-agent systems are about speed. Parallelization. Getting things done faster. They're wrong.

**It's about cognitive distribution.**

When I split Navi into specialized agents, something interesting happened:

| Single Agent               | Agency                          |
|----------------------------|---------------------------------|
| Context dilution           | Focused context per agent       |
| High hallucination rate    | Lower per-agent hallucination   |
| Hard to debug              | Clear failure boundaries        |
| Generic responses          | Specialized outputs             |
| Everything fails together  | Graceful degradation            |

Each agent operates in a smaller cognitive scope. Smaller scope means less confusion, better instruction adherence, and easier debugging.

```go
// Before: One agent trying to do everything
type GodAgent struct {
	// Planning
	// Research
	// Coding
	// Execution
	// Verification
	// Memory
	// Everything...
}

// After: Specialized agents
type Agency struct {
	Planner    *Agent // Just plans
	Researcher *Agent // Just researches
	Coder      *Agent // Just codes
	Executor   *Agent // Just executes
	Verifier   *Agent // Just verifies
}
```

An agency isn't necessarily faster by default. **It's more stable.** Speed is a side effect. Stability is the goal.

## The Hexagonal Architecture Decision

The AI landscape is in constant flux. New API versions, model capabilities, providers, and technologies emerge every month.

So how does this connect to architecture? Simple: if LLMs are inherently volatile and the AI field evolves so rapidly, your architecture needs to be decoupled to protect your system from these shifts.

Hexagonal architecture (ports and adapters) gives me:

- **Clear boundaries** between LLM logic and business logic
- **Testable interfaces** without calling actual models
- **Swappable implementations** (swap implementations without changing core)
- **Isolation** of hallucination-prone components

```go
// Port: What the LLM can do
type LLMPort interface {
	Generate(ctx context.Context, prompt Prompt) (Response, error)
	Embed(ctx context.Context, text string) (Vector, error)
}

// Adapter: How we actually do it (OpenAI, Anthropic, local, etc.)
type OpenAIAdapter struct {
	client *openai.Client
}

// Core: Business logic that doesn't care which LLM
type Orchestrator struct {
	llm LLMPort
	// Doesn't know or care about the implementation
}
```

This isn't just clean code — it's survival. Let me be real about what can change in the next 12 months:

- **Technology changes** — OpenAI changes their API. Anthropic launches a new protocol. Your architecture determines if this is a Tuesday afternoon config update or days of rewrites.
- **Fallback scenarios** — OpenAI goes down. Rate limits hit. Your API key gets throttled. Hexagonal architecture means your orchestrator doesn't care — it just calls the port, and the adapter handles the failover.
- **Hybrid deployments** — Some agents run locally for privacy, others in the cloud for power. Some use OpenAI, others use Claude, others use open-source models you host yourself. Same interface, different adapters.

```go
// The orchestrator doesn't know or care
type Orchestrator struct {
	llm LLMPort
	// Could be OpenAI
	// Could be Anthropic
	// Could be your local Ollama instance
	// Could be a load balancer across 5 providers
	// Doesn't matter. Interface stays the same.
}
```

This is why hexagonal architecture isn't overengineering — it's acknowledging that **the LLM landscape will change**. The question isn't if you'll need to adapt. It's whether your architecture lets you adapt in hours or months.

## What I Learned

1. **LLMs are tools, not thinkers** — They're incredibly powerful pattern matchers, but they don't "understand" like we do.
2. **Architecture matters more than ever** — Bad architecture with LLMs doesn't just break, it breaks unpredictably.
3. **Specialization beats generalization** — Both for agents and for the systems that contain them.
4. **Human oversight is non-negotiable** — No matter how autonomous your system is, keep humans in the loop for critical decisions.
5. **The hype cycle is real** — Ignore the "AI will replace developers" noise. Build useful things. Solve real problems.

## What's Next for Navi

I'm still early in this journey. The architecture is stabilizing, but there's still so much code to write and decisions to make, like:

- Sandbox
- Memory management with vector stores
- Security layers against prompt injection
- Observability for agent interactions
- Self-healing workflows
- Human-in-the-loop interfaces

But the foundation is solid. And it's solid because I designed it around LLM weaknesses, not their strengths.

---

If you're building with LLMs, I'd love to hear your war stories. What architectural mistakes did you make? What worked? What completely failed?

Hit me up in the comments, on [X](https://x.com/enrellsan) or [Discord](https://discord.gg/eNsMFGZU). And if you're curious about Navi's progress, the [GitHub repo](https://github.com/enrell/navi) is where all the messy experimentation happens in public (there's no code yet, but soon).

Remember: infrastructure survives bubbles. Hype doesn't. Build the former.
