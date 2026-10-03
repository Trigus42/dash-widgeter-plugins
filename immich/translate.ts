import de from './locales/de.json';

const translations: Record<string, Record<string, string>> = { de: de.runtime };

export function text(locale: string, key: string, fallback = key): string {
  return translations[locale.split('-')[0] ?? locale]?.[key] ?? fallback;
}
