// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig as lovableConfig } from "@lovable.dev/vite-tanstack-config";

export default async (env: any) => {
  const config = await lovableConfig({
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
  })(env);

  // Remove the "vite-tsconfig-paths" plugin and enable native resolve.tsconfigPaths
  // to rectify the Vite 8 deprecation warning.
  if (config.plugins) {
    config.plugins = (config.plugins as any[]).flat(Infinity).filter(
      (p: any) => p?.name !== "vite-tsconfig-paths" && p?.name !== "vite-plugin-tsconfig-paths",
    );
  }

  config.resolve = {
    ...config.resolve,
    tsconfigPaths: true,
  };

  return config;
};
