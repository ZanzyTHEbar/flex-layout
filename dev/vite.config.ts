import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
    optimizeDeps: {
        extensions: ['jsx', 'tsx'],
        esbuildOptions: {
            target: 'esnext',
        },
    },
    plugins: [
        solidPlugin(),
        {
            name: 'Replace env variables',
            transform(code, id) {
                if (id.includes('node_modules')) {
                    return code
                }
                return code
                    .replace(/process\.env\.SSR/g, 'false')
                    .replace(/process\.env\.DEV/g, 'true')
                    .replace(/process\.env\.PROD/g, 'false')
                    .replace(/process\.env\.NODE_ENV/g, '"development"')
                    .replace(/import\.meta\.env\.SSR/g, 'false')
                    .replace(/import\.meta\.env\.DEV/g, 'true')
                    .replace(/import\.meta\.env\.PROD/g, 'false')
                    .replace(/import\.meta\.env\.NODE_ENV/g, '"development"')
            },
        },
    ],
    server: {
        host: true,
        port: 5478,
        strictPort: true,
    },
    build: {
        target: 'esnext',
    },
})