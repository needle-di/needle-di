# Async injection

It is also possible to use a provider with an asynchronous factory function.

## Async factory providers

All you have to do, is passing `async: true`. This will require you to return a `Promise` in your factory function.
This allows you to also use an `async` function:

```ts
container.bind({
  provide: FooService,
  async: true,
  useFactory: async () => {
    // ... returning some `FooService` here
  },
});
```

## `getAsync()` and `injectAsync()`

When you want to obtain this from the DI container, you will have to use `container.getAsync(token)` or
`injectAsync(token)`. Since this returns a `Promise`, you can use `await` here.

```ts twoslash
import { container } from "./container";
import { FooService } from "./foo.service";

const fooService = await container.getAsync(FooService);
//    ^?
//
```

If you try to use `container.get()` or `inject()` for an async provider, an error will be thrown,
as these methods only support synchronous injection. This restriction also applies if any of the indirect dependencies 
is async.

## Synchronous constructor injection


You can inject your async dependencies synchronously, as long as you're in an async context.

```ts
@injectable()
class MyService {
  constructor(
    private foo = inject(FOO_TOKEN),
    private bar = inject(BAR_TOKEN),
  ) {}

  public printTokens(): string {
    return `${this.foo} and ${this.bar}`;
  }
}

const FOO_TOKEN = new InjectionToken<string>("FOO_TOKEN");
const BAR_TOKEN = new InjectionToken<string>("BAR_TOKEN");

const container = new Container();

container.bindAll(
  {
    provide: FOO_TOKEN,
    async: true,
    useFactory: () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("Foo"), 100);
      }),
  },
  {
    provide: BAR_TOKEN,
    async: true,
    useFactory: () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve("Bar"), 100);
      }),
  },
);

const myService = await container.getAsync(MyService);

myService.printTokens() // will return "Foo and Bar";
```

> [!NOTE]
> Async dependencies are resolved sequentially. We may remove this restriction in a later version.
