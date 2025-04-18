import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        coverage: {
            provider: 'istanbul',
            all: true,
            exclude: [
                'node_modules/**',
                '.next/**',
                'src/app/**',
                'src/components/**',
                'src/context/**',
                'src/assets/**',
                '*.mjs'
            ]
        },
        environment: 'node',
        exclude: [
            'node_modules',
            '.next',
            'src/app/**',
            'src/components/**',
            'src/context/**',
            'src/assets/**',
            '*.mjs'
        ]
    }
});