import { defineConfig } from "vitest/config";

// Config mínima do runner de teste — ver docs/plano-testes.md § 1 para a
// justificativa de escolher Vitest. `resolve.tsconfigPaths` resolve o alias
// `@/*` direto do tsconfig.json, sem precisar espelhar o mapeamento aqui.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
  },
});
