
# Lazy injection

Lazy injection allows you to defer the creation of services, by returning a function instead. When invoked, this function
will create the service on demand. Lazy injection could aso be a solution to enable circular dependencies.

## Usage

In order to use lazy injection, just pass `{ lazy: true }`:

```typescript
import { inject } from "@needle-di/core";

class MyService {
  constructor(
    private fooService = inject(FooService, { lazy: true }),
    //      ^? Type will be inferred as `() => FooService`
  ) {}
  
  public doSomething() {
    // invoking the function will trigger the creation of `FooService`
    this.fooService().somethingElse();
  }
}
```

## Rules and behaviour

* Lazy injection can be combined with [optional injection](./optional-injection.md). In that case, it would the 
  function above would be `() => FooService | undefined`;
* Lazy injection can also be combined with [async injection](./async-injection.md). In that case, it would the
  function above would be `() => Promise<FooService>`;
