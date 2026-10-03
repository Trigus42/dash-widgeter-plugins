import { useMemo } from 'react';
import { usePullToRefresh, useWidgetData, type ReactWidgetProps } from '@/sandbox/react';
import { describeWeather } from './wmo';
import { WeatherIcon } from './WeatherIcon';
import { buildWeatherUrl, mapOpenMeteo, nextPrecipEvent, weatherCacheKey } from './service';
import { readWeatherConfig, type WeatherData } from './types';
import { pluginText } from '@/plugins/translate';

/** "in 25 min" / "in 2 h" — compact, locale-neutral relative label. */
function formatLeadTime(locale: string, minutes: number): string {
  if (minutes < 1) return pluginText(locale, 'weather.now');
  if (minutes < 60) return pluginText(locale, 'weather.inMinutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  return pluginText(locale, 'weather.inHours', { count: hours });
}

/**
 * Compact current-conditions widget, running in the plugin sandbox. Data flows
 * through the shared host layer via useWidgetData (dedup/cache/offline); the
 * fetch runs here through context.http, which the host pins to the manifest's
 * Open-Meteo allowlist.
 */
export function WeatherWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readWeatherConfig(context.config), [context.config]);
  const { data, error, refetch } = useWidgetData<WeatherData>(context, {
    key: [weatherCacheKey(config)],
    fetcher: async () => {
      const res = await context.http({ url: buildWeatherUrl(config), proxy: 'auto' });
      if (!res.ok) throw new Error(`Open-Meteo failed (${res.status})`);
      return mapOpenMeteo(res.data);
    },
    refetchIntervalMs: config.refreshIntervalMinutes * 60 * 1000,
    staleMessage: 'Offline — showing last weather',
    errorMessage: 'Weather unavailable',
  });

  const containerRef = usePullToRefresh(refetch);

  if (error && !data) {
    return (
      <div className="weather-widget weather-error" role="alert">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="weather-widget weather-loading">{pluginText(context.locale, 'weather.loading')}</div>;
  }

  const current = describeWeather(data.weatherCode);
  const nextEvent = config.showNextEvent ? nextPrecipEvent(data, Date.now()) : null;
  const nextDescription = nextEvent ? describeWeather(nextEvent.weatherCode) : null;

  return (
    <div ref={containerRef} className="weather-widget">
      <div className="weather-current">
        <WeatherIcon icon={current.icon} size={64} />
        <div className="weather-temp">
          <span className="weather-value">
            {Math.round(data.temperature)}
            {data.unitLabel}
          </span>
          <span className="weather-desc">{pluginText(context.locale, `weather.codes.${data.weatherCode}`, {}, current.label)}</span>
          {config.showTitle && <span className="weather-loc">{config.locationName}</span>}
        </div>
      </div>
      {nextEvent && nextDescription && (
        <div className="weather-next" title={pluginText(context.locale, 'weather.nextPrecipitation')}>
          <WeatherIcon icon={nextDescription.icon} size={18} />
          <span className="weather-next-text">
            {pluginText(context.locale, `weather.codes.${nextEvent.weatherCode}`, {}, nextDescription.label)} {formatLeadTime(context.locale, nextEvent.minutesUntil)}
          </span>
        </div>
      )}
    </div>
  );
}
