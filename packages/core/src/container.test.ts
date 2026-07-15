import { afterEach, describe, expect, it, vi } from "vitest";

import { bootstrap, bootstrapAsync, Container } from "./container.ts";
import { injectable } from "./decorators.ts";
import { InjectionToken } from "./tokens.ts";
import { inject, injectAsync } from "./context.ts";

const myServiceConstructorSpy = vi.fn();

@injectable()
class MyService {
  constructor(public name = "MyService") {
    myServiceConstructorSpy();
  }
}

describe("Container API", () => {
  afterEach(() => {
    myServiceConstructorSpy.mockReset();
  });

  it("inject", () => {
    expect(() => inject(MyService)).toThrowError(
      "You can only invoke inject() or injectAsync() within an injection context",
    );

    const container = new Container();
    const token = new InjectionToken<MyService>("some-token");

    expect(() => container.get(token)).toThrowError("No provider(s) found");

    container.bind({
      provide: token,
      useFactory: () => inject(MyService),
    });

    expect(container.get(token)).toBeInstanceOf(MyService);
  });

  it("injectAsync", async () => {
    await expect(injectAsync(MyService)).rejects.toThrowError(
      "You can only invoke inject() or injectAsync() within an injection context",
    );

    const container = new Container();
    const token = new InjectionToken<string>("some-token");
    const otherToken = new InjectionToken<string>("other-token");
    const aliasToken = new InjectionToken<string>("alias-token");

    container
      .bind({
        provide: otherToken,
        async: true,
        useFactory: () => Promise.resolve("foo"),
      })
      .bind({
        provide: token,
        async: true,
        useFactory: () => injectAsync(otherToken),
      })
      .bind({
        provide: aliasToken,
        useExisting: token,
      });

    expect(await container.getAsync(token)).toBe("foo");
    expect(await container.getAsync(aliasToken)).toBe("foo");
  });

  it("has", async () => {
    const container = new Container();
    const childContainer = container.createChild();
    const token = new InjectionToken<MyService>("some-token");

    expect(container.has(token)).toBe(false);
    expect(childContainer.has(token)).toBe(false);

    container.bind({ provide: token, useClass: MyService });
    expect(container.has(token)).toBe(true);
    expect(childContainer.has(token)).toBe(true);

    // has shall not create a provider, even if it is async
    const asyncToken = new InjectionToken<MyService>("some-async-token");
    expect(container.has(asyncToken)).toBe(false);
    const spy = vi.fn();
    container.bind({
      provide: asyncToken,
      async: true,
      useFactory: async () => {
        spy();
        return new MyService();
      },
    });
    expect(container.has(asyncToken)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(0);
    await container.getAsync(asyncToken);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("bootstrap", () => {
    expect(bootstrap(MyService)).toBeInstanceOf(MyService);
    expect(bootstrap(MyService)).toBeInstanceOf(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(2);
  });

  it("bootstrapAsync", async () => {
    expect(await bootstrapAsync(MyService)).toBeInstanceOf(MyService);
    expect(await bootstrapAsync(MyService)).toBeInstanceOf(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(2);
  });

  describe("contexts", () => {
    it("should support nesting without interference", () => {
      const container1 = new Container().bind({ provide: "a", useFactory: () => "A" });
      const container2 = new Container().bind({ provide: "b", useFactory: () => container1.get("a") });

      const container3 = new Container()
        .bind({ provide: "c", useFactory: () => container2.get("b") })
        .bind({ provide: "d", useFactory: () => inject("c") })
        .bind({ provide: "e", useFactory: () => inject("b") });

      expect(container3.get("c")).toEqual("A");
      expect(container3.get("d")).toEqual("A");

      expect(() => container3.get("e")).toThrowError("No provider(s) found for b");
      expect(() => container3.get("b")).toThrowError("No provider(s) found for b");
    });
  });

  describe("concurrent async constructions", () => {
    // https://github.com/needle-di/needle-di/issues/102
    it("should not report a phantom circular dependency when a failed construction is retried while another is in flight", async () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");

      let aAttempts = 0;
      let releaseB!: () => void;
      const bGate = new Promise<void>((resolve) => (releaseB = resolve));

      const container = new Container();
      container.bind({
        provide: tokenA,
        async: true,
        useFactory: async () => {
          aAttempts += 1;
          if (aAttempts === 1) {
            await Promise.resolve(); // yield so B's construction can start before A fails
            throw new Error("transient failure");
          }
          return "a-value";
        },
      });
      container.bind({
        provide: tokenB,
        async: true,
        useFactory: async () => {
          await bGate; // keep B's construction in flight
          return "b-value";
        },
      });

      // A starts, then B starts; A then fails while B is still under construction.
      const aFirst = container.getAsync(tokenA).catch((error: Error) => error);
      const bPending = container.getAsync(tokenB);
      const aFirstResult = await aFirst;
      expect(aFirstResult).toBeInstanceOf(Error);
      expect((aFirstResult as Error).message).toBe("transient failure");

      // Retrying A while B is still in flight must not throw a circular dependency error:
      // A has no dependencies at all.
      await expect(container.getAsync(tokenA)).resolves.toBe("a-value");

      releaseB();
      await expect(bPending).resolves.toBe("b-value");
    });

    it("should still detect real circular dependencies in async constructions", async () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");

      const container = new Container();
      container.bind({
        provide: tokenA,
        async: true,
        useFactory: async () => `a(${await injectAsync(tokenB)})`,
      });
      container.bind({
        provide: tokenB,
        async: true,
        useFactory: async () => `b(${await injectAsync(tokenA)})`,
      });

      await expect(container.getAsync(tokenA)).rejects.toThrowError(/circular dependency/i);
    });
  });

  it("should unbind a single service", () => {
    const container = new Container();

    container.bind({ provide: MyService, useClass: MyService });

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(0);

    const myService1 = container.get(MyService);
    const myService2 = container.get(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(1);
    expect(myService1).toBe(myService2);

    container.unbind(MyService);

    const myService3 = container.get(MyService);

    expect(myServiceConstructorSpy).toHaveBeenCalledTimes(2);
    expect(myService3).not.toBe(myService1);
    expect(myService3).not.toBe(myService2);
  });
});
