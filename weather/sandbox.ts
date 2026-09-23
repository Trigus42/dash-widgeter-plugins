import { definePlugin, injectStyle } from '@/sandbox/sdk';
import { defineReactWidget } from '@/sandbox/react';
import { WeatherWidget } from './WeatherWidget';
import { ForecastWidget } from './ForecastWidget';
import { WEATHER_SANDBOX_CSS } from './weather-styles';

/**
 * Weather plugin sandbox entry. Registers two React widgets (current + forecast)
 * that run in the plugin's null-origin iframe with React bundled in. Styles are
 * injected once (isolated realm has no host CSS); data comes through the shared
 * host layer via useWidgetData, allowlisted to Open-Meteo by the manifest.
 */
injectStyle('weather-style', WEATHER_SANDBOX_CSS);

export default definePlugin({
  widgets: {
    'weather.current': defineReactWidget(WeatherWidget),
    'weather.forecast': defineReactWidget(ForecastWidget),
  },
});
