---
date: '2026-02-23'
lastmod: '2026-02-23'
author: 'enrell'
tags: ['navi-agent', 'openclaw', 'go', 'hexagonal-architecture', 'ai']
categories: ['Go', 'navi-agent']
draft: false
title: "I'm building navi-agent: a truly secure and useful AI orchestrator | cry about it openclaw"
description: 'Rambling about a prototype I call navi-agent, which will be an AI orchestrator built in Rust supporting multiple interaction modes: TUI, API, and messaging bots (Discord, Telegram). It features a hexagonal architecture (ports and adapters) for maximum flexibility and testability.'
---

# Hello world guys!

The TL;DR is: I've tested openclaw and other AI orchestrators, and they always follow the exact same pattern:

> They are built as products to be sold, not as open-source projects for the community. They are created by the hype and for the hype, pushing a generic idea of "agency"—a bloated product with a bunch of features and skills that, at the end of the day, aren't even that useful. That's because they aren't built to solve real problems; they're built for marketing and to sell big tech subscriptions. 
That's exactly why OpenAI hired Peter Steinberger—a classic acqui-hire just to have another avenue to sell their API keys and subscriptions, not to solve actual problems.

I can name a few projects that follow this exact pattern:

- Windsurf
- Adept
- Covariant

All hyped up as the "next generation of agents/coding/robotics". Google, Amazon, and Meta swoop in with licensing deals and poach the founders/team.

The result? The startups turn into ghost companies or run on skeleton crews. Employees cry in all-hands meetings, and the product dies or fades into irrelevance while the team goes off to work on big tech clouds/models.

# navi-agent's differentiator

> navi-agent's purpose is to be a useful, secure agent orchestrator built for the tech/dev community.

I've pointed out some useless aspects of openclaw, and you might be wondering why I'm thrashing openclaw specifically instead of other AI orchestrators. The answer is simple: because openclaw is the most popular, the most hyped, the most sold, and the most used right now. It’s the perfect example. Anyone in the tech bubble who hasn't heard of openclaw in the last few weeks has been living under a rock.

I won't deny that I'm in a bubble, that LLMs form a bubble that could pop at any minute, and that an AI winter will arrive sooner or later. But my point is: even if it is a bubble, even with all the hype and massive big tech investments, some companies will survive and open-source models will stick around. That's because there *is* real value and real demand; it's just not the kind of value and demand big tech is trying to sell. It's a more niche, specific, real, and useful demand. And that’s navi-agent's goal: to survive the bubble bursting.

I believe the bubble will pop, and the companies that survive will be the ones actually delivering value, whether that's a product, a service, or foundation models.
LLMs are highly useful technologies, especially in these areas (in no particular order):

## The utility of agents

**Software Development:** It has never been easier to get a project off the ground. Testing ideas, learning a new framework, or just doing some "vibe coding" to see if a product holds up has become absurdly fast. The trap here is for those who just copy and paste without understanding what's going on under the hood. (If you want to avoid that and learn something useful, check out this post: *how to use LLMs the right way*).

**Headache-free Customer Support:** Forget those dumb bots from the past. A smart agent integrated into WhatsApp or internal systems handles 60% to 80% of the daily grind, 24/7. I have friends who have worked in support, and the reality is: 90% of issues are mundane things, often from the elderly or people with zero digital literacy. AI handles this without breaking a sweat.

**Sales and Marketing at scale (without sounding like a robot):** You can automate everything from lead qualification (SDR agents) to abandoned cart recovery and call analysis. It’s about generating content and sending personalized mass emails that actually sound natural.

**Finding things within the company (the famous RAG):** You know that massive legacy documentation or internal policies nobody knows where to find? Point an internal chat at it. If implemented well, documenting and querying company knowledge becomes trivial.

**Cybersecurity and Blue/White Hats:** Parsing logs by hand is boring and repetitive. A well-tuned model can chew through logs, detect threats, run superficial pentests, and generate reports in no time. It's an absolute lifesaver for security folks who need to reduce incident response times.

