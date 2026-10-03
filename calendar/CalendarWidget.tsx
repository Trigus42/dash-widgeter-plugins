import { useMemo } from 'react';
import { usePullToRefresh, useWidgetData, type ReactWidgetProps } from '@/sandbox/react';
import { mergeEvents, normalizeIcalUrl, parseCalendar } from './service';
import { readCalendarConfig, type CalendarEvent } from './types';
import { text } from './translate';

function formatWhen(locale: string, event: CalendarEvent): string {
  const start = new Date(event.start);
  const day = start.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  if (event.allDay) return `${day} · ${text(locale, 'allDay')}`;
  const time = start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

/**
 * Agenda widget, running in the plugin sandbox. Fetches every configured iCal
 * feed through the host (proxy: 'always' — most feeds send no CORS headers),
 * parses each with the pure ical.js step, tags events with their feed color,
 * and merges them into one chronological view. Data resilience comes from the
 * shared host layer.
 */
export function CalendarWidget({ context }: ReactWidgetProps): React.JSX.Element {
  const config = useMemo(() => readCalendarConfig(context.config), [context.config]);
  const configured = config.sources.length > 0;

  // Key on every source URL + color so re-configuring a feed re-fetches/re-tags.
  const sourceKey = config.sources.map((s) => `${s.icalUrl}|${s.color}`).join(',');

  const { data: events, error, refetch } = useWidgetData<CalendarEvent[]>(context, {
    key: ['calendar', sourceKey, config.daysAhead],
    enabled: configured,
    fetcher: async () => {
      const perFeed = await Promise.all(
        config.sources.map(async (source) => {
          const { url, headers } = normalizeIcalUrl(source.icalUrl);
          const res = await context.http({ url, headers, responseType: 'text', proxy: 'always' });
          if (!res.ok) throw new Error(`Calendar fetch failed (${res.status})`);
          return parseCalendar(String(res.data), config.daysAhead, source.color);
        }),
      );
      return mergeEvents(perFeed);
    },
    refetchIntervalMs: config.refreshIntervalMinutes * 60 * 1000,
    staleMessage: 'Offline — showing cached schedule',
    errorMessage: 'Calendar unavailable',
  });

  const containerRef = usePullToRefresh<HTMLUListElement>(refetch);

  if (!configured) {
    return (
      <div className="calendar-widget calendar-empty">
        <div>
          <strong>{text(context.locale, 'title')}</strong>
          <p>{text(context.locale, 'configure')}</p>
        </div>
      </div>
    );
  }

  const showTitle = config.showTitle && config.title !== '';

  return (
    <div className="calendar-widget">
      {showTitle && <div className="calendar-header">{config.title}</div>}
      {error && !events && (
        <div className="calendar-error" role="alert">
          {error}
        </div>
      )}
      {events && events.length === 0 && <div className="calendar-none">{text(context.locale, 'none')}</div>}
      <ul ref={containerRef} className="calendar-list">
        {events?.map((event) => (
          <li
            key={`${event.uid}-${event.start}`}
            className="calendar-event"
            style={{ borderLeftColor: event.color }}
          >
            <span className="calendar-when">{formatWhen(context.locale, event)}</span>
            <span className="calendar-summary">{event.summary}</span>
            {event.location && <span className="calendar-loc">{event.location}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
