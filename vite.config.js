import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/panhellenic/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        field: resolve(__dirname, 'field.html'),
        strategy: resolve(__dirname, 'strategy.html'),
        profile: resolve(__dirname, 'profile.html'),
        about: resolve(__dirname, 'about.html'),
        faq: resolve(__dirname, 'faq.html'),
        guide: resolve(__dirname, 'guide.html'),
        detailed_prediction: resolve(__dirname, 'detailed_prediction.html'),
        weights: resolve(__dirname, 'weights.html'),
      }
    }
  }
});
