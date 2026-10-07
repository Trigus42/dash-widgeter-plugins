import type { WebDavEntry } from './types';

/**
 * Parse a WebDAV PROPFIND 207 Multi-Status XML body into file entries. WebDAV
 * uses the `DAV:` namespace, but servers vary the prefix (`d:`, `D:`, none), so
 * we match by local name rather than a fixed prefix. Pure + exported so the
 * parsing is unit-tested without a live server.
 *
 * `collectionUrl` is the requested collection; its own self-entry is dropped so
 * only children remain. Relative hrefs are resolved against the server origin.
 */
export function parsePropfind(xml: string, collectionUrl: string): WebDavEntry[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  const origin = originOf(collectionUrl);
  const selfPath = pathOf(collectionUrl);
  const entries: WebDavEntry[] = [];

  for (const response of byLocalName(doc, 'response')) {
    const hrefEl = firstByLocalName(response, 'href');
    const rawHref = hrefEl?.textContent?.trim();
    if (!rawHref) continue;

    const href = resolveHref(rawHref, origin);
    // Skip the collection's own entry (self), keep only its children.
    if (pathOf(href) === selfPath) continue;

    const propstat = findOkPropstat(response);
    const prop = propstat ? firstByLocalName(propstat, 'prop') : null;

    const contentType = prop ? textByLocalName(prop, 'getcontenttype') : null;
    const lastModifiedRaw = prop ? textByLocalName(prop, 'getlastmodified') : null;
    const lastModified = lastModifiedRaw ? Date.parse(lastModifiedRaw) || null : null;

    const resourceType = prop ? firstByLocalName(prop, 'resourcetype') : null;
    const isCollection = resourceType ? byLocalName(resourceType, 'collection').length > 0 : false;

    entries.push({ href, contentType, isCollection, lastModified });
  }
  return entries;
}

/** The propstat whose status is 2xx (ignore 404/403 half-answers). */
function findOkPropstat(response: Element): Element | null {
  for (const propstat of byLocalName(response, 'propstat')) {
    const status = firstByLocalName(propstat, 'status')?.textContent ?? '';
    if (/\s2\d\d\s/.test(status)) return propstat;
  }
  // Some servers omit propstat/status; fall back to the first propstat.
  return firstByLocalName(response, 'propstat');
}

/**
 * Local name of an element, prefix-stripped. A spec-compliant XML parser already
 * exposes the bare local name, but a lenient (HTML) parser can leave the
 * qualified name (`d:response`); dropping anything before the colon makes
 * matching work under both without a namespace-aware query.
 */
function localNameOf(el: Element): string {
  const name = el.localName.toLowerCase();
  const colon = name.indexOf(':');
  return colon >= 0 ? name.slice(colon + 1) : name;
}

function byLocalName(root: Element | Document, local: string): Element[] {
  const all = root.getElementsByTagName('*');
  const out: Element[] = [];
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i];
    if (el && localNameOf(el) === local) out.push(el);
  }
  return out;
}

function firstByLocalName(root: Element, local: string): Element | null {
  return byLocalName(root, local)[0] ?? null;
}

function textByLocalName(root: Element, local: string): string | null {
  const el = firstByLocalName(root, local);
  const text = el?.textContent?.trim();
  return text && text.length > 0 ? text : null;
}

function originOf(url: string): string {
  const match = /^(https?:\/\/[^/]+)/i.exec(url);
  return match?.[1] ?? '';
}

function pathOf(url: string): string {
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/i, '');
  const path = withoutOrigin.split('?')[0] ?? withoutOrigin;
  // Normalize a trailing slash so a collection self-entry compares equal.
  return decodeURIComponent(path.replace(/\/+$/, '')) || '/';
}

/** Resolve a possibly-relative PROPFIND href against the server origin. */
function resolveHref(href: string, origin: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return `${origin}${href}`;
  return `${origin}/${href}`;
}
