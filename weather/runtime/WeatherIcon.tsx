import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react';
import type { IconKey } from '../data/wmo';

interface Props {
  icon: IconKey;
  size?: number;
}

const WEATHER_ICONS = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
} as const;

export function WeatherIcon({ icon, size = 48 }: Props): React.JSX.Element {
  const Icon = WEATHER_ICONS[icon];
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
