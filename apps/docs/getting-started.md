---
outline: deep
---

# Getting started

## Installation

Just install it using your favorite package manager.

Needle DI is published to [NPM](https://www.npmjs.com/package/@needle-di/core) and [JSR](https://jsr.io/@needle-di/core), 
and is also compatible with [Deno](https://deno.com/).

::: code-group
```bash [npm]
npm install @needle-di/core
```

```bash [yarn]
yarn add @needle-di/core
```

```bash [pnpm]
pnpm install @needle-di/core
```

```bash [deno]
deno add jsr:@needle-di/core
```
:::

## Transpiler settings

Needle DI uses native [ECMAScript decorators](https://github.com/tc39/proposal-decorators), which are currently in
[stage 3] of the TC39 standardization process.

[stage 3]: https://github.com/tc39/proposals#stage-3

If you're using Deno, you can run your code as-is. However, when running on Node.js or in a browser,
you might need to transpile your code first, as your runtime might [not have implemented it yet](https://github.com/tc39/proposal-decorators/issues/476).

Make sure to use `ES2022` or lower as target:

::: code-group
```json [tsc (tsconfig.json)]
{
  "compilerOptions": {
    "target": "ES2022"
  }
}
```

```javascript [vite (vite.config.mjs)]
export default defineConfig({
  esbuild: {
    target: 'es2022',
    // ...
  },
  // ...
});
```

```bash [esbuild]
esbuild app.js --target=es2022
```
:::


## Basic example

Here’s a simple example using constructor injection to inject one service into another.

```ts twoslash
import { injectable, inject } from "@needle-di/core";

@injectable()
class FooService {
    // ...
}

@injectable()
class BarService {
  constructor(private fooService = inject(FooService)) {}
  //                  ^?
}
```
As you can see, Needle DI uses default parameter values for constructor injection.

The `@injectable` decorator eliminates the need to register services manually. 

## Bootstrapping

To bootstrap the `BarService`, you have to create a new dependency injection container, and use the
`.get()` method on it to retrieve it by its token:

```ts twoslash
import { injectable, inject, Container } from "@needle-di/core";
import { BarService } from "./bar.service";

const container = new Container();

// you can use container.bind() to register more services.

const barService = container.get(BarService);
//     ^?
```

That's it!

## What's next?

Learn how you can use [binding](/concepts/binding) to register services.
