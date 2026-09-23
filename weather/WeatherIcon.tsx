import type { IconKey } from './wmo';

interface Props {
  icon: IconKey;
  size?: number;
}

const SUN = '#ffd166';
const CLOUD = '#c7d0da';
const RAIN = '#6ba7e8';
const SNOW = '#e8f0fa';
const BOLT = '#ffd166';

/** Locally-drawn SVG weather glyphs — no external icon CDN. */
export function WeatherIcon({ icon, size = 48 }: Props): React.JSX.Element {
  const common = { width: size, height: size, viewBox: '0 0 64 64' } as const;
  switch (icon) {
    case 'clear':
      return (
        <svg {...common} aria-hidden>
          <circle cx="32" cy="32" r="14" fill={SUN} />
          {Array.from({ length: 8 }, (_, i) => (
            <rect
              key={i}
              x="31"
              y="2"
              width="2"
              height="9"
              rx="1"
              fill={SUN}
              transform={`rotate(${i * 45} 32 32)`}
            />
          ))}
        </svg>
      );
    case 'partly':
      return (
        <svg {...common} aria-hidden>
          <circle cx="24" cy="24" r="11" fill={SUN} />
          <ellipse cx="38" cy="40" rx="18" ry="12" fill={CLOUD} />
        </svg>
      );
    case 'cloudy':
    case 'fog':
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="32" cy="34" rx="20" ry="13" fill={CLOUD} />
          {icon === 'fog' &&
            [46, 52].map((y) => (
              <rect key={y} x="14" y={y} width="36" height="3" rx="1.5" fill={CLOUD} />
            ))}
        </svg>
      );
    case 'drizzle':
    case 'rain':
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="32" cy="28" rx="19" ry="12" fill={CLOUD} />
          {[22, 32, 42].map((x) => (
            <line
              key={x}
              x1={x}
              y1="44"
              x2={x - 4}
              y2={icon === 'rain' ? 56 : 51}
              stroke={RAIN}
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </svg>
      );
    case 'snow':
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="32" cy="28" rx="19" ry="12" fill={CLOUD} />
          {[22, 32, 42].map((x) => (
            <circle key={x} cx={x} cy="50" r="2.5" fill={SNOW} />
          ))}
        </svg>
      );
    case 'thunder':
      return (
        <svg {...common} aria-hidden>
          <ellipse cx="32" cy="26" rx="19" ry="12" fill={CLOUD} />
          <polygon points="30,40 40,40 32,50 38,50 26,62 30,50 24,50" fill={BOLT} />
        </svg>
      );
    default:
      return <svg {...common} aria-hidden />;
  }
}
