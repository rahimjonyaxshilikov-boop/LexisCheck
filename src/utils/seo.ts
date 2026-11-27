import type { AppView } from '../types/quiz';
import { getUnitByNumber } from '../data/units';
import { parseUnitNumberFromPathname } from './sitemapBuilder';

const DEFAULT_TITLE = 'LexisCheck — Upper-Intermediate Vocabulary Tests';
const DEFAULT_DESCRIPTION =
  "English Vocabulary in Use Upper-Intermediate (1–101-unitlar) bo'yicha o'quvchilar lug'at bilimini tekshiruvchi va baholovchi interaktiv test platformasi.";

function upsertMeta(attrName: 'name' | 'property', attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"]`,
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function syncPageSeo(view: AppView, unitLabel?: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
  const ogImageUrl = `${window.location.origin}/og-cover.jpg`;

  upsertCanonical(canonicalUrl);
  upsertMeta('property', 'og:url', canonicalUrl);
  upsertMeta('property', 'og:image', ogImageUrl);
  upsertMeta('name', 'twitter:image', ogImageUrl);

  const routeUnitNumber = parseUnitNumberFromPathname(window.location.pathname);
  const routeUnit = routeUnitNumber ? getUnitByNumber(routeUnitNumber) : undefined;

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;

  if (view === 'testing' && unitLabel) {
    title = `${unitLabel} — LexisCheck`;
  } else if (view === 'results' && unitLabel) {
    title = `Natijalar: ${unitLabel} — LexisCheck`;
  } else if (routeUnit && (view === 'login' || view === 'units')) {
    title = `Unit ${routeUnit.unitNumber}: ${routeUnit.title} — LexisCheck`;
    description = `English Vocabulary in Use Upper-Intermediate Unit ${routeUnit.unitNumber} (${routeUnit.title}): ${routeUnit.subtitle}. ${routeUnit.questions.length} ta test savoli va ${routeUnit.vocab.length} ta asosiy soʻz.`;
  } else if (view === 'units') {
    title = 'Unitlar katalogi (1–101) — LexisCheck';
  } else if (view === 'profile') {
    title = 'Oʻquvchi profili — LexisCheck';
  } else if (view === 'teacher') {
    title = 'Oʻqituvchi paneli — LexisCheck';
  }

  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
}
