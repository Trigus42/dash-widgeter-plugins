import type { WeatherConfig, WeatherData } from './types';

/** Upper bound requested from the API; widgets slice to the user's day count. */
export const MAX_FORECAST_DAYS = 16;

interface OpenMeteoResponse {
  utc_offset_seconds: number;
  current: {
    temperature_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  current_units: { temperature_2m: string };
  daily: {
    time: number[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
  minutely_15?: {
    time: number[];
    precipitation: number[];
    weather_code: number[];
  };
}

/**
 * Build the Open-Meteo request URL for a location + unit. The forecast horizon
 * is fixed at the API maximum (widgets slice client-side) so the current and
 * forecast widgets share ONE cache entry regardless of each one's day count.
 * `timeformat=unixtime` yields absolute timestamps, so now-relative nowcast math
 * needs no timezone string parsing (`utc_offset_seconds` gives location-local).
 */
export function buildWeatherUrl(config: WeatherConfig): string {
  const params = new URLSearchParams({
    latitude: String(config.latitude),
    longitude: String(config.longitude),
    current: 'temperature_2m,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    minutely_15: 'precipitation,weather_code',
    forecast_minutely_15: '48',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: String(MAX_FORECAST_DAYS),
    temperature_unit: config.unit,
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Map the (unknown, RPC-crossed) Open-Meteo response into WeatherData. */
export function mapOpenMeteo(raw: unknown): WeatherData {
  const res = raw as OpenMeteoResponse;
  return mapResponse(res);
}

function mapResponse(res: OpenMeteoResponse): WeatherData {
  const daily = res.daily.time.map((sec, i) => ({
    dateMs: sec * 1000,
    weatherCode: res.daily.weather_code[i] ?? 0,
    tempMax: res.daily.temperature_2m_max[i] ?? 0,
    tempMin: res.daily.temperature_2m_min[i] ?? 0,
  }));
  const m = res.minutely_15;
  const minutely = m
    ? m.time.map((sec, i) => ({
        timeMs: sec * 1000,
        precipitation: m.precipitation[i] ?? 0,
        weatherCode: m.weather_code[i] ?? 0,
      }))
    : [];
  return {
    temperature: res.current.temperature_2m,
    weatherCode: res.current.weather_code,
    windSpeed: res.current.wind_speed_10m,
    isDay: res.current.is_day === 1,
    unitLabel: res.current_units.temperature_2m,
    utcOffsetSeconds: res.utc_offset_seconds ?? 0,
    daily,
    minutely,
  };
}

/** Stable cache key for a location+unit; used as the shared query key. */
export function weatherCacheKey(config: WeatherConfig): string {
  return `weather:${config.latitude},${config.longitude},${config.unit}`;
}

export interface NextPrecipEvent {
  /** Whole minutes from `nowMs` until the event begins. */
  minutesUntil: number;
  /** WMO code of the first precipitating slot (rain/snow/…); for the icon+label. */
  weatherCode: number;
}

/**
 * Find the next precipitation event from the 15-minute nowcast: the first slot
 * (at or after now) whose precipitation exceeds a small threshold, when no
 * precipitation is currently falling. Returns null when it's already
 * precipitating or nothing is forecast in the nowcast window. Pure — unit
 * tested — so the widget just renders the result.
 */
export function nextPrecipEvent(data: WeatherData, nowMs: number): NextPrecipEvent | null {
  const THRESHOLD_MM = 0.1;
  const upcoming = data.minutely.filter((s) => s.timeMs + 15 * 60 * 1000 > nowMs);
  if (upcoming.length === 0) return null;

  // Already precipitating in the current slot → not an "upcoming" event.
  const current = upcoming[0];
  if (current && current.timeMs <= nowMs && current.precipitation >= THRESHOLD_MM) return null;

  const event = upcoming.find((s) => s.timeMs > nowMs && s.precipitation >= THRESHOLD_MM);
  if (!event) return null;

  return {
    minutesUntil: Math.max(0, Math.round((event.timeMs - nowMs) / 60000)),
    weatherCode: event.weatherCode,
  };
}
