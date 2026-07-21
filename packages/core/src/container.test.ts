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

    // https://github.com/needle-di/needle-di/issues/103
    it("should not leak the injection context of a suspended async construction", async () => {
      const tokenA = new InjectionToken<string>("A");
      const tokenB = new InjectionToken<string>("B");
      const tokenT = new InjectionToken<{ a: string; b: string }>("T");
      const tokenT2 = new InjectionToken<{ a: string; b: string }>("T2");

      let releaseA!: () => void;
      const aGate = new Promise<void>((resolve) => (releaseA = resolve));

      const parent = new Container();
      parent.bind({
        provide: tokenA,
        async: true,
        useFactory: async () => {
          await aGate; // suspend: the parent's injection context must not stay active meanwhile
          return "a-from-parent";
        },
      });
      parent.bind({ provide: tokenB, useValue: "b-from-parent" });

      const child = parent.createChild();
      child.bind({ provide: tokenB, useValue: "b-from-child" });
      child.bind({
        provide: tokenT, // bound on the child: its injections should resolve child-first
        async: true,
        useFactory: async () => {
          const aPromise = injectAsync(tokenA); // descends into the parent and suspends there
          const bPromise = injectAsync(tokenB); // must not read a leaked parent context
          return { a: await aPromise, b: await bPromise };
        },
      });
      child.bind({
        provide: tokenT2, // control case: identical, but B injected before A
        async: true,
        useFactory: async () => {
          const bPromise = injectAsync(tokenB);
          const aPromise = injectAsync(tokenA);
          return { a: await aPromise, b: await bPromise };
        },
      });

      const tPending = child.getAsync(tokenT);
      releaseA();

      expect(await tPending).toEqual({ a: "a-from-parent", b: "b-from-child" });
      expect(await child.getAsync(tokenT2)).toEqual({ a: "a-from-parent", b: "b-from-child" });
    });

    // https://github.com/needle-di/needle-di/issues/103
    it("should not allow inject() outside an injection context while an async construction is suspended", async () => {
      const token = new InjectionToken<string>("suspended");

      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));

      const container = new Container();
      container.bind({ provide: "value", useValue: "some-value" });
      container.bind({
        provide: token,
        async: true,
        useFactory: async () => {
          await gate;
          return "done";
        },
      });

      const pending = container.getAsync(token);

      // While the construction above is suspended, unrelated code must still be
      // outside any injection context.
      expect(() => inject("value")).toThrowError(
        "You can only invoke inject() or injectAsync() within an injection context",
      );

      release();
      await expect(pending).resolves.toBe("done");
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
