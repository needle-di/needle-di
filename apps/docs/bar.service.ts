import { inject, injectable } from "@needle-di/core";

import { FooService } from "./foo.service.js";

@injectable()
export class BarService {
  constructor(private fooService = inject(FooService)) {}
}
