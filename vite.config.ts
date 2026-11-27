import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildSitemapXml, parseSitemapIndex } from './src/utils/sitemapBuilder.ts';

function resolveDeployOrigin(): string | null {
  const candidates = [
    process.env.SITE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.APP_URL,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('ais-dev-')) {
      return trimmed;
    }
  }
  return null;
}

function loadUnitSitemapEntries() {
  const indexPath = path.resolve(import.meta.dirname, 'data', 'sitemap_index.json');
  if (!fs.existsSync(indexPath)) {
    return [];
  }
  const raw = fs.readFileSync(indexPath, 'utf8');
  return parseSitemapIndex(raw).units;
}

function lexischeckSeoBuildPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'lexischeck-seo-build',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist';
    },
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, outDir);
      const origin = resolveDeployOrigin();
      if (!origin || !fs.existsSync(distDir)) return;

      const today = new Date().toISOString().slice(0, 10);
      const unitEntries = loadUnitSitemapEntries();
      const sitemapXml = buildSitemapXml(origin, unitEntries, today);
      fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');

      const robotsTxt = `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
      fs.writeFileSync(path.join(distDir, 'robots.txt'), robotsTxt, 'utf8');

      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html
          .replace(/content="\/og-cover\.jpg"/g, `content="${origin}/og-cover.jpg"`)
          .replace(
            '</head>',
            `    <link rel="canonical" href="${origin}/" />\n    <meta property="og:url" content="${origin}/" />\n  </head>`,
          );
        fs.writeFileSync(indexPath, html, 'utf8');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), lexischeckSeoBuildPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

