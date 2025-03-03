# Changelog

## [0.12.0](https://github.com/needle-di/needle-di/compare/v0.11.2...v0.12.0) (2025-03-03)


### Features

* add support for lazy injection ([#76](https://github.com/needle-di/needle-di/issues/76)) ([df5c01b](https://github.com/needle-di/needle-di/commit/df5c01b2a1d672296e32cfdee4f7aa57ba365a41))

## [0.11.2](https://github.com/needle-di/needle-di/compare/v0.11.1...v0.11.2) (2025-02-25)


### Documentation

* restore README for NPM and JSR ([3caae70](https://github.com/needle-di/needle-di/commit/3caae7037099ea3d4070473fe1d81161e8b9dec8))

## [0.11.1](https://github.com/needle-di/needle-di/compare/v0.11.0...v0.11.1) (2025-02-25)


### Miscellaneous Chores

* fixing release ([e3ca018](https://github.com/needle-di/needle-di/commit/e3ca01833e76aa8062d5e3c1cb89acd62e47ab35))
* transform repository into monorepo with Turbo ([#69](https://github.com/needle-di/needle-di/issues/69)) ([c753a66](https://github.com/needle-di/needle-di/commit/c753a66337d73ee8334e7710a757f414f069eb7c))

## [0.11.0](https://github.com/needle-di/core/compare/v0.10.1...v0.11.0) (2025-02-23)


### Features

* add support for child containers ([#64](https://github.com/needle-di/core/issues/64)) ([b1a1cbf](https://github.com/needle-di/core/commit/b1a1cbf69821b077458d2d8b184e3b2b644323a9))
* **container:** add `container.has()` method ([#65](https://github.com/needle-di/core/issues/65)) ([5452b44](https://github.com/needle-di/core/commit/5452b44f505243204354d57673697017e20c500c))

## [0.10.1](https://github.com/needle-di/needle-di/compare/v0.10.0...v0.10.1) (2025-01-17)


### Bug Fixes

* fix incorrect type inference for injection tokens ([#58](https://github.com/needle-di/needle-di/issues/58)) ([9edb073](https://github.com/needle-di/needle-di/commit/9edb073a9186fd434180d0e7d189e4e786f7abe3))

## [0.10.0](https://github.com/needle-di/needle-di/compare/v0.9.0...v0.10.0) (2025-01-16)


### Features

* auto-bind container to itself ([#52](https://github.com/needle-di/needle-di/issues/52)) ([86936f6](https://github.com/needle-di/needle-di/commit/86936f6459d92ffdd4efaa452f9cb1c129ec558b))

## [0.9.0](https://github.com/needle-di/needle-di/compare/v0.8.4...v0.9.0) (2025-01-16)


### Features

* pass container instance to factory providers ([#50](https://github.com/needle-di/needle-di/issues/50)) ([1faf2dc](https://github.com/needle-di/needle-di/commit/1faf2dc025594ab913ec18afaa244ab99579b1eb))

## [0.8.4](https://github.com/needle-di/needle-di/compare/v0.8.3...v0.8.4) (2024-10-05)


### Documentation

* add remaining missing JSDoc documentation ([b9ffc3d](https://github.com/needle-di/needle-di/commit/b9ffc3d51ab4ed6c24f7fae3b51b3907c2b0851f))

## [0.8.3](https://github.com/needle-di/needle-di/compare/v0.8.2...v0.8.3) (2024-10-05)


### Bug Fixes

* fix Release Me tagging strategy ([#39](https://github.com/needle-di/needle-di/issues/39)) ([21a182b](https://github.com/needle-di/needle-di/commit/21a182b7eef543fbcdcba056c841c4ccc528a7e8))

## [0.8.2](https://github.com/needle-di/needle-di/compare/v0.8.1...v0.8.2) (2024-10-05)


### Bug Fixes

* fix JSR bumping issues by adopting Release Please config ([#33](https://github.com/needle-di/needle-di/issues/33)) ([977fc94](https://github.com/needle-di/needle-di/commit/977fc9457e91b1f2640e6e217973ad9684c82dc7))


### Documentation

* fix incorrect Github links ([60783f3](https://github.com/needle-di/needle-di/commit/`60783f3f4800ca64c676c31bfebbf93c20a2123b`))


### Miscellaneous Chores

* add release-please bootstrap file ([bc6ee60](https://github.com/needle-di/needle-di/commit/bc6ee6002697ba9c0255f3f800db9747456c927e))
* fix changelog generation ([1da6bde](https://github.com/needle-di/needle-di/commit/1da6bde5247c08e9d472358e6dc70faad41f9772))

## [0.8.1](https://github.com/needle-di/needle-di/compare/v0.8.0...v0.8.1) (2024-10-05)


### Bug Fixes

* add @release-it/bumper as dependency to fix bumping issues ([#31](https://github.com/needle-di/needle-di/issues/31)) ([0acc865](https://github.com/needle-di/needle-di/commit/0acc865784d5137a242e728593ed4738f1a77955))

## [0.8.0](https://github.com/needle-di/needle-di/compare/v0.7.0...v0.8.0) (2024-10-05)


### Miscellaneous Chores

* migrate package to @needle-di/core + JavaScript Registry (JSR) adoption ([a3f523a](https://github.com/needle-di/needle-di/commit/a3f523a05971343fd15faccdc012eec8e1e0f9c8))

## [0.7.0](https://github.com/needle-di/needle-di/compare/v0.6.1...v0.7.0) (2024-09-30)


### Features

* auto-register parent classes for manual bindings as well ([#26](https://github.com/needle-di/needle-di/issues/26)) ([d3d909f](https://github.com/needle-di/needle-di/commit/d3d909fc603c74d4c81968d64545091b6bd7e437))

## [0.6.1](https://github.com/needle-di/needle-di/compare/v0.6.0...v0.6.1) (2024-09-29)


### Bug Fixes

* fix incorrect type-inference on bindAll() method ([#22](https://github.com/needle-di/needle-di/issues/22)) ([7a2e3bd](https://github.com/needle-di/needle-di/commit/7a2e3bdf2b22d194cefb0dcd3d4b2ddb9589516b))


### Documentation

* improved docs and added JSDocs ([#24](https://github.com/needle-di/needle-di/issues/24)) ([7084676](https://github.com/needle-di/needle-di/commit/708467639a60603b63cb7405ecaeaadaf2979562))

## [0.6.0](https://github.com/needle-di/needle-di/compare/v0.5.0...v0.6.0) (2024-09-28)


### Features

* allow synchronous constructor injection of async providers ([#20](https://github.com/needle-di/needle-di/issues/20)) ([6cf3ec3](https://github.com/needle-di/needle-di/commit/6cf3ec3eabd88f541d6714b56ca0b70ab5e779a2))

## [0.5.0](https://github.com/needle-di/needle-di/compare/v0.4.0...v0.5.0) (2024-09-28)


### Documentation

* add Vitepress site with Github Pages ([#18](https://github.com/needle-di/needle-di/issues/18)) ([245efbe](https://github.com/needle-di/needle-di/commit/245efbe4def6a1c0647cfc6c06c299968ad0eec9))

## [0.4.0](https://github.com/needle-di/needle-di/compare/v0.3.0...v0.4.0) (2024-09-26)


### Miscellaneous Chores

* move NPM package to 'needle-di' ([7348441](https://github.com/needle-di/needle-di/commit/7348441931179971dd41ac6583876faee3cfd241))

## [0.3.0](https://github.com/needle-di/needle-di/compare/v0.2.0...v0.3.0) (2024-09-22)


### Features

* **providers:** flatten multi-providers when using useExisting ([#10](https://github.com/needle-di/needle-di/issues/10)) ([48df581](https://github.com/needle-di/needle-di/commit/48df581ec4901ecdd642cc7c64e527de71d1ec48))

## [0.2.0](https://github.com/needle-di/needle-di/compare/v0.1.0...v0.2.0) (2024-09-20)


### Features

* **providers:** add support for multi-providers ([#8](https://github.com/needle-di/needle-di/issues/8)) ([b563a1c](https://github.com/needle-di/needle-di/commit/b563a1c1fbc9d9e3adb487459d611655ad0c6a15))

## [0.1.0](https://github.com/needle-di/needle-di/compare/v0.0.3...v0.1.0) (2024-09-19)


### Features

* support async token factories ([#5](https://github.com/needle-di/needle-di/issues/5)) ([f39d6cd](https://github.com/needle-di/needle-di/commit/f39d6cd28d6fdb96664f82f084d9ed55405ece4b))


### Bug Fixes

* **inheritance:** trigger auto-binding when using parent class as token ([#7](https://github.com/needle-di/needle-di/issues/7)) ([0edbec7](https://github.com/needle-di/needle-di/commit/0edbec733800c1919d0577e2bfcfa66d9bc14fb9))

## 0.0.3 (2024-09-18)


### Features

* inheritance support / added more tests ([#1](https://github.com/needle-di/needle-di/issues/1)) ([13f626c](https://github.com/needle-di/needle-di/commit/13f626ce3985f447e11f371ff476f5da2907f067))


### Bug Fixes

* export injectAsync and AsyncFactoryProvider ([02d5fb0](https://github.com/needle-di/needle-di/commit/02d5fb07f6dd2b8bfa157cc438f8f3d9625c1630))


### Miscellaneous Chores

* release 0.0.3 ([1f8768f](https://github.com/needle-di/needle-di/commit/1f8768faceceab651175433d20c853a03c404a3d))
