/** One iCal feed merged into the agenda, with its own display color. */
export interface CalendarSource {
  /** iCal (ICS) feed URL. webcal:// is normalized to https://. */
  icalUrl: string;
  /** Hex color for this feed's events (event accent bar). */
  color: string;
  /** Optional human label (unused in the merged view today, kept for future). */
  name?: string;
}

export interface CalendarConfig {
  /** Feeds merged into one chronological agenda. */
  sources: CalendarSource[];
  /** Optional heading; empty string hides it. */
  title: string;
  /** Whether to render the title heading at all. */
  showTitle: boolean;
  daysAhead: number;
}

export const DEFAULT_EVENT_COLOR = '#6ba7e8';

export const CALENDAR_DEFAULT_CONFIG: CalendarConfig = {
  sources: [],
  title: '',
  showTitle: false,
  daysAhead: 7,
};

export interface CalendarEvent {
  uid: string;
  summary: string;
  location: string;
  start: number; // epoch ms
  end: number; // epoch ms
  allDay: boolean;
  /** Color inherited from the source feed this event came from. */
  color: string;
}

/**
 * Coerce persisted config (unknown JSON) into a validated CalendarConfig,
 * migrating the legacy single-URL shape ({ icalUrl }) into a one-entry
 * `sources` array so existing layouts keep working.
 */
export function readCalendarConfig(raw: Record<string, unknown>): CalendarConfig {
  const sources = readSources(raw);
  return {
    sources,
    title: typeof raw.title === 'string' ? raw.title : CALENDAR_DEFAULT_CONFIG.title,
    showTitle:
      typeof raw.showTitle === 'boolean' ? raw.showTitle : CALENDAR_DEFAULT_CONFIG.showTitle,
    daysAhead:
      typeof raw.daysAhead === 'number' ? raw.daysAhead : CALENDAR_DEFAULT_CONFIG.daysAhead,
  };
}

function readSources(raw: Record<string, unknown>): CalendarSource[] {
  if (Array.isArray(raw.sources)) {
    return raw.sources
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        icalUrl: typeof s.icalUrl === 'string' ? s.icalUrl : '',
        color: typeof s.color === 'string' && s.color ? s.color : DEFAULT_EVENT_COLOR,
        ...(typeof s.name === 'string' ? { name: s.name } : {}),
      }))
      .filter((s) => s.icalUrl !== '');
  }
  // Legacy migration: a single icalUrl string becomes one colored source.
  if (typeof raw.icalUrl === 'string' && raw.icalUrl !== '') {
    return [{ icalUrl: raw.icalUrl, color: DEFAULT_EVENT_COLOR }];
  }
  return [];
}
