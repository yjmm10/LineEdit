import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for specific keys to support legacy/backend-style env usage
      // We use JSON.stringify to ensure the value is a valid string token
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.BASE_URL': JSON.stringify(env.BASE_URL),
      // Create an explicit alias that won't conflict with import.meta.env.BASE_URL
      'process.env.OPENAI_BASE_URL': JSON.stringify(env.BASE_URL || env.OPENAI_BASE_URL),
      'process.env.MODEL_NAME': JSON.stringify(env.MODEL_NAME),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
  };
});
