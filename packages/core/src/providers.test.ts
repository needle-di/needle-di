import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrap, bootstrapAsync, Container } from "./container.ts";
import { InjectionToken } from "./tokens.ts";
import { injectable } from "./decorators.ts";
import { inject, injectAsync } from "./context.ts";
import { delay } from "./utils.ts";

const myServiceConstructorSpy = vi.fn();

class MyService {
  constructor(public name = "MyService") {
    myServiceConstructorSpy();
  }
}

describe("Providers", () => {
  afterEach(() => {
    myServiceConstructorSpy.mockReset();
  });

  it("Constructor providers should be provided once", () => {
    const container = new Container();

    expect(() => container.get(MyService)).toThrowError("No provider(s) found");
    expect(container.get(MyService, { optional: true })).toBeUndefined();

    container.bind(MyService);

    expect(myServiceConstructorSpy).not.toHaveBeenCalled();

    const myService = container.get(MyService);

    expect(myService).toBeInstanceOf(MyService);
    expect(container.get(MyService)).toBe(myService);
    expect(container.get(MyService, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);

    expect(() => container.bind(MyService)).toThrowError("existing provider was already constructed");
  });

  it("Class providers should be provided once", () => {
    const container = new Container();

    expect(() => container.get(MyService)).toThrowError("No provider(s) found");
    expect(container.get(MyService, { optional: true })).toBeUndefined();

    container.bind({
      provide: MyService,
      useClass: MyService,
    });

    expect(myServiceConstructorSpy).not.toHaveBeenCalled();

    const myService = container.get(MyService);

    expect(myService).toBeInstanceOf(MyService);
    expect(container.get(MyService)).toBe(myService);
    expect(container.get(MyService, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
  });

  it("Value providers should be provided", () => {
    const container = new Container();

    expect(() => container.get(MyService)).toThrowError("No provider(s) found");
    expect(container.get(MyService, { optional: true })).toBeUndefined();

    const myService = new MyService();

    container.bind({
      provide: MyService,
      useValue: myService,
    });

    expect(myService).toBeInstanceOf(MyService);
    expect(container.get(MyService)).toBe(myService);
    expect(container.get(MyService, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
  });

  it("Factory providers should be provided once", () => {
    const container = new Container();

    expect(() => container.get(MyService)).toThrowError("No provider(s) found");
    expect(container.get(MyService, { optional: true })).toBeUndefined();

    container.bind({
      provide: MyService,
      useFactory: () => new MyService(),
    });

    expect(myServiceConstructorSpy).not.toHaveBeenCalled();

    const myService = container.get(MyService);

    expect(myService).toBeInstanceOf(MyService);
    expect(container.get(MyService)).toBe(myService);
    expect(container.get(MyService, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
  });

  it("Async providers should be provided once", async () => {
    const container = new Container();

    expect(() => container.get(MyService)).toThrowError("No provider(s) found");
    expect(container.get(MyService, { optional: true })).toBeUndefined();
    await expect(container.getAsync(MyService)).rejects.toThrowError("No provider(s) found");
    expect(await container.getAsync(MyService, { optional: true })).toBeUndefined();

    container.bind({
      provide: MyService,
      async: true,
      useFactory: () => Promise.resolve(new MyService()),
    });

    expect(myServiceConstructorSpy).not.toHaveBeenCalled();
    expect(() => container.get(MyService)).toThrowError("use injectAsync() or container.getAsync() instead");

    const myService = await container.getAsync(MyService);

    expect(myService).toBeInstanceOf(MyService);
    expect(await container.getAsync(MyService)).toBe(myService);
    expect(await container.getAsync(MyService, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
  });

  it("Existing providers should be provided once", () => {
    const container = new Container();

    expect(() => container.get(MyService)).toThrowError("No provider(s) found");
    expect(container.get(MyService, { optional: true })).toBeUndefined();

    const OTHER_TOKEN = new InjectionToken<MyService>("MyService");

    container.bind(MyService);
    container.bind({
      provide: OTHER_TOKEN,
      useExisting: MyService,
    });

    expect(myServiceConstructorSpy).not.toHaveBeenCalled();

    const myService = container.get(OTHER_TOKEN);

    expect(myService).toBeInstanceOf(MyService);
    expect(container.get(OTHER_TOKEN)).toBe(myService);
    expect(container.get(OTHER_TOKEN, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
  });

  it("Token factories should be provided once", () => {
    const container = new Container();

    const TOKEN = new InjectionToken<MyService>("MyService", {
      factory: () => new MyService(),
    });

    expect(myServiceConstructorSpy).not.toHaveBeenCalled();

    const myService = container.get(TOKEN);

    expect(myService).toBeInstanceOf(MyService);
    expect(container.get(TOKEN)).toBe(myService);
    expect(container.get(TOKEN, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
  });

  it("Token async factories should be provided once", async () => {
    const container = new Container();

    const TOKEN = new InjectionToken<MyService>("MyService", {
      async: true,
      factory: () => Promise.resolve(new MyService()),
    });

    expect(myServiceConstructorSpy).not.toHaveBeenCalled();

    const myService = await container.getAsync(TOKEN);

    expect(myService).toBeInstanceOf(MyService);
    expect(await container.getAsync(TOKEN)).toBe(myService);
    expect(await container.getAsync(TOKEN, { optional: true })).toBe(myService);
    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
  });

  describe("abstract classes and inheritance", () => {
    it("should support annotated subclasses", () => {
      abstract class AbstractService {
        protected constructor(public name = "AbstractService") {}
      }

      @injectable()
      class FooService extends AbstractService {
        constructor(public fooProp = "foo") {
          super("FooService");
        }
      }

      const container = new Container();

      expect(container.get(AbstractService)).toBeInstanceOf(FooService);
      expect(container.get(FooService)).toBeInstanceOf(FooService);
      expect(container.get(FooService)).toBe(container.get(AbstractService));
      expect(container.get(FooService)).toBeInstanceOf(AbstractService);

      expect(container.get(AbstractService)).toBeInstanceOf(FooService);
    });

    it("should support binding subclasses", () => {
      abstract class AbstractService {
        protected constructor(public name = "AbstractService") {}
      }

      class FooService extends AbstractService {
        constructor(public fooProp = "foo") {
          super("FooService");
        }
      }

      class BarService extends AbstractService {
        constructor(public fooProp = "bar") {
          super("BarService");
        }
      }

      const container = new Container();

      container.bind(FooService).bind(BarService).bind({
        provide: AbstractService,
        useExisting: FooService,
      });

      expect(container.get(FooService)).toBeInstanceOf(FooService);
      expect(container.get(FooService)).toBeInstanceOf(AbstractService);
      expect(container.get(BarService)).toBeInstanceOf(BarService);
      expect(container.get(BarService)).toBeInstanceOf(AbstractService);

      expect(container.get(AbstractService)).toBeInstanceOf(FooService);
    });
  });

  describe("Multi-provider injection", () => {
    it("should support multi-value providers", () => {
      const container = new Container();

      const TOKEN = new InjectionToken<number>("TOKEN");
      const OTHER_TOKEN = new InjectionToken<number>("OTHER_TOKEN");

      container
        .bind({
          provide: TOKEN,
          multi: true,
          useValue: 1,
        })
        .bind({
          provide: TOKEN,
          multi: true,
          useValue: 2,
        });

      expect(container.get(TOKEN, { multi: true })).toEqual([1, 2]);
      expect(() => container.get(OTHER_TOKEN, { multi: true })).toThrowError("No provider(s) found");
      expect(container.get(OTHER_TOKEN, { multi: true, optional: true })).toBeUndefined();

      expect(() => {
        container.bind({
          provide: TOKEN,
          multi: true,
          useValue: 1,
        });
      }).toThrowError("already constructed");
    });

    it("should support multi-value async providers", async () => {
      const container = new Container();

      const TOKEN = new InjectionToken<number>("TOKEN");
      const OTHER_TOKEN = new InjectionToken<number>("OTHER_TOKEN");

      container
        .bind({
          provide: TOKEN,
          multi: true,
          async: true,
          useFactory: () => Promise.resolve(1),
        })
        .bind({
          provide: TOKEN,
          multi: true,
          async: true,
          useFactory: () => Promise.resolve(2),
        });

      expect(await container.getAsync(TOKEN, { multi: true })).toEqual([1, 2]);
      await expect(container.getAsync(OTHER_TOKEN, { multi: true })).rejects.toThrowError("No provider(s) found");
      expect(await container.getAsync(OTHER_TOKEN, { multi: true, optional: true })).toBeUndefined();

      expect(() => {
        container.bind({
          provide: TOKEN,
          multi: true,
          async: true,
          useFactory: () => Promise.resolve(1),
        });
      }).toThrowError("already constructed");
    });
  });

  it("should throw an error when requesting a single async one", () => {
    const container = new Container();
    const MY_TOKEN = Symbol.for("my-token");

    container.bindAll(
      {
        provide: MY_TOKEN,
        useFactory: () => Promise.resolve(1),
        async: true,
        multi: true,
      },
      {
        provide: MY_TOKEN,
        useFactory: () => Promise.resolve(2),
        async: true,
        multi: true,
      },
    );

    expect(() => container.get(MY_TOKEN)).toThrowError("use injectAsync() or container.getAsync() instead");
  });

  it("should pass the container to the factory", () => {
    const container = new Container();
    const fooFactory = vi.fn(() => "Foo");
    const barFactory = vi.fn(() => "Bar");

    container.bindAll(
      {
        provide: "foo",
        useFactory: fooFactory,
      },
      {
        provide: "bar",
        useFactory: barFactory,
      },
      {
        provide: "message",
        useFactory: (c) => {
          return `${c.get("foo")} ${c.get("bar")}`;
        },
      },
    );

    expect(container.get("message")).toBe("Foo Bar");
    expect(fooFactory).toHaveBeenCalledOnce();
    expect(barFactory).toHaveBeenCalledOnce();
  });

  it("should auto-bind the container itself", () => {
    const container = new Container();

    const fooFactory = vi.fn(() => "Foo");
    const barFactory = vi.fn(() => "Bar");

    container.bindAll(
      {
        provide: "foo",
        useFactory: fooFactory,
      },
      {
        provide: "bar",
        useFactory: barFactory,
      },
      {
        provide: "message",
        useFactory: () => {
          const c = inject(Container);
          return `${c.get("foo")} ${c.get("bar")}`;
        },
      },
    );

    expect(container.get("message")).toBe("Foo Bar");
    expect(fooFactory).toHaveBeenCalledOnce();
    expect(barFactory).toHaveBeenCalledOnce();
  });

  describe("Child containers", () => {
    it("should be able to provide services provided on one of their ancestors", () => {
      const parent = new Container();
      const child = parent.createChild();
      const grandChild = child.createChild();

      parent.bind({ provide: "tokenA", useFactory: () => ["a"] });
      child.bind({ provide: "tokenB", useFactory: () => ["b"] });
      grandChild.bind({ provide: "tokenC", useFactory: () => ["c"] });

      expect(grandChild.get("tokenA")).toEqual(["a"]);
      expect(grandChild.get("tokenB")).toEqual(["b"]);
      expect(grandChild.get("tokenC")).toEqual(["c"]);

      expect(child.get("tokenA")).toEqual(["a"]);
      expect(child.get("tokenB")).toEqual(["b"]);
      expect(() => child.get("tokenC")).toThrowError("No provider(s) found for tokenC");

      expect(parent.get("tokenA")).toEqual(["a"]);
      expect(() => parent.get("tokenB")).toThrowError("No provider(s) found for tokenB");
      expect(() => child.get("tokenC")).toThrowError("No provider(s) found for tokenC");
    });

    it("should reuse singletons from their parent", () => {
      const parent = new Container();
      const child = parent.createChild();
      const grandChild = child.createChild();

      parent.bind({ provide: "tokenA", useFactory: () => ["a"] });
      child.bind({ provide: "tokenB", useFactory: () => ["b"] });

      const a1 = parent.get("tokenA");
      const a2 = grandChild.get("tokenA");
      const a3 = child.get("tokenA");

      const b1 = child.get("tokenB");
      const b2 = grandChild.get("tokenB");

      expect(a1).toBe(a2);
      expect(a2).toBe(a3);

      expect(b1).toBe(b2);
    });

    it("should not share their services with their parent", () => {
      const parent = new Container();
      const child = parent.createChild();

      child.bind({ provide: "tokenA", useFactory: () => ["a"] });

      expect(child.get("tokenA")).toEqual(["a"]);
      expect(() => parent.get("tokenA")).toThrowError("No provider(s) found for tokenA");
    });

    it("should keep track of their own singletons if provider was overridden", () => {
      const parent = new Container();
      const child = parent.createChild();
      const grandChild = child.createChild();

      parent.bind({ provide: "tokenA", useFactory: () => ["a1"] });
      child.bind({ provide: "tokenA", useFactory: () => ["a2"] });

      expect(parent.get("tokenA")).toEqual(["a1"]);
      expect(child.get("tokenA")).toEqual(["a2"]);
      expect(grandChild.get("tokenA")).toEqual(["a2"]);
    });

    it("should not merge multi-providers with their parents", () => {
      const parent = new Container();
      const child = parent.createChild();

      parent
        .bind({ provide: "tokenA", useFactory: () => "a1", multi: true })
        .bind({ provide: "tokenA", useFactory: () => "a2", multi: true });

      child
        .bind({ provide: "tokenA", useFactory: () => "a3", multi: true })
        .bind({ provide: "tokenA", useFactory: () => "a4", multi: true });

      expect(parent.get("tokenA", { multi: true })).toEqual(["a1", "a2"]);
      expect(child.get("tokenA", { multi: true })).toEqual(["a3", "a4"]);
    });
  });

  describe("Lazy injection", () => {
    describe("sync", () => {
      it("should construct lazily and once", () => {
        const barConstructed = vi.fn();
        const otherConstructed = vi.fn();

        @injectable()
        class FooService {
          constructor(private readonly barService = inject(BarService, { lazy: true })) {}

          doSomething() {
            return this.barService().getBar();
          }
        }

        @injectable()
        class BarService {
          constructor(private readonly otherService = inject(OtherService)) {
            barConstructed();
          }

          getBar(): string {
            return "Bar!";
          }
        }

        @injectable()
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        class OtherService {
          constructor() {
            otherConstructed();
          }
        }

        beforeEach(() => {
          barConstructed.mockReset();
          otherConstructed.mockReset();
        });

        const fooService = bootstrap(FooService);

        expect(barConstructed).not.toHaveBeenCalled();
        expect(otherConstructed).not.toHaveBeenCalled();

        const result = fooService.doSomething();

        expect(barConstructed).toHaveBeenCalled();
        expect(otherConstructed).toHaveBeenCalled();

        expect(result).toBe("Bar!");

        fooService.doSomething();

        expect(barConstructed).toHaveBeenCalledTimes(1);
        expect(otherConstructed).toHaveBeenCalledTimes(1);
      });

      it("should work with optionals", () => {
        @injectable()
        class FooService {
          constructor(private readonly barService = inject(BarService, { lazy: true, optional: true })) {}

          doSomething(): string | undefined {
            return this.barService()?.getBar();
          }
        }

        class BarService {
          getBar(): string {
            return "Bar!";
          }
        }

        const fooService = bootstrap(FooService);

        expect(fooService.doSomething()).toBeUndefined();
      });

      it("inject() should fail outside injection context", () => {
        @injectable()
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        class FooService {}

        expect(() => inject(FooService, { lazy: true })).toThrowError(
          "You can only invoke inject() or injectAsync() within an injection context",
        );
      });
    });

    describe("async", () => {
      it("should construct lazily and once", async () => {
        const barConstructed = vi.fn();
        const otherConstructed = vi.fn();

        @injectable()
        class FooService {
          constructor(private readonly barService = injectAsync(BarService)) {}

          async doSomething(): Promise<string> {
            return (await this.barService).getBar();
          }
        }

        class BarService {
          constructor(private readonly otherService = injectAsync(OtherService)) {
            barConstructed();
          }

          async getBar(): Promise<string> {
            await this.otherService;
            return "Bar!";
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        class OtherService {
          constructor() {
            otherConstructed();
          }
        }

        beforeEach(() => {
          barConstructed.mockReset();
          otherConstructed.mockReset();
        });

        const container = new Container().bindAll(
          {
            provide: BarService,
            useFactory: async (c) => {
              await delay(50);
              return new BarService(c.getAsync(OtherService));
            },
            async: true,
          },
          {
            provide: OtherService,
            useFactory: async () => {
              await delay(50);
              return new OtherService();
            },
            async: true,
          },
        );

        const fooService = await container.getAsync(FooService);

        expect(barConstructed).not.toHaveBeenCalled();
        expect(otherConstructed).not.toHaveBeenCalled();

        const result = await fooService.doSomething();

        expect(barConstructed).toHaveBeenCalled();
        expect(otherConstructed).toHaveBeenCalled();

        expect(result).toBe("Bar!");

        await fooService.doSomething();

        expect(barConstructed).toHaveBeenCalledTimes(1);
        expect(otherConstructed).toHaveBeenCalledTimes(1);
      });

      it("should work with optionals", async () => {
        @injectable()
        class FooService {
          constructor(private readonly barService = injectAsync(BarService, { lazy: true, optional: true })) {}

          async doSomething(): Promise<string | undefined> {
            const barService = await this.barService();
            return barService?.getBar();
          }
        }

        class BarService {
          getBar(): string {
            return "Bar!";
          }
        }

        const fooService = await bootstrapAsync(FooService);

        expect(await fooService.doSomething()).toBeUndefined();
      });

      it("injectAsync() should fail outside injection context", async () => {
        @injectable()
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        class FooService {}

        await expect(injectAsync(FooService, { lazy: true })).rejects.toThrowError(
          "You can only invoke inject() or injectAsync() within an injection context",
        );
      });
    });
  });
});
