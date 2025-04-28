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

> [!NOTE]
> If you bind a multi-provider in a child container, its singletons will not be merged with those from the parent. This
> is a current limitation, but if you have a strong use case, feel free to [submit an issue].

[submit an issue]: https://github.com/needle-di/needle-di/issues/new
