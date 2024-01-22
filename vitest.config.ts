import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
    // to test in server environment, run with "--mode ssr" or "--mode test:ssr" flag
    // loads only server.test.ts file
    const testSSR = mode === 'test:ssr' || mode === 'ssr'
    return {
        plugins: [
            solidPlugin({
                // https://github.com/solidjs/solid-refresh/issues/29
                hot: false,
                // For testing SSR we need to do a SSR JSX transform
                solid: { omitNestedClosingTags: false, generate: testSSR ? 'ssr' : 'dom' },
                babel: {
                    plugins: ['babel-plugin-macros'],
                },
            }),
        ],
        test: {
            watch: false,
            isolate: !testSSR,
            env: {
                NODE_ENV: testSSR ? 'production' : 'development',
                DEV: testSSR ? '' : '1',
                SSR: testSSR ? '1' : '',
                PROD: testSSR ? '1' : '',
            },
            environment: testSSR ? 'node' : 'jsdom',
            deps: {
                inline: ['vitest-canvas-mock'],
            },
            coverage: {
                reporter: ['lcovonly', 'text'],
            },
            transformMode: { web: [/\.[jt]sx$/] },
            ...(testSSR
                ? {
                    include: ['test/server.test.{ts,tsx}'],
                }
                : {
                    include: ['test/*.test.{ts,tsx}'],
                    exclude: ['test/server.test.{ts,tsx}'],
                }),
        },
        resolve: {
            conditions: testSSR ? ['node'] : ['browser', 'development'],
        },
        
    }
})
