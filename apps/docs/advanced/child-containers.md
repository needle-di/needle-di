---
description: "Create child containers that inherit providers and singletons from their parent, and override or extend them."
---

# Child containers

A **child container** is a DI container that inherits all **providers** and **singletons** from its parent (or any
ancestor). However, it also allows you to **override specific providers** or define new ones independently.

## Example

```ts twoslash
import { Container } from "@needle-di/core";

import { LOGGER, MyLogger, OtherLogger } from "./logger";

const parent = new Container();
const child1 = parent.createChild();
const child2 = parent.createChild();

parent.bind({ provide: LOGGER, useClass: MyLogger });
child2.bind({ provide: LOGGER, useClass: OtherLogger });

const loggerA = parent.get(LOGGER); // `MyLogger`
const loggerB = child1.get(LOGGER); // `MyLogger` (same instance as parent)
const loggerC = child2.get(LOGGER); // `OtherLogger`
```

## Rules and behaviour

* **Singletons are shared** with child containers (or any descendant) **unless explicitly overridden**.
* **Singletons are created in the container where they were first bound**, even if they are accessed from a child
  container.
* **Auto-bound services are created on the root container** by default, so a class annotated with `@injectable()` or a
  token holding a factory is shared by the whole tree. Use [`Scope.CONTAINER`](/advanced/scopes#scope-container) to give
  every container its own instance instead.
* **An explicit binding always wins from auto-binding**, so binding a service on the parent is never shadowed by a child
  that requests it.

Since a service is resolved by the container that owns it, the container a service lives on is also the container its
own dependencies are resolved against. That is what [scopes](/advanced/scopes) control.

> [!NOTE]
> If you bind a multi-provider in a child container, its singletons will not be merged with those from the parent. This
> is a current limitation, but if you have a strong use case, feel free to [submit an issue].

[submit an issue]: https://github.com/needle-di/needle-di/issues/new
