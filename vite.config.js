import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const logger = createLogger();
const logError = logger.error.bind(logger);
let lastRestartNotice = 0;

logger.error = (message, options) => {
  const error = options?.error;
  const connectionRefused = error?.code === 'ECONNREFUSED'
    || error?.errors?.some?.((entry) => entry.code === 'ECONNREFUSED');
  if (message.includes('http proxy error') && connectionRefused) {
    const now = Date.now();
    if (now - lastRestartNotice > 3000) {
      logger.warn('[dev] API temporarily unavailable while the Node server restarts; dashboard polling will retry.');
      lastRestartNotice = now;
    }
    return;
  }
  logError(message, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  root: '.',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
