---
title: "I Deleted the Agent Framework: How Matrix Became a Kernel"
date: '2026-09-10'
lastmod: '2026-09-10'
author: 'enrell'
description: 'Matrix started as an agent runtime. It became interesting when I deleted the agents and made identity, time, authority, and cleanup part of composition.'
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

The first Matrix commit had a TUI, an `Agent`, a `Model`, a `Tool`, and even implementations named `EchoTool` and `CannedModel`.

Two days later, I deleted all of them.

Removing the classes that appear to define a project is usually a bad sign. Here it was the best decision I made. I was building two things at once: an agent application and the infrastructure that would keep its components alive. The result did neither job well.

Without the agent, I was left with the question that had actually been bothering me.

What happens to a call when the component on the other side is replaced while that call is in flight?

That question produced [Matrix](https://github.com/enrell/matrix) as it exists today: an experimental Rust kernel for composing local and remote components. Models, tools, memory, interfaces, and business rules stay outside it. Matrix handles the unglamorous part: identity, dependencies, authority, resources, and lifecycle.

## The Function Compiled. Now What?

At first I still thought of composition as matching interfaces. One plugin exposes a function; another calls it. The types line up, the program compiles, and life goes on.

But the call does not happen outside time.

While a component is working, its process may crash. Its credential may be revoked. The operator may install a new version. The connection may disappear without revealing whether the other host performed the effect. An old stream may arrive after another process has taken the same name.

The problem was no longer just “who provides this interface?” It became “which instance provided it when the operation was admitted, and is that authority still valid?”

That is what I mean by spatiotemporal composition.

Space is location: the same process, another local process, or another host. Time appears in generations. If `provider` restarts, the new `provider` may have the same logical name, but it is not the thing that died.

A Matrix reference carries the kernel epoch, instance identity, and generation. Knowing the name `provider` is not enough to manufacture a reference. It does not grant permission to call it either.

I know “spatiotemporal composition kernel” sounds like the sort of phrase someone writes before creating 48 traits and never running anything. So here is the bug that turned it from pretty architecture into a real constraint.

## The Chunk That Almost Reached the Wrong Process

In remote composition, the controller validates an instance and selects a session for calls, events, and streams. An earlier version carried the logical name too far down that path.

It roughly did this:

```text
validate provider generation 7
        ↓
store "provider"
        ↓
resolve "provider" again at delivery time
```

Generation 7 could leave between validation and delivery. Generation 8 would appear under the same name. When the code performed that second lookup, it found the new generation.

And there it was: an old chunk had a path to a process that had never participated in its operation.

The fix was not one more `if`. The validated reference had to survive all the way to session selection. No falling back to the logical name in the middle. If the instance is gone, delivery fails as stale. The new generation does not inherit the old one's mail.

That bug describes Matrix better than any diagram. “Does the component exist?” is a weak question. The useful one is “is this still the instance I was authorized to send this to?”

## I Did Not Want `Disposed` to Lie

Another choice that looks pedantic until it hurts is the `CleanupPending` state.

The current lifecycle follows this path:

```text
Registered → Waiting → Preparing → Active
    → Quiescing → CleanupPending → Disposed
```

`Waiting` means a required dependency is missing. `Quiescing` blocks new calls while the runtime drains or cancels admitted work. Nothing unusual so far.

The detail is that `Disposed` means managed resources were released. It does not mean “I stopped seeing the process.”

Suppose a remote component acquired a subscription and a task. Its host vanishes during withdrawal. Can I say those resources are gone? No. Can I say they still exist? Also no.

Marking it `Disposed` would invent certainty. Matrix stays in `CleanupPending` and records what remains unresolved.

The same reasoning applies to remote timeouts. If the connection fails at the wrong moment, “I received no response” does not mean “the operation did not run.” Matrix has an `outcome-unknown` result for that. The runtime does not helpfully retry a potentially irreversible effect.

Cancelling a task does not unsend the email it already sent either. Matrix manages timers, tasks, subscriptions, and other resources mediated by its hosts, but it does not sell magical rollback for external effects. Money, deployments, messages, and writes to another service need idempotency or compensation from the application domain.

That limit is part of the contract. Hiding it would be much more comfortable. It would also be wrong.

## The Timeout That Restarted Its Clock

Another bug changed how I looked at the transport layer.

I needed a total deadline for writing a frame. The obvious Linux solution seemed to be a socket timeout followed by `write_all`. There was one problem: partial progress could rearm the wait. The frame moved a little and received more time. The “total deadline” was not total.

The final implementation uses nonblocking sends, waits with `poll(POLLOUT)`, and compares everything against one absolute instant. If part of a frame was sent and the rest fails, the connection is poisoned and closed. Reusing it would leave the receiver staring at half a frame with no reliable boundary for the next one.

That detail sits far away from the phrase “local and remote plugins.” It is also where infrastructure promises tend to break.

I could have claimed deadlines in the README as soon as a `timeout` field existed. I chose to let an adversarial suite decide what the word meant.

## A Requested Dependency Is Not an Authorized Dependency

A component declares the capabilities it provides and the interfaces it needs. A consumer may request `provider.echo@1`, for example. That request grants nothing by itself.

The operator authorizes the edge between consumer and capability. At activation, the kernel supplies an opaque binding tied to the context and generation. If the provider disappears, affected consumers stop receiving admission. When it returns, it is a different instance and the bindings are rebuilt.

This separation blocks two shortcuts I do not want in the project. An SDK cannot silently choose “some other provider” because the original failed. And knowing a capability name cannot accidentally become authority.

Ownership is separate from the dependency graph. The context tree says what must be cleaned up together. The graph says who needs whom to stay active. Mixing them produces cascade shutdown logic that works until something is shared.

Components do not receive raw resource IDs to keep forever either. They receive handles tied to an owner. Repeated release is idempotent; releasing another activation's resource is rejected.

These rules are a little annoying. That is precisely the kernel's job: be annoying once so every application does not invent an incomplete version of them.

## The Multilanguage Part Grew Larger Than I Expected

Rust is the reference, but I never wanted “write a plugin” to mean “rewrite your project in Rust.” The protocol is the common contract. SDKs translate that contract into each language.

There are now paths for Rust, Python, JavaScript and TypeScript, Go, Crystal, Elixir, C#, C, and C++. C++ supplies RAII over the C transport. Go exposes cancellation through `context.Context`; JavaScript uses `AbortSignal`; C# uses `CancellationToken`. The vocabulary changes. Authority does not.

I expected framing to be the difficult part. It was not.

One C SDK bug came from using the wrong clock on a condition variable. The deadline was calculated with `CLOCK_MONOTONIC`, while the condition variable used `CLOCK_REALTIME`. The wait expired almost immediately and became a disguised spin loop. Tiny tests made it look fast. A 1.5-second inner call exposed the lie.

In Elixir, an intermediate mailbox turned a theoretically bounded queue into an actually unbounded one. In Crystal, waiting on the process closed its pipes, so stdout and stderr had to be drained before reaping. Every language found its own way to test whether “same semantics” was a serious claim or just a table full of green checks.

The harness crosses Python with JavaScript, Go with C#, Crystal with Elixir, and C with C++. It also builds a JavaScript → Go → Rust chain and sends one leg to another host. Components do not implement mTLS or leases; routing belongs to the managed service.

This does not make local and remote identical. Local uses IPC and process supervision. Remote involves mutual TLS, sessions, leases, fences, reconnection, and reconciliation. Business code uses the same model, while the runtime continues to admit that a network is a network and will do horrible things.

## What Actually Exists Today

Matrix is at `0.1.0` and remains experimental. There is no 1.0 stability promise.

The public contract includes the Rust `matrix_runtime::api` facade, the `matrix-managed` service and CLI, the `matrix-conform` checker, and the SDKs. An external harness builds an application outside the checkout and uses only packaged artifacts and public documentation. I added it because compiling inside a monorepo proves very little about adoption.

There is still a long list of “no”:

- only Linux x86_64 has been tested;
- registry publication is still in progress;
- browser, Deno, Bun, Windows, macOS, and WASM support are not claimed;
- the C SDK is an IPC client, not an ABI for embedding the kernel;
- there is no `exactly once` promise across hosts;
- I have not published performance numbers yet.

Rust does not prove isolation by itself. A large suite does not become a formal proof. And a working demo does not tell me whether the operational cost of the model is worthwhile in a real product.

That last point is what I want to find out now.

## Running It

Until packages finish reaching registries, the path starts by generating artifacts from the checkout:

```bash
git clone https://github.com/enrell/matrix.git
cd matrix
./scripts/package.sh
```

The `dist/` directory receives binaries, SDKs, and a manifest with hashes. Each SDK has its own scaffold. Instructions live in [`docs/INSTALL.md`](https://github.com/enrell/matrix/blob/master/docs/INSTALL.md).

The smallest demonstration runs with:

```bash
python3 scripts/demo-composition.py
```

It creates a Rust → Python chain, removes a dependency, and introduces it again. The interesting part is not that the echo arrives. It is watching the old generation lose validity and the consumer return only after receiving a new binding.

## The Question That Remains

In less than a week, Matrix went from an agent scaffold to a runtime with local, remote, and multilanguage composition. That was fast. Maybe too fast in places; the bugs above appeared when I stopped accepting test counts as an answer and began attacking the boundaries.

Now I want to use it in separate applications, measure latency and contention, and see which invariants actually pay for their cost. If I discover that half this architecture is unnecessary, great. I will delete half of it.

I already deleted the entire agent, and the project got better.
