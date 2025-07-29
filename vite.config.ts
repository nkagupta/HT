import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Get the repository name from package.json or environment
const getBasePath = () => {
  // For GitHub Pages, the base path should be your repository name
  // You can set this as an environment variable or modify it manually
  return process.env.GITHUB_REPOSITORY?.split('/')[1] ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` : '/';
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? getBasePath() : '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    // Ensure environment variables are available during build
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    // Don't fail build on warnings
    rollupOptions: {
      onwarn(warning, warn) {
        // Skip certain warnings during build
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
        warn(warning);
      }
    }
  }
});
