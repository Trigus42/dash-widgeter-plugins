import { useMemo } from 'react';
import { useWidgetData, type ReactWidgetProps } from '@/sandbox/react';
import { describeWeather } from './wmo';
import { WeatherIcon } from './WeatherIcon';
import { buildWeatherUrl, mapOpenMeteo, nextPrecipEvent, weatherCacheKey } from './service';
import { readWeatherConfig, type WeatherData } from './types';

/** "in 25 min" / "in 2 h" — compact, locale-neutral relative label. */
function formatLeadTime(minutes: number): string {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `in ${hours} h`;
}

const REFRESH_MS = 15 * 60 * 1000;

/**
 * Compact current-conditions widget, running in the plugin sandbox. Data flows
 * through the shared host layer via useWidgetData (dedup/cache/offline); the
 * fetch runs here through context.http, which the host pins to the manifest's
 * Open-Meteo allowlist.
 */
export function WeatherWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readWeatherConfig(context.config), [context.config]);
  const { data, error } = useWidgetData<WeatherData>(context, {
    key: [weatherCacheKey(config)],
    fetcher: async () => {
      const res = await context.http({ url: buildWeatherUrl(config), proxy: 'auto' });
      if (!res.ok) throw new Error(`Open-Meteo failed (${res.status})`);
      return mapOpenMeteo(res.data);
    },
    refetchIntervalMs: REFRESH_MS,
    staleMessage: 'Offline — showing last weather',
    errorMessage: 'Weather unavailable',
  });

  if (error && !data) {
    return (
      <div className="weather-widget weather-error" role="alert">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="weather-widget weather-loading">Loading weather…</div>;
  }

  const current = describeWeather(data.weatherCode);
  const nextEvent = config.showNextEvent ? nextPrecipEvent(data, Date.now()) : null;
  const nextDescription = nextEvent ? describeWeather(nextEvent.weatherCode) : null;

  return (
    <div className="weather-widget">
      <div className="weather-current">
        <WeatherIcon icon={current.icon} size={64} />
        <div className="weather-temp">
          <span className="weather-value">
            {Math.round(data.temperature)}
            {data.unitLabel}
          </span>
          <span className="weather-desc">{current.label}</span>
          {config.showTitle && <span className="weather-loc">{config.locationName}</span>}
        </div>
      </div>
      {nextEvent && nextDescription && (
        <div className="weather-next" title="Next precipitation">
          <WeatherIcon icon={nextDescription.icon} size={18} />
          <span className="weather-next-text">
            {nextDescription.label} {formatLeadTime(nextEvent.minutesUntil)}
          </span>
        </div>
      )}
    </div>
  );
}
