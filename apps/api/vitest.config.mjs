/** @type {import("vitest/config").UserConfig} */
export default {
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
};