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
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  }
);
