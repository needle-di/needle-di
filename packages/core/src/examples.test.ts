import { describe, expect, it, vi, vitest } from "vitest";

import { injectable } from "./decorators.ts";
import { bootstrap, bootstrapAsync, Container } from "./container.ts";
import { InjectionToken } from "./tokens.ts";
import { inject, injectAsync } from "./context.ts";

@injectable()
class OtherService {
  getMessage(): string {
    return "test";
  }
}

@injectable()
class MyService {
  private readonly otherService2 = inject(OtherService);

  constructor(private readonly otherService = inject(OtherService)) {}

  sayHello(): string {
    return `Constructor injection ${this.otherService.getMessage()}`;
  }

  sayHello2(): string {
    return `Initializer injection ${this.otherService2.getMessage()}`;
  }

  triggerInject(): void {
    inject(OtherService);
  }
}

interface Foo {
  foo: string;
}

interface Bar {
  bar: string;
}

const fooToken1 = new InjectionToken<Foo>("foo-token1");
const fooToken2 = new InjectionToken<Foo>("foo-token2");
const fooToken3 = new InjectionToken<Foo>("foo-token3");

const tokenProvidedAsync = new InjectionToken<Foo>("provided-async");
const tokenWithoutProvider = new InjectionToken<Foo>("not-provided");

const barToken = new InjectionToken<Bar>("bar", {
  factory: () => ({
    bar: "bar1",
  }),
});

@injectable()
class ProviderService {
  constructor(
    public providedByValue = inject<Foo>("by-value-with-token-as-string"),
    public providedByFactory = inject(fooToken1),
    public providedByFactoryTwice = inject(fooToken1),
    public providedByFactoryWithInject = inject(fooToken2),
    public providedByExisting = inject(fooToken3),
    public providedAsync = injectAsync(tokenProvidedAsync),
    public notProvided = inject(tokenWithoutProvider, { optional: true }),
  ) {}
}

