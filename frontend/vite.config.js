import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
    // Pin the HMR websocket to localhost so it doesn't try to connect via the
    // 0.0.0.0 bind (which fails with "failed to connect to websocket").
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      clientPort: Number(process.env.PORT) || 5173,
    },
  },
});
