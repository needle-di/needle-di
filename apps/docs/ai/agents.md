---
description: "How to use Needle DI with AI coding agents: LLM-friendly documentation sources and guidance for generating Needle DI code."
outline: deep
---

# AI agent instructions

Needle DI ships machine-readable documentation, so AI coding agents can work with it without guessing APIs.

## Documentation sources

When working on Needle DI-related code, always verify against the current Needle DI documentation.
Prefer current documentation over assumptions from memory.

| Source                                                | Use it for                                          |
| ----------------------------------------------------- | --------------------------------------------------- |
| [`/llms.txt`](/llms.txt)                              | Compact index of all documentation pages            |
| [`/llms-full.txt`](/llms-full.txt)                    | The complete documentation as a single Markdown file |
| `/<page>.md` (e.g. [`/concepts/binding.md`](/concepts/binding.md)) | The Markdown source of a single page   |

For external agents, use the absolute URLs:

- <https://needle-di.io/llms.txt>
- <https://needle-di.io/llms-full.txt>

Every documentation page also has <kbd>Copy as Markdown</kbd> and <kbd>Download as Markdown</kbd> buttons,
so you can paste a page straight into a chat.

Additional sources:

- [`@needle-di/core` on npm](https://www.npmjs.com/package/@needle-di/core)
- [`@needle-di/core` on JSR](https://jsr.io/@needle-di/core/doc), which contains the generated API reference
- [The source code on GitHub](https://github.com/needle-di/needle-di)

## Guidance for agents

The following rules cover the mistakes LLMs most often make with Needle DI. They also apply when
generating code based on knowledge of other DI libraries such as Angular, NestJS or InversifyJS.

### Do

- Use `inject(Token)` as a default parameter value in constructors, initializers or factory functions.
- Use `@injectable()` for [auto-binding](/concepts/binding#auto-binding) services with a zero-argument
  constructor signature.
- Use `bind()` with a [provider](/concepts/providers) when a service needs explicit configuration.
- Use [`InjectionToken<T>`](/concepts/tokens#injectiontoken-t) for values that are not classes,
  and pass a `factory` when the token should be [tree-shakeable](/advanced/tree-shaking).
- Use [`injectAsync()` and `getAsync()`](/advanced/async-injection) for asynchronous factory providers.
- Use [`{ optional: true }`](/advanced/optional-injection), [`{ multi: true }`](/advanced/multi-injection)
  and [`{ lazy: true }`](/advanced/lazy-injection) instead of hand-rolled alternatives.

### Don't

- Don't install or import `reflect-metadata` or any other reflection library.
- Don't enable `experimentalDecorators` or `emitDecoratorMetadata`, these are legacy TypeScript decorators.
- Don't use parameter decorators such as `@Inject()` or `@Injectable()` from other frameworks,
  Needle DI has no parameter decorators.
- Don't call `inject()` outside an injection context, use `container.get()` there instead.
- Don't create a new `Container` per service, bootstrap a single container (or use
  [child containers](/advanced/child-containers) for scoping).

### Canonical example

```typescript
import { Container, inject, injectable } from "@needle-di/core";

@injectable()
class FooService {}

@injectable()
class BarService {
  constructor(private fooService = inject(FooService)) {}
}

const container = new Container();
const barService = container.get(BarService);
```
