import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { localFunctionBridge } from './scripts/vite-local-functions';

export default defineConfig(({ mode }) => {
  // Server-side local function handlers need the unprefixed Supabase values.
  // Vite still exposes only VITE_* variables to browser code.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), localFunctionBridge()],
    server: { port: 5173 },
    build: { sourcemap: true },
  };
});
