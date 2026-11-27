export interface SitemapUnitEntry {
  unitNumber: number;
  slug: string;
  path: string;
  title: string;
  subtitle: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  questionCount: number;
  vocabCount: number;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
}

export interface SitemapIndexFile {
  siteName: string;
  book: string;
  totalUnits: number;
  generatedAt: string;
  units: SitemapUnitEntry[];
}

export function toUnitSlug(unitNumber: number, title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/['’ʻ`"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? `unit-${unitNumber}-${normalized}` : `unit-${unitNumber}`;
}

export function toUnitPath(unitNumber: number): string {
  return `/unit/${unitNumber}`;
}

export function parseUnitNumberFromPathname(pathname: string): number | null {
  const match = pathname.match(/^\/unit\/(\d+)(?:-[a-z0-9-]+)?\/?$/i);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isInteger(num) || num < 1 || num > 101) return null;
  return num;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function parseSitemapIndex(rawJson: string): SitemapIndexFile {
  const parsed = JSON.parse(rawJson) as Partial<SitemapIndexFile>;
  if (!parsed || !Array.isArray(parsed.units)) {
    throw new Error('Invalid sitemap_index.json: missing "units" array');
  }

  const units: SitemapUnitEntry[] = parsed.units
    .filter(
      (item): item is SitemapUnitEntry =>
        Boolean(item) &&
        typeof item.unitNumber === 'number' &&
        Number.isInteger(item.unitNumber) &&
        typeof item.path === 'string' &&
        item.path.startsWith('/'),
    )
    .sort((a, b) => a.unitNumber - b.unitNumber);

  return {
    siteName: typeof parsed.siteName === 'string' ? parsed.siteName : 'LexisCheck',
    book:
      typeof parsed.book === 'string'
        ? parsed.book
        : 'English Vocabulary in Use — Upper-Intermediate',
    totalUnits: units.length,
    generatedAt:
      typeof parsed.generatedAt === 'string'
        ? parsed.generatedAt
        : new Date().toISOString().slice(0, 10),
    units,
  };
}

export function buildSitemapXml(
  origin: string,
  units: readonly SitemapUnitEntry[],
  lastmod: string = new Date().toISOString().slice(0, 10),
): string {
  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  const safeLastmod = escapeXml(lastmod);

  const rootUrlBlock = [
    '  <url>',
    `    <loc>${escapeXml(`${cleanOrigin}/`)}</loc>`,
    `    <lastmod>${safeLastmod}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
  ].join('\n');

  const unitUrlBlocks = units.map((unit) => {
    const cleanPath = unit.path.startsWith('/') ? unit.path : `/${unit.path}`;
    const priority = unit.priority || '0.8';
    const changefreq = unit.changefreq || 'monthly';
    return [
      '  <url>',
      `    <loc>${escapeXml(`${cleanOrigin}${cleanPath}`)}</loc>`,
      `    <lastmod>${safeLastmod}</lastmod>`,
      `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
      `    <priority>${escapeXml(priority)}</priority>`,
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    rootUrlBlock,
    ...unitUrlBlocks,
    '</urlset>',
    '',
  ].join('\n');
}
