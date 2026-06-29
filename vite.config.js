import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        field: resolve(__dirname, 'field.html'),
        about: resolve(__dirname, 'about.html'),
        faq: resolve(__dirname, 'faq.html'),
        guide: resolve(__dirname, 'guide.html'),
        detailed_prediction: resolve(__dirname, 'detailed_prediction.html'),
        weights: resolve(__dirname, 'weights.html'),
        field_1: resolve(__dirname, 'field_1.html'),
        field_2: resolve(__dirname, 'field_2.html'),
        field_3: resolve(__dirname, 'field_3.html'),
        field_4: resolve(__dirname, 'field_4.html'),
      }
    }
  }
});
