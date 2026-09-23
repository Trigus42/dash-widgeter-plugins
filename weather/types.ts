export type TemperatureUnit = 'celsius' | 'fahrenheit';

export interface WeatherConfig {
  latitude: number;
  longitude: number;
  locationName: string;
  unit: TemperatureUnit;
  /** How many forecast days the forecast widget renders (1–16). */
  forecastDays: number;
  /** Whether the current widget shows the next upcoming precipitation event. */
  showNextEvent: boolean;
  /** Whether the widget renders its location/title line. */
  showTitle: boolean;
}

export const WEATHER_DEFAULT_CONFIG: WeatherConfig = {
  latitude: 59.91,
  longitude: 10.75,
  locationName: 'Oslo',
  unit: 'celsius',
  forecastDays: 4,
  showNextEvent: true,
  showTitle: true,
};

export interface DailyForecast {
  dateMs: number;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
}

/** A 15-minute nowcast bucket (used to find the next precipitation event). */
export interface MinutelySlot {
  timeMs: number;
  precipitation: number;
  weatherCode: number;
}

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  isDay: boolean;
  unitLabel: string;
  utcOffsetSeconds: number;
  daily: DailyForecast[];
  minutely: MinutelySlot[];
}

function toForecastDays(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof n !== 'number' || Number.isNaN(n)) return WEATHER_DEFAULT_CONFIG.forecastDays;
  return Math.max(1, Math.min(16, Math.round(n)));
}

/** Coerce persisted config (unknown JSON) into a validated WeatherConfig. */
export function readWeatherConfig(raw: Record<string, unknown>): WeatherConfig {
  return {
    latitude: typeof raw.latitude === 'number' ? raw.latitude : WEATHER_DEFAULT_CONFIG.latitude,
    longitude:
      typeof raw.longitude === 'number' ? raw.longitude : WEATHER_DEFAULT_CONFIG.longitude,
    locationName:
      typeof raw.locationName === 'string'
        ? raw.locationName
        : WEATHER_DEFAULT_CONFIG.locationName,
    unit: raw.unit === 'fahrenheit' ? 'fahrenheit' : 'celsius',
    forecastDays: toForecastDays(raw.forecastDays),
    showNextEvent:
      typeof raw.showNextEvent === 'boolean'
        ? raw.showNextEvent
        : WEATHER_DEFAULT_CONFIG.showNextEvent,
    showTitle: typeof raw.showTitle === 'boolean' ? raw.showTitle : WEATHER_DEFAULT_CONFIG.showTitle,
  };
}
