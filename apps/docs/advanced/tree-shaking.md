# Tree-shaking

Tree-shaking is an optimization technique used in JavaScript bundlers (like [esbuild], [Webpack] or [Rollup]) to remove
unused or dead code from the final bundle. Needle DI has been designed with this in mind.

[esbuild]: https://esbuild.github.io/api/#tree-shaking

[Webpack]: https://webpack.js.org/guides/tree-shaking/

[Rollup]: https://rollupjs.org/introduction/#tree-shaking

## Tree-shaking: how does it work?

It works by analyzing the `import` and `export` statements of modules and ensuring that
only the parts of code actually used in the application are included. By "shaking off" unused code, tree-shaking reduces
the
bundle size, improves load times, and enhances overall performance of the application.

## Tree-shakeable injection tokens

Let's imagine a library with a class `SomeHeavyClass` that depends on a lot of code, resulting in a larger bundle size.

Since we cannot decorate this class, the alternative is to bind it using
an [injection token](/concepts/tokens#injectiontoken-t):

```ts
import { InjectionToken, Container } from "@needle-di/core";
import { SomeHeavyClass } from "./some-heavy-library";

const MY_TOKEN = new InjectionToken<SomeHeavyClass>("MY_TOKEN");

const container = new Container();

container.bind({
  provide: MY_TOKEN,
  useFactory: () => new SomeHeavyClass()
});
```

However, this will **NOT** be tree-shaken; even when there are no references to `MY_TOKEN` and `SomeHeavyClass`. This is
because it is still referred by the container itself.

However, there also an option to provide a `factory` function in your `InjectionToken`,
removing the need to manually bind it to your container:

```ts
import { InjectionToken } from "@needle-di/core";

const MY_TOKEN = new InjectionToken<SomeHeavyClass>(
  "MY_TOKEN",
  { // [!code ++]
    factory: () => new SomeHeavyClass(), // [!code ++]
  } // [!code ++]
);

const container = new Container(); // [!code --]
// [!code --]
container.bind({ // [!code --]
  provide: MY_TOKEN, // [!code --]
  useFactory: () => new SomeHeavyClass() // [!code --]
}); // [!code --]
```

This effectively enables [auto-binding](/concepts/binding#auto-binding): since the token holds a factory function, the container will automatically
construct it when you obtain it for the first time.

But more importantly, this will make your token **tree-shakeable**: when there are no references to your injection
token, everything associated with your token will be removed from your bundle.

## When to use?

This is mainly relevant if you have multiple [entry points](https://esbuild.github.io/api/#entry-points) in the
same codebase, and you create separate bundles for each of them. Or, if you use code splitting (e.g. lazy loaded
modules/chunks) for dynamic imports.

However, using factory functions in injection tokens can also help you to organize your code in a more modular way.
