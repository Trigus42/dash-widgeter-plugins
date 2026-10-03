import { useMemo } from 'react';
import { usePullToRefresh, useWidgetData, type ReactWidgetProps } from '@/sandbox/react';
import { describeWeather } from './wmo';
import { WeatherIcon } from './WeatherIcon';
import { buildWeatherUrl, mapOpenMeteo, weatherCacheKey } from './service';
import { readWeatherConfig, type WeatherData } from './types';
import { text } from './translate';

/**
 * Multi-day forecast widget — the second widget the weather plugin registers.
 * Shares the same cache key as WeatherWidget, so both fetch once and reuse the
 * host-cached result.
 */
export function ForecastWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readWeatherConfig(context.config), [context.config]);
  const { data, error, refetch } = useWidgetData<WeatherData>(context, {
    key: [weatherCacheKey(config)],
    fetcher: async () => {
      const res = await context.http({ url: buildWeatherUrl(config), proxy: 'auto' });
      if (!res.ok) throw new Error(`Open-Meteo failed (${res.status})`);
      return mapOpenMeteo(res.data);
    },
    refetchIntervalMs: config.refreshIntervalMinutes * 60 * 1000,
    staleMessage: 'Offline — showing last forecast',
    errorMessage: 'Forecast unavailable',
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
    return <div className="weather-widget weather-loading">{text(context.locale, 'loadingForecast')}</div>;
  }

  return (
    <div ref={containerRef} className="weather-widget">
      {config.showTitle && <div className="weather-forecast-header">{config.locationName}</div>}
      <div className="weather-forecast weather-forecast-full">
        {data.daily.slice(0, config.forecastDays).map((day, i) => {
          const d = describeWeather(day.weatherCode);
          return (
            <div key={day.dateMs} className="weather-day">
              <span className="weather-dow">
                {i === 0
                  ? text(context.locale, 'today')
                  : new Date(day.dateMs).toLocaleDateString(context.locale, { weekday: 'short' })}
              </span>
              <WeatherIcon icon={d.icon} size={32} />
              {/* i18next-instrument-ignore */}
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
