import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Mesma CSP do deploy (render.yaml), aplicada no `vite preview` para testar o build com ela.
function politica(apiUrl: string) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${new URL(apiUrl).origin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true },
    preview: {
      port: 5173,
      strictPort: true,
      headers: {
        'Content-Security-Policy': politica(env.VITE_API_URL ?? 'http://localhost:3000/api/v1'),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      }
    },
    build: { sourcemap: false }
  };
});
