import de from './locales/de.json';

type Params = Record<string, string | number>;
const translations: Record<string, Record<string, string>> = { de: de.runtime };

export function text(locale: string, key: string, params: Params = {}, fallback = key): string {
  const value = translations[locale.split('-')[0] ?? locale]?.[key];
  if (!value) return fallback;
  return value.replace(/{{(\w+)}}/g, (_, name: string) => String(params[name] ?? ''));
}
