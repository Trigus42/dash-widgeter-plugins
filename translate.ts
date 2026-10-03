import en from '@/locales/en.json';
import de from '@/locales/de.json';

type Params = Record<string, string | number>;

export function pluginText(locale: string, key: string, params: Params = {}, fallback = key): string {
  const catalog = locale.startsWith('de') ? de : en;
  const value = key.split('.').reduce<unknown>(
    (entry, part) => typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>)[part] : undefined,
    catalog,
  );
  if (typeof value !== 'string') return fallback;
  return value.replace(/{{(\w+)}}/g, (_, name: string) => String(params[name] ?? ''));
}
