import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import type { ClientRequest, IncomingMessage, ServerResponse } from 'http'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiUrl = env.VITE_API_URL || '/dev/api'
  const proxyTarget = env.VITE_PROXY_TARGET || 'https://i14e207.p.ssafy.io'

  return {
    plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/onnxruntime-web/dist/*',
            dest: 'ort-wasm'
          }
        ]
      })
    ],
    optimizeDeps: {
      exclude: ['onnxruntime-web'] // Vite가 이 패키지를 미리 최적화(번들링)하지 않게 설정
    },
    resolve: {
      // Node.js 전용 모듈은 rollupOptions.external에서 처리
    },
    build: {
      rollupOptions: {
        external: ['worker_threads', 'fs', 'path'], // Node 전용 모듈들을 외부 모듈로 처리해 무시
      }
    },
    define: {
      global: 'globalThis',
    },
    server: {
      proxy: {
        [apiUrl]: {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
          onProxyReq: (proxyReq: ClientRequest, req: IncomingMessage, _res: ServerResponse) => {
            // 일렉트론이 보낸 헤더는 req.headers에 들어있습니다.
            const signature = req.headers['x-signature'];
            const timestamp = req.headers['x-timestamp'];

            if (signature) {
              proxyReq.setHeader('X-Signature', signature as string);
            }
            if (timestamp) {
              proxyReq.setHeader('X-Timestamp', timestamp as string);
            }
          },
          rewrite: (path: string) => {
            // Local Backend (localhost:8081) doesn't have /api prefix, so remove it
            const isLocalTarget = env.VITE_PROXY_TARGET && env.VITE_PROXY_TARGET.includes('localhost')
            if (isLocalTarget && path.startsWith('/api')) {
              return path.replace(/^\/api/, '')
            }
            return path
          }
        },
      },
    },
  }
})
