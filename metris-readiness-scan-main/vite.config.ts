// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    /* Keeps anything under src/server/** and any `server-only` import from
       being pulled into a client bundle — the guard that stops the Stripe key,
       the sheet secret or the Zoom link reaching the browser. `error` means a
       violation fails the build rather than shipping quietly. */
    importProtection: {
      behavior: "error",
      client: {
        files: ["**/server/**"],
        specifiers: ["@tanstack/react-start/server-only"],
      },
    },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
