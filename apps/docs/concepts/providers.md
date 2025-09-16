---
outline: deep
---

# Providers

There are many ways to register your services for dependency injection.

## Terminology

It's important to understand the terminology here:

- A **service** (or **value**) is the actual thing that the DI container should create;
- A **token** is the unique reference to that service;
- A **provider** states how the service should be created.

::: details Check an example
```ts twoslash
import { Container } from "@needle-di/core";
import { FooService } from "./foo.service";

const container = new Container();

container.bind({
  provide: FooService,
  useFactory: () => new FooService(),
});
```

In this case, `FooService` is the **token**, `new FooService()` is the **service** (or **value**), and the
`useFactory` function is the **provider** that states how this service will be created.
:::

## Types of providers

There are different types of providers.

### Class providers

A class provider refers to a class constructor, which will be used construct a new instance.

```ts
container.bind({
  provide: Logger,
  useClass: Logger,
});
```

This example can also be written with the shorthand:

```ts
container.bind(Logger);
```

This will register a singleton for `Logger` that gets lazily constructed.

Note that `useClass` may also refer to a child class of `Logger`:

```ts
container.bind({
  provide: Logger,
  useClass: FileLogger,
});
```

Check out [inheritance support](/advanced/inheritance) for more information.

### Value providers

A value provider refers to a static value.

```ts
container.bind({
  provide: MyService,
  useValue: new MyService(),
});
```

This will bind the provided value to the token. This value will act as a singleton and will be reused.
Note that this value is created, regardless whether it is used.

### Factory providers

A factory provider refers to a factory function, which will only be invoked when this token gets injected for its first
time.
This makes it ideal for lazy evaluation.

```ts
container.bind({
  provide: MyService,
  useFactory: () => new MyService(),
});
```

The value returned by the function will act as a singleton and will be reused.

Note that you can use the `inject()` function inside this factory function, allowing you to inject other dependencies:

```ts
container.bind({
  provide: MyService,
  useFactory: () => new MyService(inject(FooService), inject(BarService)),
});
```

It is also possible to access the container, which is passed to the `useFactory` function:

```ts
container.bind({
  provide: MyService,
  useFactory: (container) =>
    new MyService(container.get(FooService), container.get(BarService)),
});
```

### Existing providers

An existing provider is a special provider that refers to another provider, by specifying its token.
This basically works like an alias. This can be useful for inheritance or [injection tokens](/concepts/tokens).

```ts
container.bind({
  provide: MyValidator,
  useClass: MyValidator,
});

container.bind({
  provide: VALIDATOR,
  useExisting: MyValidator,
});
```

In this case, both `inject(MyValidator)` and `inject(VALIDATOR)` would inject the same instance.


