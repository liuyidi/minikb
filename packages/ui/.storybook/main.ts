import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import remarkGfm from "remark-gfm";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const chatDir = path.resolve(dirname, "../../chat");

const config: StorybookConfig = {
  stories: [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(ts|tsx)",
    `${chatDir}/stories/**/*.stories.@(ts|tsx)`,
  ],
  addons: [
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
  ],
  core: {
    disableTelemetry: true,
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          "@minikb/ui": path.resolve(dirname, ".."),
          "@minikb/chat": chatDir,
        },
      },
      // build-storybook writes here; watching it causes dev reload loops.
      server: {
        watch: {
          ignored: ["**/storybook-static/**"],
        },
      },
    });
  },
};

export default config;
