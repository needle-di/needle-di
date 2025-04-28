# Tokens

An injection token is a reference to a service in the dependency injection (DI) container. This token is used 
to bind something to the container, and to obtain something from the container.

Needle DI allows you to use many different types of tokens.

## Class constructor reference

When the service that you provide is a class, you can use its constructor reference as a token.

```ts
container.bind({
  provide: FooService,
  useValue: new FooService(),
});
```

However, this is not always a viable option. For example, if you want to provide a primitive value or an object literal,
using a class reference as token is not allowed.

Therefore, Needle DI offers some alternatives.

> [!NOTE]
> Note that TypeScript interfaces only exist compile-time, and therefore **cannot** be used as an injection token.

## `string` and `symbol`

You can also use any `string` or `symbol` as injection token:

```ts twoslash
import { Container } from "@needle-di/core";
import { MyConfig } from "./my-config";

// create some tokens
const MY_CONFIG = "my-config";
const MY_MAGIC_NUMBER = Symbol("my-magic-number");

const container = new Container();

// bind some values using providers
container.bind({
  provide: MY_CONFIG,
  useValue: {
    foo: "bar",
  },
});

container.bind({
    provide: MY_MAGIC_NUMBER,
    useValue: 42,
});

// retrieve the values by their tokens
const myConfig = container.get<MyConfig>(MY_CONFIG);
const myNumber = container.get<number>(MY_MAGIC_NUMBER);
```

> [!WARNING]
> When using a `string` or `symbol` as token, Needle DI will not be able to infer its associated type, unless you 
> provide the generic type yourself (as shown in the example above).
>
> Note that this can easily lead to inconsistency and mistakes.

## `InjectionToken<T>`

Instead of `string` or `symbol`, a better alternative is to construct an instance of `InjectionToken<T>`. This is
basically a unique token object, that is used by reference.

> [!TIP]
> When using TypeScript, this token can also hold a generic type. This enables better type-checking.

```ts twoslash
import { Container, InjectionToken } from "@needle-di/core";
import { MyConfig } from "./my-config";

// create some injection tokens
const MY_NUMBER = new InjectionToken<number>("MY_NUMBER");
const MY_CONFIG = new InjectionToken<MyConfig>("MY_CONFIG");

const container = new Container();

// bind some values using providers
container.bind({
  provide: MY_NUMBER,
  useValue: 42, // should satisfy `number`
});

container.bind({
  provide: MY_CONFIG,
  useValue: { foo: "bar" }, // should satisfy `MyConfig`
});

// retrieve the values by their tokens
const myNumber = container.get(MY_NUMBER);
//     ^? Type will be inferred as `number`


const myConfig = container.get(MY_CONFIG);
//     ^? Type will be inferred as `MyConfig`
//
```

This maximizes type-safety since both `container.bind()`, `container.get()` and `inject()` will check and infer the
types associated with the injection token.

This is not the only benefit: it also enables [tree-shakable injection tokens](/advanced/tree-shaking).
