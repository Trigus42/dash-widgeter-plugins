import { WIDGET_Z, type PluginManifest, type WidgetSettingField } from '@/types';
import { WEATHER_DEFAULT_CONFIG } from './types';
import de from './locales/de.json';

/**
 * Host-side manifest for the weather plugin. No code runs in the host — the
 * widgets render in the null-origin sandbox (see ./sandbox.ts). The plugin's
 * entire network reach is declared here: only Open-Meteo, enforced by the host
 * (web adapter + Rust command) so a compromised bundle cannot exfiltrate.
 */

// Both widgets share the same location/unit settings.
const sharedSettings: WidgetSettingField[] = [
  { key: 'locationName', label: 'Location name', type: 'text', placeholder: 'Oslo', section: 'Location' },
  { key: 'location', label: 'Coordinates', type: 'location', section: 'Location' },
  {
    key: 'unit',
    label: 'Temperature unit',
    type: 'select',
    section: 'Location',
    options: [
      { label: 'Celsius', value: 'celsius' },
      { label: 'Fahrenheit', value: 'fahrenheit' },
    ],
  },
  {
    key: 'refreshIntervalMinutes',
    label: 'Refresh interval',
    type: 'select',
    section: 'Location',
    options: [
      { label: '5 minutes', value: '5' },
      { label: '15 minutes', value: '15' },
      { label: '30 minutes', value: '30' },
      { label: '60 minutes', value: '60' },
    ],
  },
];

const showTitleField: WidgetSettingField = {
  key: 'showTitle',
  label: 'Show location name',
  type: 'boolean',
  section: 'Appearance',
  help: 'Turn off to save space — the widget content already makes it obvious.',
};

const currentSettings: WidgetSettingField[] = [
  ...sharedSettings,
  {
    key: 'showNextEvent',
    label: 'Show next precipitation',
    type: 'boolean',
    section: 'Display',
    help: 'A small note like "Rain in 25 min" from the 15-minute nowcast.',
  },
  showTitleField,
];

const forecastSettings: WidgetSettingField[] = [
  ...sharedSettings,
  {
    key: 'forecastDays',
    label: 'Forecast days',
    type: 'number',
    section: 'Display',
    help: 'Number of days to show (1–16).',
  },
  showTitleField,
];

export const weatherManifest: PluginManifest = {
  id: 'weather',
  name: 'Weather',
  version: '1.8.0',
  description: 'Current conditions and forecast via Open-Meteo',
  translations: { de: de.manifest },
  executionType: 'sandboxed',
  capabilities: ['device.location.read'],
  permissions: [
    {
      name: 'Weather Service',
      domains: ['api.open-meteo.com'],
      publicIps: ['0.0.0.0/0', '::/0'],
      properties: { defaultOn: true },
    },
  ],
  widgets: [
    {
      id: 'weather.current',
      name: 'Weather Now',
      description: 'Current conditions badge',
      minW: 3,
      minH: 3,
      defaultW: 13,
      defaultH: 8,
      defaultZIndex: WIDGET_Z,
      defaultConfig: { ...WEATHER_DEFAULT_CONFIG },
      settings: currentSettings,
    },
    {
      id: 'weather.forecast',
      name: 'Weather Forecast',
      description: 'Multi-day forecast card',
      minW: 4,
      minH: 3,
      defaultW: 20,
      defaultH: 10,
      defaultZIndex: WIDGET_Z,
      defaultConfig: { ...WEATHER_DEFAULT_CONFIG },
      settings: forecastSettings,
    },
  ],
};
