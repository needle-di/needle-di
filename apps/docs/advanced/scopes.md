---
description: "Control how widely an instance is shared across a container tree with Scope.ROOT and Scope.CONTAINER."
---

# Scopes

A **scope** describes how widely an instance is shared, by deciding which container an
[auto-bound](/concepts/binding#auto-binding) provider is registered on.

That has a second consequence: a provider is always resolved by the container that owns it, so the scope also decides
which container the **dependencies** of that service are resolved against.

| Scope             | Registered on               | Instances              |
| ----------------- | --------------------------- | ---------------------- |
| `Scope.ROOT`      | the root container          | one per container tree |
| `Scope.CONTAINER` | the container requesting it | one per container      |

Scopes are relevant only when you use [child containers](/advanced/child-containers). Without them, every container is
its own root and both scopes behave identically.

## `Scope.ROOT`

This is the default. An annotated class or a token factory is auto-bound on the root container, so the entire container
tree shares a single instance:

```ts twoslash
import { Container, injectable } from "@needle-di/core";

@injectable()
class UserService {
  // ...
}

const app = new Container();
const child1 = app.createChild();
const child2 = app.createChild();

child1.get(UserService) === child2.get(UserService); // true
child1.get(UserService) === app.get(UserService); // true
```

Note that it does not matter which container asks first: even though `app` never requested `UserService` itself, the
instance was created there. This is what makes the result independent of the order in which your code happens to run.

The same applies to injection tokens that carry a [factory](/advanced/tree-shaking#tree-shakeable-injection-tokens):

```ts twoslash
import { Container, InjectionToken } from "@needle-di/core";

const NOW = new InjectionToken<Date>("NOW", {
  factory: () => new Date(),
});

const app = new Container();

app.createChild().get(NOW) === app.createChild().get(NOW); // true
```

## `Scope.CONTAINER`

With `Scope.CONTAINER`, the service is auto-bound on the container that requests it, so every container constructs its
own instance. Since that instance is now owned by the requesting container, it also sees the bindings of that container:

```ts twoslash
import {
  Container,
  InjectionToken,
  inject,
  injectable,
  Scope,
} from "@needle-di/core";

interface Database {
  query(sql: string): void;
}

const DATABASE = new InjectionToken<Database>("DATABASE");

@injectable({ scope: Scope.CONTAINER })
class UserRepository {
  private database = inject(DATABASE);
}

const app = new Container();
app.bind({ provide: DATABASE, useValue: { query: () => {} } });

// a child container that swaps the database for a transaction
const transaction = app.createChild();
transaction.bind({ provide: DATABASE, useValue: { query: () => {} } });

transaction.get(UserRepository); // uses the transaction, not the app database
```

Had `UserRepository` been root-scoped, it would have been created on `app` and kept the original database, even when
requested through `transaction`.

Injection tokens accept the same option:

```ts twoslash
import { InjectionToken, Scope } from "@needle-di/core";

const REQUEST_ID = new InjectionToken<string>("REQUEST_ID", {
  scope: Scope.CONTAINER,
  factory: () => crypto.randomUUID(),
});
```

> [!TIP] > `Scope.CONTAINER` gives every container its own instance, but only for containers that actually request the service. A
> container that never asks for it never constructs it.

## Scopes only apply to auto-binding

A provider you bind yourself is registered on the container you call `.bind()` on. There is nothing left for a scope to
decide, which is why providers do not accept one.

This also means an explicit binding always wins from auto-binding, anywhere in the tree:

```ts twoslash
import { Container, injectable } from "@needle-di/core";

@injectable()
class UserService {
  // ...
}

class FakeUserService extends UserService {
  // ...
}

const app = new Container();
app.bind({ provide: UserService, useClass: FakeUserService });

app.createChild().get(UserService); // a FakeUserService
```

Without that rule, the child would auto-bind `UserService` on the root and quietly ignore the override you registered on
purpose.

## Inheritance

When several classes are auto-bound under the same token, for example through
[inheritance](/advanced/inheritance), they must agree on a scope:

```ts twoslash
import { Container, injectable, Scope } from "@needle-di/core";

abstract class Logger {}

@injectable()
class ConsoleLogger extends Logger {}

@injectable({ scope: Scope.CONTAINER })
class FileLogger extends Logger {}

new Container().get(Logger, { multi: true });
// Error: Cannot auto-bind Logger, since the classes it resolves to declare
// different scopes: ConsoleLogger (root), FileLogger (container).
```

Their providers would otherwise end up on different containers, and since
[multi-providers are not merged across containers](/advanced/child-containers), whichever ended up higher in the tree
would silently disappear from the result. Requesting `ConsoleLogger` or `FileLogger` directly is unambiguous and keeps
working.

A class also never inherits the scope of the class it extends; annotate each class with the scope it needs.

## Migrating from v1

Before v2, auto-binding always happened on the container that requested the service, which is what `Scope.CONTAINER`
does now. Annotate a class or token with `Scope.CONTAINER` to restore that behaviour:

```ts twoslash
import { injectable, Scope } from "@needle-di/core";
// ---cut---
@injectable({ scope: Scope.CONTAINER }) // [!code ++]
class UserService {
  // ...
}
```

You only need this for services that rely on being re-created per child container, typically because they depend on a
token that a child overrides. If you do not use child containers at all, nothing changes.
