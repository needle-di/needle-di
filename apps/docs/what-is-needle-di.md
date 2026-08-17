---
description: "Introduction to Needle DI: why it exists, why to use dependency injection, its design principles and when (not) to use it."
outline: deep
---

# What is Needle DI?

Needle DI is a small, lightweight JavaScript library for dependency injection.

## Why another library?

There are many existing dependency injection libraries. We're certainly not claiming
to be unique. However, we hope that our combination of [design principles](#design-principles) may be exactly what
you're looking for.

If you have been using  [Angular](https://angular.dev/guide/di) or [NestJS](https://docs.nestjs.com/providers#dependency-injection)
before, this library might look familiar. That's because we took a lot of inspiration from existing frameworks, but we 
also made some different decisions. Make sure to refer to the documentation.

## Why dependency injection?

Dependency Injection (DI) is a design pattern in (object-oriented) programming where an object's or function's
dependencies are provided to it externally rather than the object creating them itself. In
simpler terms, instead of an object creating its own resources, they are "injected" into the object, usually through its
constructor.

Using dependency injection will lead to:

* **Loose coupling**: By injecting dependencies, classes depend on abstractions (like interfaces) instead of specific
  implementations. This makes code more flexible and easier to maintain or extend.

* **Easier testing**: Since dependencies can be injected, you can easily swap real dependencies with mock or fake
  objects when
  unit testing, allowing for isolated testing.

* **Better code organization**: DI promotes separation of concerns, meaning each class has a specific role and does not
  have
  to manage its own dependencies, leading to cleaner and more organized code.

* **Reusability**: When dependencies are provided externally, classes become more modular and can be reused in different
  contexts with different dependencies.

* **Improved maintainability**: As your codebase grows, the ability to swap dependencies without needing to change core
  logic
  becomes critical. DI allows you to update, change, or replace dependencies with minimal impact.

In essence, DI helps in managing the complexity of large systems, improves code quality, and makes it easier to adapt to
changing requirements.

## Design principles

### Lightweight

Needle DI is specifically designed for apps with a small footprint (e.g. serverless functions like AWS lambdas),
by minimizing bundle size by enabling tree-shaking and by not depending on any reflection metadata.

### Type-safe

Needle DI is written in TypeScript. You don't have to use TypeScript to use Needle DI, but when you do,
all type definitions are included and will make sure your code is consistent.

### Modern

Needle DI is an ESM-only package. This makes it suitable for modern Node.js and web projects. It also
uses stage 3 decorators, to push for ECMAScript standards.

## When to use Needle DI?

* **If your framework doesn't offer a built-in solution.** Most application frameworks for web or Node.js
  (such as [Angular](https://angular.dev/guide/di) or [NestJS](https://docs.nestjs.com/providers#dependency-injection)),
  offer a dependency injection solution which is already included. Therefore, Needle DI is mainly intended for
  smaller ("vanilla") projects.
* **If you deeply care about type-safety.** So if you're using TypeScript, you can use this as an opportunity to
  prevent mistakes in your dependency injection.
* **If you care about bundle-size**. Needle DI has only ~40 kB of unpacked size, but also supports tree-shaking. Besides
  that, no reflection or decorator metadata is needed.
* **If you want less dependencies**. Needle DI has no further (peer) dependencies.

## Why is feature X not included?

There is currently no roadmap, but we will consider every feature request.

Please [submit a ticket](https://github.com/needle-di/needle-di/issues/new), and we'd like to discuss a fitting solution.
