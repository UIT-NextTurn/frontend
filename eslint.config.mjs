import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier/flat';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierConfig,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'brain/**',
      'conductor/**',
      'docs/**',
      '.serena/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^$' }],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Use named exports only (except Next.js route convention files and root configs).',
        },
        {
          selector: 'TSEnumDeclaration[const=true]',
          message: 'Do not use const enum; use a plain enum or union type.',
        },
      ],
    },
  },
  {
    files: [
      'src/app/**/{page,layout,loading,error,not-found,global-error,template,default,route}.{ts,tsx}',
      'src/middleware.ts',
      'src/proxy.ts',
      '*.config.{ts,mjs,js}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration[const=true]',
          message: 'Do not use const enum; use a plain enum or union type.',
        },
      ],
    },
  },
];

export default eslintConfig;
