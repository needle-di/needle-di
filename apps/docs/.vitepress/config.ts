import { defineConfig } from "vitepress";
import { transformerTwoslash } from "@shikijs/vitepress-twoslash";

import packageJson from "../../../package.json" with { type: "json" };

import { JSR_ICON } from "./jsr.icon.js";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Needle DI",
  description: "A lightweight, type-safe Dependency Injection (DI) library",
  head: [["link", { rel: "icon", href: "/favicon.ico" }]],
  markdown: {
    codeTransformers: [transformerTwoslash()],
  },
  themeConfig: {
    siteTitle: "Needle DI",
    search: {
      provider: "local",
    },

    editLink: {
      pattern:
        "https://github.com/needle-di/needle-di/edit/main/apps/docs/:path",
    },

    lastUpdated: {
      text: "Last updated",
    },

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Home", link: "/" },
      { text: "Documentation", link: "/concepts/binding" },
      {
        text: `v${packageJson.version}`,
        items: [
          {
            items: [
              {
                text: `v${packageJson.version}`,
                link: `https://github.com/needle-di/needle-di/releases/tag/v${packageJson.version}`,
              },
              {
                text: "Changelog",
                link: "https://github.com/needle-di/needle-di/releases",
              },
            ],
          },
        ],
      },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "What is Needle DI?", link: "/what-is-needle-di" },
          { text: "Getting started", link: "/getting-started" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "Binding", link: "/concepts/binding" },
          { text: "Providers", link: "/concepts/providers" },
          { text: "Containers", link: "/concepts/containers" },
          { text: "Injection", link: "/concepts/injection" },
          { text: "Tokens", link: "/concepts/tokens" },
        ],
      },
      {
        text: "Advanced",
        items: [
          { text: "Optional injection", link: "/advanced/optional-injection" },
          { text: "Multi injection", link: "/advanced/multi-injection" },
          { text: "Async injection", link: "/advanced/async-injection" },
          { text: "Lazy injection", link: "/advanced/lazy-injection" },
          { text: "Inheritance", link: "/advanced/inheritance" },
          { text: "Tree-shaking", link: "/advanced/tree-shaking" },
          { text: "Child containers", link: "/advanced/child-containers" },
        ],
      },
      {
        text: "Changelog",
        link: "https://github.com/needle-di/needle-di/blob/main/CHANGELOG.md",
      },
      {
        text: "StackBlitz demo",
        link: "https://stackblitz.com/edit/needle-di",
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/needle-di/needle-di" },
      { icon: "npm", link: "https://www.npmjs.com/package/@needle-di/core" },
      { icon: { svg: JSR_ICON }, link: "https://jsr.io/@needle-di/core" },
    ],

    footer: {
      message: "Released under the MIT License",
      copyright: "Copyright © 2024 - 2026 Dirk Luijk",
    },
  },
});