describe("Container", () => {
  it("should bind classes", () => {
    const container = new Container();

    container
      .bind({
        provide: MyService,
        useClass: MyService,
      })
      .bind({
        provide: OtherService,
        useClass: OtherService,
      });

    const service = container.get(MyService);

    expect(service.sayHello()).toBe("Constructor injection test");
  });

  it("should auto-bind classes", () => {
    const container = new Container();
    const service = container.get(MyService);

    expect(service.sayHello()).toBe("Constructor injection test");
  });

  it("should allow initializer injection", () => {
    const container = new Container();
    const service = container.get(MyService);

    expect(service.sayHello2()).toBe("Initializer injection test");
  });

  it("should not allow injection outside injection context", () => {
    const container = new Container();
    const service = container.get(MyService);

    expect(() => service.triggerInject()).toThrowError(
      "You can only invoke inject() or injectAsync() within an injection context",
    );
  });

  it("should support all kinds of providers", async () => {
    const container = new Container();
    const factoryFn = vitest.fn(() => ({
      foo: "foo2",
    }));
    container
      .bind({
        provide: "by-value-with-token-as-string",
        useValue: {
          foo: "foo1",
        },
      })
      .bind({
        provide: fooToken1,
        useFactory: factoryFn,
      })
      .bind({
        provide: fooToken2,
        useFactory: () => ({
          foo: inject(barToken).bar,
        }),
      })
      .bind({
        provide: fooToken3,
        useExisting: fooToken1,
      })
      .bind({
        provide: tokenProvidedAsync,
        async: true,
        useFactory: () => Promise.resolve({ foo: "async" }),
      });

    expect(factoryFn).not.toHaveBeenCalled();

    const service = container.get(ProviderService);

    expect(service.providedByValue.foo).toBe("foo1");
    expect(service.providedByFactory.foo).toBe("foo2");
    expect(service.providedByFactoryTwice.foo).toBe("foo2");
    expect(service.providedByFactoryWithInject.foo).toBe("bar1");
    expect(service.providedByExisting.foo).toBe("foo2");
    expect(service.providedAsync).toBeInstanceOf(Promise);
    expect(service.notProvided).toBeUndefined();

    expect(factoryFn).toHaveBeenCalledTimes(1);

    expect(() => container.get(tokenWithoutProvider)).toThrowError("No provider(s) found");
    expect(() => container.get(tokenWithoutProvider, { optional: false })).toThrowError("No provider(s) found");

    expect(() => container.get(tokenProvidedAsync)).toThrowError("use injectAsync() or container.getAsync() instead");

    await container.getAsync(tokenProvidedAsync);

    expect(() => container.get(tokenProvidedAsync)).not.toThrowError();

    const fooAsync = await container.getAsync(tokenProvidedAsync);
    expect(fooAsync).toEqual({ foo: "async" });
  });

  it("should support multi-providers (example without auto-binding)", () => {
    abstract class AbstractService {
      protected constructor(private name: string) {}
    }

    class FooService extends AbstractService {
      constructor() {
        super("Foo");
      }
    }

    class BarService extends AbstractService {
      constructor() {
        super("Bar");
      }
    }

    const container = new Container();

    container
      .bind({
        provide: AbstractService,
        multi: true,
        useClass: FooService,
      })
      .bind({
        provide: AbstractService,
        multi: true,
        useClass: BarService,
      });

    const services = container.get(AbstractService, { multi: true });

    expect(services).not.toBeUndefined();
    expect(services).toHaveLength(2);

    const [serviceA, serviceB] = services;

    expect(serviceA).toBeInstanceOf(FooService);
    expect(serviceB).toBeInstanceOf(BarService);
  });

  it("should support multi-providers (example with auto-binding)", () => {
    abstract class AbstractService {
      protected constructor(private name: string) {}
    }

    @injectable()
    class FooService extends AbstractService {
      constructor() {
        super("Foo");
      }
    }

    @injectable()
    class BarService extends AbstractService {
      constructor() {
        super("Bar");
      }
    }

    const container = new Container();

    const services = container.get(AbstractService, { multi: true });

    expect(services).not.toBeUndefined();
    expect(services).toHaveLength(2);

    const [serviceA, serviceB] = services;

    expect(serviceA).toBeInstanceOf(FooService);
    expect(serviceB).toBeInstanceOf(BarService);
  });

  describe("should support multi-providers with multi-inheritance (example without auto-binding)", () => {
    abstract class AbstractService {
      protected constructor(private name: string) {}
    }

    class FooService extends AbstractService {
      constructor() {
        super("Foo");
      }
    }

    class BarService extends AbstractService {
      constructor(public barProp: string) {
        super("Bar");
      }
    }

    class SpecialBarService extends BarService {
      constructor(public age = 6) {
        super("SpecialBar");
      }
    }

    class BazService extends AbstractService {
      constructor(public bazProp: string) {
        super("Bar");
      }
    }

    class SpecialBazService extends BazService {
      constructor(public specialBazProp: string) {
        super("SpecialBaz");
      }
    }

    it("first parent class, then child class ", () => {
      const container = new Container();

      container.bindAll(
        {
          provide: FooService,
          useClass: FooService,
          multi: true,
        },
        {
          provide: BarService,
          useClass: BarService,
          multi: true,
        },
        {
          provide: SpecialBarService,
          useClass: SpecialBarService,
          multi: true,
        },
        {
          provide: SpecialBazService,
          useClass: SpecialBazService,
          multi: true,
        },

        // not needed, but should not interfere with auto-binding of parent classes:
        {
          provide: BarService,
          useExisting: SpecialBarService,
          multi: true,
        },
        {
          provide: BazService,
          useExisting: SpecialBazService,
          multi: true,
        },
        {
          provide: AbstractService,
          useExisting: FooService,
          multi: true,
        },
        {
          provide: AbstractService,
          useExisting: BarService,
          multi: true,
        },
        {
          provide: AbstractService,
          useExisting: BazService,
          multi: true,
        },
      );

      const abstractServices = container.get(AbstractService, { multi: true });

      expect(abstractServices).not.toBeUndefined();
      expect(abstractServices).toHaveLength(4);

      const [abstractServiceFoo, abstractServiceBar, abstractServiceSpecialBar, abstractServiceSpecialBaz] =
        abstractServices;

      expect(abstractServiceFoo).toBeInstanceOf(FooService);
      expect(abstractServiceBar).toBeInstanceOf(BarService);
      expect(abstractServiceSpecialBar).toBeInstanceOf(SpecialBarService);
      expect(abstractServiceSpecialBaz).toBeInstanceOf(SpecialBazService);

      const barServices = container.get(BarService, { multi: true });

      expect(barServices).not.toBeUndefined();
      expect(barServices).toHaveLength(2);

      const [barServicesBar, barServicesSpecialBar] = barServices;

      expect(barServicesBar).toBeInstanceOf(BarService);
      expect(barServicesBar).toBe(abstractServiceBar);
      expect(barServicesSpecialBar).toBeInstanceOf(SpecialBarService);
      expect(barServicesSpecialBar).toBe(abstractServiceSpecialBar);

      const bazServices = container.get(BazService, { multi: true });

      expect(bazServices).not.toBeUndefined();
      expect(bazServices).toHaveLength(1);

      const [barServiceSpecialBaz] = bazServices;

      expect(barServiceSpecialBaz).toBeInstanceOf(SpecialBazService);
      expect(barServiceSpecialBaz).toBe(abstractServiceSpecialBaz);
    });

    it("first child class, then parent class ", () => {
      const container = new Container();

      container.bindAll(
        {
          provide: FooService,
          useClass: FooService,
          multi: true,
        },
        {
          provide: BarService,
          useClass: BarService,
          multi: true,
        },
        {
          provide: SpecialBarService,
          useClass: SpecialBarService,
          multi: true,
        },
        {
          provide: SpecialBazService,
          useClass: SpecialBazService,
          multi: true,
        },

        // not needed, but should not interfere with auto-binding of parent classes:
        {
          provide: AbstractService,
          useExisting: FooService,
          multi: true,
        },
        {
          provide: AbstractService,
          useExisting: BarService,
          multi: true,
        },
        {
          provide: AbstractService,
          useExisting: BazService,
          multi: true,
        },
        {
          provide: BarService,
          useExisting: SpecialBarService,
          multi: true,
        },
      );

      const bazServices = container.get(BazService, { multi: true });

      expect(bazServices).not.toBeUndefined();
      expect(bazServices).toHaveLength(1);

      const [barServiceSpecialBaz] = bazServices;

      expect(barServiceSpecialBaz).toBeInstanceOf(SpecialBazService);

      const barServices = container.get(BarService, { multi: true });

      expect(barServices).not.toBeUndefined();
      expect(barServices).toHaveLength(2);

      const [barServicesBar, barServicesSpecialBar] = barServices;

      expect(barServicesBar).toBeInstanceOf(BarService);
      expect(barServicesSpecialBar).toBeInstanceOf(SpecialBarService);

      const abstractServices = container.get(AbstractService, { multi: true });

      expect(abstractServices).not.toBeUndefined();
      expect(abstractServices).toHaveLength(4);

      const [abstractServiceFoo, abstractServiceBar, abstractServiceSpecialBar, abstractServiceSpecialBaz] =
        abstractServices;

      expect(abstractServiceFoo).toBeInstanceOf(FooService);
      expect(abstractServiceBar).toBeInstanceOf(BarService);
      expect(abstractServiceBar).toBe(barServicesBar);
      expect(abstractServiceSpecialBar).toBeInstanceOf(SpecialBarService);
      expect(abstractServiceSpecialBar).toBe(barServicesSpecialBar);
      expect(abstractServiceSpecialBaz).toBeInstanceOf(SpecialBazService);
      expect(abstractServiceSpecialBaz).toBe(barServiceSpecialBaz);
    });
  });

  describe("should support multi-providers with multi-inheritance (example with auto-binding)", () => {
    abstract class AbstractService {
      protected constructor(private name: string) {}
    }

    @injectable()
    class FooService extends AbstractService {
      constructor() {
        super("Foo");
      }
    }

    @injectable()
    class BarService extends AbstractService {
      constructor() {
        super("Bar");
      }
    }

    @injectable()
    class SpecialBarService extends BarService {
      constructor(public age = 6) {
        super();
      }
    }

    class BazService extends AbstractService {
      constructor() {
        super("Bar");
      }
    }

    @injectable()
    class SpecialBazService extends BazService {
      constructor(public age = 8) {
        super();
      }
    }

    it("first parent class, then child class ", () => {
      const container = new Container();

      const abstractServices = container.get(AbstractService, { multi: true });

      expect(abstractServices).not.toBeUndefined();
      expect(abstractServices).toHaveLength(4);

      const [abstractServiceFoo, abstractServiceBar, abstractServiceSpecialBar, abstractServiceSpecialBaz] =
        abstractServices;

      expect(abstractServiceFoo).toBeInstanceOf(FooService);
      expect(abstractServiceBar).toBeInstanceOf(BarService);
      expect(abstractServiceSpecialBar).toBeInstanceOf(SpecialBarService);
      expect(abstractServiceSpecialBaz).toBeInstanceOf(SpecialBazService);

      const barServices = container.get(BarService, { multi: true });

      expect(barServices).not.toBeUndefined();
      expect(barServices).toHaveLength(2);

      const [barServicesBar, barServicesSpecialBar] = barServices;

      expect(barServicesBar).toBeInstanceOf(BarService);
      expect(barServicesBar).toBe(abstractServiceBar);
      expect(barServicesSpecialBar).toBeInstanceOf(SpecialBarService);
      expect(barServicesSpecialBar).toBe(abstractServiceSpecialBar);

      const bazServices = container.get(BazService, { multi: true });

      expect(bazServices).not.toBeUndefined();
      expect(bazServices).toHaveLength(1);

      const [barServiceSpecialBaz] = bazServices;

      expect(barServiceSpecialBaz).toBeInstanceOf(SpecialBazService);
      expect(barServiceSpecialBaz).toBe(abstractServiceSpecialBaz);
    });

    it("first child class, then parent class ", () => {
      const container = new Container();

      const bazServices = container.get(BazService, { multi: true });

      expect(bazServices).not.toBeUndefined();
      expect(bazServices).toHaveLength(1);

      const [barServiceSpecialBaz] = bazServices;

      expect(barServiceSpecialBaz).toBeInstanceOf(SpecialBazService);

      const barServices = container.get(BarService, { multi: true });

      expect(barServices).not.toBeUndefined();
      expect(barServices).toHaveLength(2);

      const [barServicesBar, barServicesSpecialBar] = barServices;

      expect(barServicesBar).toBeInstanceOf(BarService);
      expect(barServicesSpecialBar).toBeInstanceOf(SpecialBarService);

      const abstractServices = container.get(AbstractService, { multi: true });

      expect(abstractServices).not.toBeUndefined();
      expect(abstractServices).toHaveLength(4);

      const [abstractServiceSpecialBaz, abstractServiceBar, abstractServiceSpecialBar, abstractServiceFoo] =
        abstractServices;

      expect(abstractServiceFoo).toBeInstanceOf(FooService);
      expect(abstractServiceBar).toBeInstanceOf(BarService);
      expect(abstractServiceBar).toBe(barServicesBar);
      expect(abstractServiceSpecialBar).toBeInstanceOf(SpecialBarService);
      expect(abstractServiceSpecialBar).toBe(barServicesSpecialBar);
      expect(abstractServiceSpecialBaz).toBeInstanceOf(SpecialBazService);
      expect(abstractServiceSpecialBaz).toBe(barServiceSpecialBaz);
    });
  });

  it("should not allow combination of multi=false and multi=true", () => {
    const container = new Container();

    expect(() =>
      container.bindAll({ provide: "key", useValue: 1 }, { provide: "key", multi: true, useValue: 2 }),
    ).toThrowError(
      "Cannot bind key as multi-provider, since there is already a provider which is not a multi-provider.",
    );

    expect(() =>
      container.bindAll({ provide: "otherKey", multi: true, useValue: 2 }, { provide: "otherKey", useValue: 1 }),
    ).toThrowError("Cannot bind otherKey as provider, since there are already provider(s) that are multi-providers.");
  });

  it("existing provider may not refer to itself", () => {
    const container = new Container();

    expect(() => container.bind({ provide: "key", useExisting: "key" })).toThrowError(
      `The provider for token key with "useExisting" cannot refer to itself.`,
    );
  });

  it("requesting single value for multiple providers throws error", async () => {
    const container = new Container();

    container.bindAll(
      { provide: "key", multi: true, useValue: 1 },
      { provide: "key", multi: true, useValue: 2 },
      { provide: "asyncKey", multi: true, async: true, useFactory: async () => 1 },
      { provide: "asyncKey", multi: true, async: true, useFactory: async () => 2 },
    );

    expect(() => container.get("key")).toThrowError(
      "Requesting a single value for key, but multiple values were provided.",
    );

    await expect(container.getAsync("asyncKey")).rejects.toThrowError(
      "Requesting a single value for asyncKey, but multiple values were provided.",
    );
  });

  it("existing provider may not refer to itself", () => {
    const container = new Container();

    expect(() => container.bind({ provide: "key", useExisting: "key" })).toThrowError(
      `The provider for token key with "useExisting" cannot refer to itself.`,
    );
  });

  it("should support flattening multi-providers (combination of multi and use-existing)", () => {
    const container = new Container();

    container.bindAll(
      {
        provide: "myNumbers",
        useValue: 1,
        multi: true,
      },
      {
        provide: "myNumbers",
        useValue: 2,
        multi: true,
      },
      {
        provide: "otherNumber",
        useValue: 3,
      },
      {
        provide: "anotherNumber",
        useValue: 4,
      },
      {
        provide: "otherNumbers",
        useValue: 5,
        multi: true,
      },
      {
        provide: "a",
        useExisting: "myNumbers",
      },
      {
        provide: "b",
        useExisting: "myNumbers",
        multi: true,
      },
      {
        provide: "b",
        useExisting: "otherNumber",
        multi: true,
      },
      {
        provide: "c",
        useExisting: "anotherNumber",
        multi: true,
      },
      {
        provide: "d",
        useExisting: "myNumbers",
        multi: true,
      },
      {
        provide: "d",
        useExisting: "otherNumbers",
        multi: true,
      },
      {
        provide: "d",
        useExisting: "otherNumber",
        multi: true,
      },
      {
        provide: "e",
        useExisting: "otherNumber",
        multi: true,
      },
      {
        provide: "f",
        useExisting: "otherNumbers",
        multi: true,
      },
    );

    // my numbers
    expect(() => container.get("myNumbers")).toThrowError("multiple values were provided");
    expect(container.get("myNumbers", { multi: true })).toEqual([1, 2]);

    // a
    expect(() => container.get("a")).toThrowError("multiple values were provided");
    expect(container.get("a", { multi: true })).toEqual([1, 2]);

    // b
    expect(() => container.get("b")).toThrowError("multiple values were provided");
    expect(container.get("b", { multi: true })).toEqual([1, 2, 3]);

    // c
    expect(container.get("c")).toEqual(4);
    expect(container.get("c", { multi: true })).toEqual([4]);

    // d
    expect(() => container.get("d")).toThrowError("multiple values were provided");
    expect(container.get("d", { multi: true })).toEqual([1, 2, 5, 3]);

    // e
    expect(container.get("e")).toEqual(3);
    expect(container.get("e", { multi: true })).toEqual([3]);

    // f
    expect(container.get("f")).toEqual(5);
    expect(container.get("f", { multi: true })).toEqual([5]);
  });

  it("should support initialization injection", () => {
    @injectable()
    class Foo {
      public sayHi() {
        return "Hi!";
      }
    }

    @injectable()
    class Bar {
      private foo = inject(Foo);

      public letFooSayHi() {
        return this.foo.sayHi();
      }
    }

    const bar = bootstrap(Bar);
    expect(bar.letFooSayHi()).toBe("Hi!");
  });

  it("should support symbols", () => {
    const container = new Container();
    const OTHER_TOKEN = Symbol("other-token");

    container.bindAll(
      {
        provide: Symbol.for("my-token"),
        useValue: 42,
      },
      {
        provide: OTHER_TOKEN,
        useValue: 2,
      },
    );

    expect(container.get(Symbol.for("my-token"))).toBe(42);
    expect(() => container.get(Symbol.for("other-token"))).toThrowError("No provider(s) found for other-token");
    expect(container.get(OTHER_TOKEN)).toBe(2);
  });

  it("should support sync injection of async providers in async flow", async () => {
    const constructed = vi.fn();

    @injectable()
    class OtherService {
      public foo = inject(FOO_TOKEN);
      public bar = inject(BAR_TOKEN);
    }

    @injectable()
    class MyService {
      private otherService = inject(OtherService);

      constructor() {
        constructed();
      }

      public printTokens(): string {
        return `${this.otherService.foo} and ${this.otherService.bar}`;
      }
    }

    const FOO_TOKEN = new InjectionToken<string>("FOO_TOKEN", {
      async: true,
      factory: () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("Foo"), 100);
        }),
    });
    const BAR_TOKEN = new InjectionToken<string>("BAR_TOKEN", {
      async: true,
      factory: () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("Bar"), 100);
        }),
    });

    const myService = await bootstrapAsync(MyService);

    expect(myService.printTokens()).toBe("Foo and Bar");
    expect(constructed).toHaveBeenCalledTimes(1);
  });

  it("should support sync injection of async providers in async flow (2)", async () => {
    @injectable()
    class MyService {
      constructor(
        private foo = inject(FOO_TOKEN),
        private bar = inject(BAR_TOKEN_ALIAS),
      ) {}

      public printTokens(): string {
        return `${this.foo} and ${this.bar}`;
      }
    }

    class ServiceThatThrowsErrorInInit {
      constructor(
        private foo = inject(FOO_TOKEN),
        private bar = inject(BAR_TOKEN_ALIAS),
      ) {
        throw Error("foo");
      }
    }

    const FOO_TOKEN = new InjectionToken<string>("FOO_TOKEN");
    const BAR_TOKEN = new InjectionToken<string>("BAR_TOKEN");
    const BAR_TOKEN_ALIAS = new InjectionToken<string>("BAR_TOKEN_ALIAS");

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
      {
        provide: BAR_TOKEN_ALIAS,
        useExisting: BAR_TOKEN,
      },
      ServiceThatThrowsErrorInInit,
    );

    const myService = await container.getAsync(MyService);

    expect(myService.printTokens()).toBe("Foo and Bar");

    await expect(container.getAsync(ServiceThatThrowsErrorInInit)).rejects.toThrowError("foo");
  });

  it("should not support sync injection of async providers outside constructors", async () => {
    class MyService {
      constructor(
        private foo: string,
        private bar: string,
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
      {
        provide: MyService,
        useFactory: () => {
          const foo = inject(FOO_TOKEN);
          const bar = inject(BAR_TOKEN);

          return new MyService(foo, bar);
        },
      },
    );

    await expect(() => container.getAsync(MyService)).rejects.toThrowError(
      "use injectAsync() or container.getAsync() instead",
    );
  });

  it("should auto-bind parent classes (without decorators)", () => {
    abstract class ExampleService {
      private x = Math.random();
    }

    class FooService extends ExampleService {
      private foo = Math.random();
    }

    class BarService extends ExampleService {
      private bar = Math.random();
    }

    const container = new Container();

    container.bindAll(FooService, BarService);

    expect(container.get(ExampleService, { multi: true })).toHaveLength(2);
  });

  it("should auto-bind parent classes (with decorators)", () => {
    abstract class ExampleService {
      private x = Math.random();
    }

    @injectable()
    class FooService extends ExampleService {
      private foo = Math.random();
    }

    @injectable()
    class BarService extends ExampleService {
      private bar = Math.random();
    }

    const container = new Container();

    container.bindAll(FooService, BarService);

    expect(container.get(ExampleService, { multi: true })).toHaveLength(2);
  });

  it("should throw user-friendly error for circular dependencies", () => {
    @injectable()
    class App {
      private foo = inject(Foo);
    }

    @injectable()
    class Foo {
      private bar = inject(Bar);

      public lorem() {
        return this.bar.lorem();
      }

      public ipsum() {
        return this.bar.ipsum();
      }
    }

    @injectable()
    class Bar {
      private baz = inject(Baz);

      public lorem() {
        return "lorem";
      }

      public ipsum() {
        return this.baz.ipsum();
      }
    }

    @injectable()
    class Baz {
      private foo = inject(Foo);

      public lorem() {
        return this.foo.lorem();
      }

      public ipsum() {
        return "ipsum";
      }
    }

    expect(() => bootstrap(App)).toThrowError("Detected circular dependency: App -> Foo -> Bar -> Baz -> Foo");
  });

  it("should support circular dependencies with lazy providers", () => {
    @injectable()
    class Foo {
      private bar = inject(Bar);

      public lorem() {
        return this.bar.lorem();
      }

      public ipsum() {
        return this.bar.ipsum();
      }
    }

    @injectable()
    class Bar {
      private baz = inject(Baz);

      public lorem() {
        return "lorem";
      }

      public ipsum() {
        return this.baz.ipsum();
      }
    }

    @injectable()
    class Baz {
      private foo = inject(Foo, { lazy: true });

      public lorem() {
        return this.foo().lorem();
      }

      public ipsum() {
        return "ipsum";
      }
    }

    const foo = bootstrap(Foo);
    const baz = bootstrap(Baz);

    expect(foo).toBeTruthy();
    expect(baz).toBeTruthy();

    expect(foo.lorem()).toBe("lorem");
    expect(foo.ipsum()).toBe("ipsum");

    expect(baz.lorem()).toBe("lorem");
    expect(baz.ipsum()).toBe("ipsum");
  });
});
