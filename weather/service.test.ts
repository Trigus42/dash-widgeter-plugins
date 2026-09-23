import { describe, expect, it } from 'vitest';
import { describeWeather } from './wmo';
import { buildWeatherUrl, mapOpenMeteo, nextPrecipEvent, weatherCacheKey } from './service';
import { WEATHER_DEFAULT_CONFIG, type WeatherData } from './types';

const DAY1 = Math.floor(Date.UTC(2026, 0, 1) / 1000);
const DAY2 = Math.floor(Date.UTC(2026, 0, 2) / 1000);

const okResponse = {
  utc_offset_seconds: 3600,
  current: { temperature_2m: 18, weather_code: 2, wind_speed_10m: 5, is_day: 1 },
  current_units: { temperature_2m: '°C' },
  daily: {
    time: [DAY1, DAY2],
    weather_code: [0, 61],
    temperature_2m_max: [20, 15],
    temperature_2m_min: [10, 8],
  },
  minutely_15: { time: [], precipitation: [], weather_code: [] },
};

describe('weather WMO mapping', () => {
  it('maps known codes and falls back for unknown', () => {
    expect(describeWeather(0).icon).toBe('clear');
    expect(describeWeather(95).icon).toBe('thunder');
    expect(describeWeather(1234).label).toBe('Unknown');
  });
});

// Caching / staleness / fetching now live in the shared data layer + sandbox;
// the service module is pure URL-building + response-mapping.
describe('weather service (pure)', () => {
  it('builds an Open-Meteo URL with the location + unit', () => {
    const url = buildWeatherUrl(WEATHER_DEFAULT_CONFIG);
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(url).toContain('temperature_unit=celsius');
    expect(url).toContain(`latitude=${WEATHER_DEFAULT_CONFIG.latitude}`);
  });

  it('maps the (unknown) response into WeatherData', () => {
    const data = mapOpenMeteo(okResponse);
    expect(data.temperature).toBe(18);
    expect(data.daily).toHaveLength(2);
    expect(data.unitLabel).toBe('°C');
  });

  it('derives a stable, location+unit-scoped cache key', () => {
    const key = weatherCacheKey(WEATHER_DEFAULT_CONFIG);
    expect(key).toContain('weather:');
    expect(weatherCacheKey({ ...WEATHER_DEFAULT_CONFIG, unit: 'fahrenheit' })).not.toBe(key);
  });

  it('requests the shared max horizon so both widgets reuse one cache entry', () => {
    expect(buildWeatherUrl(WEATHER_DEFAULT_CONFIG)).toContain('forecast_days=16');
  });
});

describe('nextPrecipEvent', () => {
  const base: WeatherData = {
    temperature: 18,
    weatherCode: 2,
    windSpeed: 5,
    isDay: true,
    unitLabel: '°C',
    utcOffsetSeconds: 0,
    daily: [],
    minutely: [],
  };
  const now = Date.UTC(2026, 0, 1, 12, 0, 0);
  const slot = (min: number, precip: number, code = 61) => ({
    timeMs: now + min * 60000,
    precipitation: precip,
    weatherCode: code,
  });

  it('returns the first upcoming precipitating slot', () => {
    const data = { ...base, minutely: [slot(0, 0), slot(15, 0), slot(30, 0.5, 63)] };
    const event = nextPrecipEvent(data, now);
    expect(event?.minutesUntil).toBe(30);
    expect(event?.weatherCode).toBe(63);
  });

  it('returns null when it is already precipitating now', () => {
    const data = { ...base, minutely: [slot(0, 0.8), slot(15, 0.8)] };
    expect(nextPrecipEvent(data, now)).toBeNull();
  });

  it('returns null when the nowcast window is dry', () => {
    const data = { ...base, minutely: [slot(0, 0), slot(15, 0), slot(30, 0)] };
    expect(nextPrecipEvent(data, now)).toBeNull();
  });
});
