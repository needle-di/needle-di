import { defineConfig, type UserConfig } from "vitepress";
import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import llmsTxt, {
  copyOrDownloadAsMarkdownButtons,
} from "vitepress-plugin-llms";

import packageJson from "../../../package.json" with { type: "json" };

import { JSR_ICON } from "./jsr.icon.js";

const SITE_URL = "https://needle-di.io";

type VitePlugins = NonNullable<NonNullable<UserConfig["vite"]>["plugins"]>;

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Needle DI",
  description: "A lightweight, type-safe Dependency Injection (DI) library",
  head: [["link", { rel: "icon", href: "/favicon.ico" }]],
  sitemap: {
    hostname: SITE_URL,
  },
  vite: {
    // cast needed as long as the plugin resolves a different Vite version than VitePress does
    plugins: [
      llmsTxt({
        domain: SITE_URL,
        title: "Needle DI",
        description:
          "A lightweight, type-safe dependency injection library for JavaScript and TypeScript",
        details: [
          "Needle DI documentation for AI agents.",
          "",
          "Needle DI is a stand-alone dependency injection library. It requires no reflection libraries",
          "(such as `reflect-metadata`), no `experimentalDecorators` and no `emitDecoratorMetadata`.",
          "It uses native ECMAScript decorators and is published as `@needle-di/core` on npm and JSR.",
          "",
          "Use this file as an index for discovering relevant Needle DI documentation.",
          "",
          "Citation policy:",
          "- Do not cite `llms.txt` or `llms-full.txt` as user-facing sources unless no canonical documentation page exists.",
          `- When citing Needle DI documentation, prefer the canonical documentation page on \`${SITE_URL}/\`.`,
          "- If a link points to a `.md` file, cite the corresponding documentation page instead.",
          `- For example, cite \`${SITE_URL}/concepts/binding.html\` instead of \`${SITE_URL}/concepts/binding.md\`.`,
        ].join("\n"),
        ignoreFiles: ["advanced/injection-tokens.md", "advanced/providers.md"],
      }),
    ] as VitePlugins,
  },
  markdown: {
    codeTransformers: [transformerTwoslash()],
    config(md) {
      md.use(copyOrDownloadAsMarkdownButtons);
    },
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
          { text: "Scopes", link: "/advanced/scopes" },
        ],
      },
      {
        text: "AI",
        collapsed: true,
        items: [
          { text: "Agent instructions", link: "/ai/agents" },
          { text: "Docs list", link: "/llms.txt", target: "_blank" },
          { text: "Full docs", link: "/llms-full.txt", target: "_blank" },
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
