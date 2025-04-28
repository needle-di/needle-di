
# Optional injection

By default, when you try to inject something that isn't provided, Needle DI will throw an error.

Alternatively, you can use optional injection, by passing `{ optional: true }`. Instead of throwing an error, it will
now return the requested service, or `undefined` if not found:

```ts twoslash
import { inject } from "@needle-di/core";
import { FooService } from "./foo.service";
import { BarService } from "./bar.service";

class MyService {
  constructor(
    private fooService = inject(FooService),
    private barService = inject(BarService, { optional: true }),
    //      ^? Type will be inferred as `BarService | undefined`
  ) {}
}
```

## Outside the injection context

When you construct an instance of `MyService` manually outside the injection context, and you don't pass any argument
for an optional dependency, the `inject()` function will not throw an error, but gracefully return `undefined` instead:

```ts twoslash
import { inject } from "@needle-di/core";
import { BarService } from "./bar.service";

class MyService {
    constructor(
        private barService = inject(BarService, { optional: true }),
    ) {}
}
const myService = new MyService(); // "barService" will be undefined.
```