Despite all the benefits agents bring, most people have an exaggerated view of them and, more often than not, give them superpowers they shouldn't have. The catch is thinking that agents can solve *everything*. That couldn't be further from the truth: they should be *part* of the process, not take over the entire process.

## Security

One of the saddest things in the tech bubble right now is the sheer negligence regarding security. It doesn't need to be enterprise-grade, but it has to be solid; have a minimum level of responsibility. 
Don't be like certain devs: don't deploy a hobby project with open ports, plaintext credentials, and 1-click Remote Code Execution. Even explicitly warning people multiple times isn't enough—it's a recipe for disaster.

## The navi-agent project

After that extensive rant, it's time to talk about the project that's been pulsing in my mind: navi-agent. The idea came to me years ago as a personal project (I'm clearly late to the party, right? XD). I've always looked for ways to automate my dev environment, whether it was self-hosted apps, CLI tools, or automation scripts, but I was never satisfied with *how* the automation was done, and I figured out why.

Task automation, especially on Linux, is extremely decentralized. This means we have plenty of automation tools, but they don't communicate natively or in a standardized way. You have a bash script for one thing, a cronjob for another, and several excellent CLI tools that require you to write ugly "glue code" just to make them talk to each other. The tools don't talk to each other, and they shouldn't, for security reasons.

navi-agent was born exactly to be that link, the maestro of this orchestra, but with one golden rule: you are always in control, and security is non-negotiable. It's not a "magical autonomous agent" that will run `rm -rf /` because it hallucinated mid-task or misinterpreted a loose prompt.

The name comes from NAVI, a computer from the anime [Serial Experiments Lain (1998)](https://anilist.co/anime/339/serial-experiments-lain/). It's one of my favorite anime and I highly recommend it: it's dense, intellectual, and philosophical. Anyway, this computer is used by the protagonist, Lain, to access the Wired (the ultra-advanced global network in the anime, sort of like an internet that mixes virtual reality, collective consciousness, and much more). NAVI is the hardware + software bundle to access the Wired. It features both navigation-based and voice-based interfaces.

NAVI: 
![navi screen](navi-1.png) 

She does an insane upgrade to her NAVI:
![navi screen](navi-2.png)

# navi-agent's Architecture
To ensure the project is robust, scalable, and above all, testable, I chose to write navi-agent in Go. Besides delivering absurd performance and compiling everything into a single binary (which makes life on Linux so much easier), Go allows me to handle concurrency in a very elegant and straightforward way.

The foundation of the project follows the Hexagonal Architecture (Ports and Adapters).

This means navi-agent's core intelligence and orchestration are completely isolated from external tools and interfaces. If tomorrow I want to swap out the LLM provider, the local database, or how it executes a script on my OS, I just write a new "adapter". The business logic remains intact and isolated from side effects.

## How do you interact with it?

As I mentioned at the beginning, navi-agent doesn't lock you into a heavy, proprietary web UI that tries to shove a subscription down your throat, nor is it an agent that will expose your credentials. It was designed to have multiple entry points (the Ports in our architecture):

> **TUI (Terminal User Interface):** For terminal dwellers (and anyone who uses Neovim and a window manager like Sway knows the value of never having to take your hands off the keyboard), having a fast, beautiful, and responsive interface right in the console is essential.

> **REST/gRPC API:** If you want to integrate navi-agent into another system, build your own frontend, or trigger webhooks from other applications, the door is open.

> **Messaging Bots:** Native integration with Discord and Telegram. You can trigger automations on your server or your home machine by sending a text from your phone, in a secure and authenticated way.

The roadmap is still being drawn up, and the core is currently under development. The goal is to build something open-source, focusing on solving real productivity and system orchestration problems, without selling our souls to the hype.

I'll be dropping the GitHub repository soon for anyone who wants to take a look at the code (or chip in on the PRs). Until then, we keep coding!

-- Present day, present time! hahahahaha
