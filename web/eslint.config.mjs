import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'dist/**', 'build/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'out/**', 'test-results/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Archivos de configuración (next/postcss/tailwind): ámbito Node.
    // `public/sw.js` va en ignores: es un service worker con globals de
    // worker (self, caches, fetch) servido tal cual, no código de la app.
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
);
