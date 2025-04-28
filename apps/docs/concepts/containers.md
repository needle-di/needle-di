# Containers

## Creating a container

The dependency injection (DI) container will keep track of all bindings and hold the actual instances of your services.
To create it, simply construct one:

```ts twoslash
import { Container } from "@needle-di/core";

const container = new Container();
```

Every DI container keeps track of its own service instances separately.

## Binding services

You can bind services using the `.bind()` or `.bindAll()` methods:

```ts
container
  .bind(FooService)
  .bind({
    provide: BarService,
    useFactory: () => new BarService(),
  });

container.bindAll(
  {
    provide: Logger,
    useFactory: () => new FileLogger(),
  },
  {
    provide: AppConfig,
    useValue: someConfig,
  },
);
```

Learn more about the different types of [providers](./providers) you can use for binding.

## Bootstrapping

### Using `.get()`

To request a service from the container, you can use the `.get()` method:

```ts twoslash
import { Container } from "@needle-di/core";
import { FooService } from "./foo.service";

const container = new Container();
const fooService = container.get(FooService);
//     ^?
```

This will either create a new `FooService`, or return the existing one if requested before.

### Using `bootstrap()`

If you don't need to interact with the DI container at all, you can also use the `bootstrap()` shorthand function
instead. This will internally create a new container and return the requested service directly:

```ts twoslash
import { bootstrap } from "@needle-di/core";
import { BarService } from "./bar.service";

const barService = bootstrap(BarService);
//     ^?
```

This is useful if you solely depend on [auto-binding](/concepts/binding#auto-binding)
and/or [tree-shakeable injection tokens](/advanced/tree-shaking) and therefore don't need to register anything manually
into your container.

Similarly, there is a `bootstrapAsync()` method when using [async providers](../advanced/async-injection.md).

> [!WARNING]
> Calling `bootstrap()` or `bootstrapAsync()` creates a new container everytime, leading to the creation
> of new instances for your singleton services. Make sure to only call it once in the lifecycle of your
> application to use it efficiently.

## Creating child containers

You can also create a child container, which can be used to override a provider without affecting its parent.

To do so, use the `.createChild()` method:

```ts twoslash
import { Container } from "@needle-di/core";
import { LOGGER, MyLogger, OtherLogger } from "./logger";

const parent = new Container();
parent.bind({ provide: LOGGER, useClass: MyLogger });

const child = parent.createChild();
child.bind({ provide: LOGGER, useClass: OtherLogger });
```

See [child containers](../advanced/child-containers.md) for more information.
