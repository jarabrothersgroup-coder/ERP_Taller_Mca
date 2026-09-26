import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "web/.next/**",
      "web/node_modules/**",
      "web/playwright-report/**",
      "web/test-results/**",
      "*.config.*",
      "web/*.config.*",
      "web/next.config.mjs",
      "web/postcss.config.js",
    ],
  },
  {
    // Node.js runtime (server-side TS)
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Node.js CLI scripts (operan sobre el repo, imprimen reportes)
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    // Legacy vanilla-JS frontend served from src/shared/public
    // Global-scope app: todos los scripts comparten globals (api, fmt, render*)
    // via <script defer> — no-undef da falsos positivos entre archivos.
    files: ["src/shared/public/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    // Service worker (web/public/sw.js)
    files: ["web/public/sw.js", "**/sw.js"],
    languageOptions: {
      globals: { ...globals.serviceworker },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-expressions": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Permitir catch vacío intencional (degradación silenciosa no crítica)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Ruido: prefer-const y no-useless-escape son auto-fixables; mantener como warning
      "prefer-const": "warn",
      "no-useless-escape": "warn",
      // Reglas nuevas ruidosas: falsos positivos en patrones existentes
      // (init-then-reassign donde el valor SÍ se usa después; errores que
      //  ya incluyen el mensaje original sin necesitar encadenar `cause`)
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",
    },
  },
);
