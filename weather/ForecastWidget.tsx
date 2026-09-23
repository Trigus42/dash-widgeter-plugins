import { useMemo } from 'react';
import { useWidgetData, type ReactWidgetProps } from '@/sandbox/react';
import { describeWeather } from './wmo';
import { WeatherIcon } from './WeatherIcon';
import { buildWeatherUrl, mapOpenMeteo, weatherCacheKey } from './service';
import { readWeatherConfig, type WeatherData } from './types';

const REFRESH_MS = 15 * 60 * 1000;

/**
 * Multi-day forecast widget — the second widget the weather plugin registers.
 * Shares the same cache key as WeatherWidget, so both fetch once and reuse the
 * host-cached result.
 */
export function ForecastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readWeatherConfig(context.config), [context.config]);
  const { data, error } = useWidgetData<WeatherData>(context, {
    key: [weatherCacheKey(config)],
    fetcher: async () => {
      const res = await context.http({ url: buildWeatherUrl(config), proxy: 'auto' });
      if (!res.ok) throw new Error(`Open-Meteo failed (${res.status})`);
      return mapOpenMeteo(res.data);
    },
    refetchIntervalMs: REFRESH_MS,
    staleMessage: 'Offline — showing last forecast',
    errorMessage: 'Forecast unavailable',
  });

  if (error && !data) {
    return (
      <div className="weather-widget weather-error" role="alert">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="weather-widget weather-loading">Loading forecast…</div>;
  }

  return (
    <div className="weather-widget">
      {config.showTitle && <div className="weather-forecast-header">{config.locationName}</div>}
      <div className="weather-forecast weather-forecast-full">
        {data.daily.slice(0, config.forecastDays).map((day, i) => {
          const d = describeWeather(day.weatherCode);
          return (
            <div key={day.dateMs} className="weather-day">
              <span className="weather-dow">
                {i === 0
                  ? 'Today'
                  : new Date(day.dateMs).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <WeatherIcon icon={d.icon} size={32} />
              <span className="weather-range">
                {Math.round(day.tempMax)}° / {Math.round(day.tempMin)}°
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
