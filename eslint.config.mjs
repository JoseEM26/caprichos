import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.git/**',
      '.claude/**',
      'actas/**',
      'adr/**',
      'analisis/**',
      'arquitectura/**',
      'backlog/**',
      'capri-bot/**',
      'datos/**',
      'dor/**',
      'epicas/**',
      'features/**',
      'gates/**',
      'historias/**',
      'mockup-web/**',
      'operacion/**',
      'project/**',
      'pruebas/**',
      'recursos/**',
      'roadmap/**',
      'scripts/**',
      'web-anterior/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // El proyecto no instala eslint-plugin-react-hooks, pero hay comentarios `eslint-disable react-hooks/exhaustive-deps`:
    // se declara la regla vacía para que ESLint no falle por «regla no encontrada».
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': { rules: { 'exhaustive-deps': { meta: { type: 'suggestion', schema: [] }, create: () => ({}) } } } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  }
);
