---
date: '2026-02-23'
lastmod: '2026-02-23'
author: 'enrell'
tags: ['navi', 'openclaw', 'ai-orchestrator', 'go', 'hexagonal-architecture', 'ports-and-adapters']
categories: ['AI Orchestrators', 'Go Programming', 'Software Architecture']
draft: false
title: 'Making Navi a truly useful and secure AI orchestrator'
description: 'Navi is a powerful, high-performance AI orchestrator built with Go that supports multiple interaction modes: TUI, API, and messaging bots (Discord, Telegram). It features a hexagonal architecture (Ports and Adapters) for maximum flexibility and testability.'
---

# Hello world guys!

The TL;DR is: I tested openclaw and other AI orchestrators and they always follow the same pattern:

> They are built as a product for sale, not as an open-source project for the community. They are built for the hype and by the hype, with a generic idea of agency, a product that has a bunch of features, skills, etc., but in the end, they are not that useful because they are not created to solve real problems, but for sale, for hype, marketing, and to sell subscriptions from big techs.

That's why OpenAI hired Peter Steinberger, a classic acqui-hire to have a way to sell their API keys and subscriptions, not to solve real problems.

I can cite examples of projects that follow the same pattern:

- Windsurf
- Adept
- Covariant

All hyped as "next generation of agents/coding/robotics". Google, Amazon and Meta do licensing and take founders/team.

Result: startups become "ghost company" or skeleton crew. Employees cry in all-hands, product dies or becomes irrelevant, while the team goes to work for big tech's models/cloud.

# The Navi differential

I raised useless points about openclaw, you must be wondering, why am I trashing openclaw, and not other AI orchestrators, and the answer is simple, because openclaw is the most popular, the most hyped, the most sold, and the most used, and therefore it is the best example to illustrate. Who is in the tech bubble and has never heard of openclaw in the last weeks is living in a cave.

I don't deny that I am in a bubble, and that LLMs are a bubble, that can burst at any moment, and that the AI winter will come sooner or later. But what I want to say is that, even if it is a bubble, and even if the hype is big, and even if big techs are investing heavily, some companies will survive, open-source models will continue to exist, because there is actually real value, there is real demand, it's just not the kind of value and demand that big techs are selling, but a more niche, more specific, more real, more useful value and demand, and that is what Navi aims to survive the bubble burst.

I believe the bubble will burst, and the companies that survive will be those that really deliver value, whether it's a product, a service, or base models.
LLM is a technology that has utility, mainly in these areas (not in order):

## The usefulness of agents

Never been so easy to get a project off the ground. Test ideas, learn a new framework or just do some "vibe coding" to see if a product stands up got bizarrely fast. The trap here is for those who just copy and paste without understanding what's going on under the hood. (If you want to escape this and learn something useful, see this post: how to use LLMs correctly).

Customer support without headaches. Forget those dumb bots from the old days. An intelligent agent integrated into WhatsApp or internal systems solves 60% to 80% of daily headaches 24/7. I have friends who have worked in support and the real is one: 90% of problems are trivial things, often from elderly people or those with zero digital literacy. AI solves this without sweating.

Sales and Marketing at scale (without sounding like a robot). You can automate from lead qualification (SDR agents) to cart recovery and call analysis. It's generating content and sending personalized emails en masse, but that still sound natural.

Finding things in your own company (the famous RAG): You know that huge legacy documentation or internal policies that no one knows where they are? Put an internal chat pointing to it. If well implemented, documenting and querying company knowledge becomes trivial.

Cybersecurity and Blue/White Hats: Analyzing logs by hand is boring and repetitive. A well-tuned model can chew logs, detect threats, do a superficial pentest and generate a report real quick. It's an absurd helping hand for those working in security and need to reduce incident response time.

Despite all the benefits agents bring, most people have an exaggerated view of agents, most of the time they give superpowers that these agents shouldn't have. The trick is to think that agents solve everything, and it couldn't be more wrong, they should be part of the process, not take the entire process for themselves.

## The security

One of the saddest things in the current tech bubble is security neglect, it doesn't need to be enterprise level, but it should be solid, have the minimum responsibility.
Don't be like certain devs, don't upload a hobby project with open doors, credentials in plaintext and one-click Remote Code Execution, even explicitly warning several times is not enough, it's the recipe for disaster.

## Navi project

After this extensive venting it's time to talk about the project that has been pulsing in my mind, Navi. The idea came years ago as a personal project (clearly I'm late right? XD), I always sought automation in my development environment, be it self-hosted applications, CLI tools, and automation scripts, but I was never satisfied with how automation was done, and I discovered why.

Task automation on Linux is extremely decentralized, which means we have many automation tools, but they don't communicate natively and standardized. You have a bash script for one thing, a cronjob for another, and several excellent CLI tools that require you to make ugly "glue code" to make one talk to the other. The tools don't talk to each other, and they shouldn't for security reasons.

Navi is born exactly to be that link, the conductor of this orchestra, but with a golden rule: control is always yours and security is non-negotiable. He is not a "magical autonomous agent" that will run a rm -rf / because he hallucinated in the middle of a task or misinterpreted a loose prompt.

The name came from NAVI a computer from the anime [Serial Experiments Lain (1998)](https://anilist.co/anime/339/serial-experiments Lain/) one of my favorite animes, I recommend watching, it is dense, intellectual and philosophical, anyway, this computer is used by the protagonist `Lain` to access the Wired (the ultra-advanced global network of the anime, kind of an internet that mixes virtual reality, collective consciousness and much more). NAVI is the set of hardware + software to access the wired. It has a navigation and voice interface.

NAVI: 
![navi screen](navi-1.png) 

She does an insane upgrade on NAVI:
![navi screen](navi-2.png)

> The purpose of Navi is to be a useful, secure AI orchestrator for the tech/dev community.

# Navi's Architecture
To ensure the project is robust, scalable and, above all, testable, I chose to write Navi in Go. Besides delivering absurd performance and compiling everything into a single binary (which makes life much easier on Linux), Go allows me to handle concurrency in a very elegant and direct way.

The project is based on Hexagonal Architecture (Ports and Adapters).

This means that Navi's core intelligence and orchestration is completely isolated from external tools and interfaces. If tomorrow I want to change the LLM provider, the local database, or the way it executes a script on my operating system, I just write a new "adapter". The business logic remains intact and isolated from side effects.

## How do you interact with it?

As I said at the beginning, Navi doesn't trap you with a heavy proprietary web interface that tries to push you a subscription, or an agent that will expose your credentials. It was designed to have multiple entry points (the Ports of our architecture):

> TUI (Terminal User Interface): For those who live in the terminal (and those who use Neovim and a window manager like Sway know the value of not having to take their hand off the keyboard), having a fast, beautiful, and responsive interface right in the console is essential.

> REST/gRPC API: If you want to integrate Navi into another system, create your own frontend, or trigger webhooks from other applications, the door is open.

> Messaging Bots: Native integration with Discord and You can trigger automations on your server or home machine by sending a message from your phone, authenticated and securely.

The roadmap is still being drawn, and the core is being developed. The idea is to build something open-source, focusing on solving real productivity and system orchestration problems, without selling your soul to the hype.

Soon I'll release the repository on GitHub for those who want to take a look at the code (or give some pointers in the PRs). Until then, keep coding!

-- Present day, present time! hahahahaha
