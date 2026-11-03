/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // A relative base lets the built app run from any folder or static host.
  base: './',
  // The vendored Pattern Monster data is one ~940 kB chunk that loads on demand.
  build: { chunkSizeWarningLimit: 1000 },
  // In development the Worker runs under wrangler dev on 8788. Forwarding its routes keeps the tab and the MCP on one origin.
  server: {
    port: 5173,
    proxy: { '/mcp': 'http://127.0.0.1:8788', '/session': { target: 'http://127.0.0.1:8788', ws: true } },
  },
  test: { environment: 'node' },
});
