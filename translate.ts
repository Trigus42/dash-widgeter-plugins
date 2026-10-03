import calendarDe from './calendar/locales/de.json';
import immichDe from './immich/locales/de.json';
import weatherDe from './weather/locales/de.json';

type Params = Record<string, string | number>;

const translations: Record<string, Record<string, Record<string, string>>> = {
  calendar: { de: calendarDe.runtime },
  immich: { de: immichDe.runtime },
  weather: { de: weatherDe.runtime },
};

export function pluginText(locale: string, key: string, params: Params = {}, fallback = key): string {
  const [pluginId, ...parts] = key.split('.');
  const value = pluginId ? translations[pluginId]?.[locale.split('-')[0] ?? locale]?.[parts.join('.')] : undefined;
  if (typeof value !== 'string') return fallback;
  return value.replace(/{{(\w+)}}/g, (_, name: string) => String(params[name] ?? ''));
}
