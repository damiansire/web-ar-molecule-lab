import { defineConfig } from "vitest/config";

// Domain logic is pure (no DOM, no workers), so the fast Node environment is
// enough. The imperative shells (camera, worker, Three.js) are verified in a
// real browser instead.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
