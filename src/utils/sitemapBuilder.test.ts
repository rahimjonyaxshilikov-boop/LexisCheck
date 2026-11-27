import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSitemapXml,
  parseSitemapIndex,
  parseUnitNumberFromPathname,
  toUnitPath,
  toUnitSlug,
} from './sitemapBuilder';
import { ALL_UNITS } from '../data/units';

test('data/sitemap_index.json contains complete metadata for all 101 units', () => {
  const indexPath = path.resolve(process.cwd(), 'data', 'sitemap_index.json');
  assert.equal(fs.existsSync(indexPath), true, 'data/sitemap_index.json must exist');

  const raw = fs.readFileSync(indexPath, 'utf8');
  const parsed = parseSitemapIndex(raw);

  assert.equal(parsed.totalUnits, 101);
  assert.equal(parsed.units.length, 101);

  const seenSlugs = new Set<string>();
  const seenPaths = new Set<string>();

  parsed.units.forEach((entry, idx) => {
    const expectedUnit = ALL_UNITS[idx];
    assert.equal(entry.unitNumber, idx + 1);
    assert.equal(entry.title, expectedUnit.title);
    assert.equal(entry.subtitle, expectedUnit.subtitle);
    assert.equal(entry.slug, toUnitSlug(expectedUnit.unitNumber, expectedUnit.title));
    assert.equal(entry.path, toUnitPath(expectedUnit.unitNumber));
    assert.equal(entry.questionCount, expectedUnit.questions.length);
    assert.equal(entry.vocabCount, expectedUnit.vocab.length);
    assert.ok(entry.seoTitle.includes(`Unit ${entry.unitNumber}`));
    assert.ok(entry.seoDescription.length >= 60);
    assert.ok(entry.keywords.length >= 5);
    assert.equal(seenSlugs.has(entry.slug), false);
    assert.equal(seenPaths.has(entry.path), false);
    seenSlugs.add(entry.slug);
    seenPaths.add(entry.path);
  });
});

test('buildSitemapXml emits root URL plus individual URL entries for all 101 units', () => {
  const indexPath = path.resolve(process.cwd(), 'data', 'sitemap_index.json');
  const parsed = parseSitemapIndex(fs.readFileSync(indexPath, 'utf8'));

  const xml = buildSitemapXml('https://lexischeck.vercel.app/', parsed.units, '2026-11-27');

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.ok(xml.includes('<loc>https://lexischeck.vercel.app/</loc>'));
  assert.ok(xml.includes('<loc>https://lexischeck.vercel.app/unit/1</loc>'));
  assert.ok(xml.includes('<loc>https://lexischeck.vercel.app/unit/50</loc>'));
  assert.ok(xml.includes('<loc>https://lexischeck.vercel.app/unit/101</loc>'));
  assert.ok(xml.includes('<lastmod>2026-11-27</lastmod>'));

  const urlCount = (xml.match(/<url>/g) ?? []).length;
  assert.equal(urlCount, 102);
});

test('buildSitemapXml escapes XML special characters safely', () => {
  const xml = buildSitemapXml(
    'https://example.com',
    [
      {
        unitNumber: 1,
        slug: 'unit-1',
        path: '/unit/1?a=1&b=2',
        title: 'Test & Learn',
        subtitle: 'Sub',
        seoTitle: 'Unit 1',
        seoDescription: 'Desc',
        keywords: [],
        questionCount: 30,
        vocabCount: 10,
        changefreq: 'monthly',
        priority: '0.8',
      },
    ],
    '2026-11-27',
  );

  assert.ok(xml.includes('<loc>https://example.com/unit/1?a=1&amp;b=2</loc>'));
});

test('parseUnitNumberFromPathname parses valid unit routes and rejects invalid ones', () => {
  assert.equal(parseUnitNumberFromPathname('/unit/1'), 1);
  assert.equal(parseUnitNumberFromPathname('/unit/101'), 101);
  assert.equal(parseUnitNumberFromPathname('/unit/42-belief-and-opinion/'), 42);
  assert.equal(parseUnitNumberFromPathname('/unit/0'), null);
  assert.equal(parseUnitNumberFromPathname('/unit/102'), null);
  assert.equal(parseUnitNumberFromPathname('/'), null);
});
