import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Static output, deployed to GitHub Pages under /feizalsaid.github.io/
export default defineConfig({
  output: 'static',
  site: 'https://feizalsaid.github.io',
  // If deploying under a sub-path, set base. For a user/org page (username.github.io) leave ''.
  // For a project page under a repo, e.g. /portfolio/, set: base: '/portfolio/'
  base: '/',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
