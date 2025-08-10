import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.VITE_API_KEY': JSON.stringify(env.VITE_API_KEY),
        'process.env.GEMINI_VITE_API_KEY': JSON.stringify(env.GEMINI_VITE_API_KEY),
        'process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY': JSON.stringify(env.VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY),
        'process.env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT': JSON.stringify(env.VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
