import ICAL from 'ical.js';
import type { CalendarEvent } from './types';

/** Normalize webcal:// and strip embedded userinfo into a Basic auth header. */
export function normalizeIcalUrl(raw: string): {
  url: string;
  headers: Record<string, string>;
} {
  let url = raw.trim().replace(/^webcal:\/\//i, 'https://');
  const headers: Record<string, string> = {};
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      const token = btoa(`${parsed.username}:${parsed.password}`);
      headers.authorization = `Basic ${token}`;
      parsed.username = '';
      parsed.password = '';
      url = parsed.toString();
    }
  } catch {
    // Leave as-is; the fetch will surface an invalid-URL error.
  }
  return { url, headers };
}

import { DEFAULT_EVENT_COLOR } from './types';

function toEvent(event: ICAL.Event, startMs: number, endMs: number, color: string): CalendarEvent {
  return {
    uid: event.uid || `${event.summary}-${startMs}`,
    summary: event.summary || '(no title)',
    location: event.location || '',
    start: startMs,
    end: endMs,
    allDay: Boolean(event.startDate.isDate),
    color,
  };
}

/** Expand a VEVENT (including recurrences) into occurrences within [from,to]. */
function expandEvent(
  vevent: ICAL.Component,
  fromMs: number,
  toMs: number,
  color: string,
): CalendarEvent[] {
  const event = new ICAL.Event(vevent);
  const durationMs = event.duration.toSeconds() * 1000;

  if (!event.isRecurring()) {
    const startMs = event.startDate.toJSDate().getTime();
    if (startMs >= fromMs && startMs <= toMs) {
      return [toEvent(event, startMs, startMs + durationMs, color)];
    }
    return [];
  }

  const results: CalendarEvent[] = [];
  const iterator = event.iterator();
  let next = iterator.next();
  // Bound the walk so a daily-forever rule can't spin unbounded.
  let guard = 0;
  while (next && guard < 1000) {
    guard += 1;
    const startMs = next.toJSDate().getTime();
    if (startMs > toMs) break;
    if (startMs >= fromMs) results.push(toEvent(event, startMs, startMs + durationMs, color));
    next = iterator.next();
  }
  return results;
}

/** Pure parse step (separated for testing without network). */
export function parseCalendar(
  icsText: string,
  daysAhead: number,
  color: string = DEFAULT_EVENT_COLOR,
): CalendarEvent[] {
  const now = Date.now();
  const to = now + daysAhead * 24 * 60 * 60 * 1000;

  const jcal = ICAL.parse(icsText) as unknown;
  const comp = new ICAL.Component(jcal as ConstructorParameters<typeof ICAL.Component>[0]);
  const vevents = comp.getAllSubcomponents('vevent');

  const events = vevents.flatMap((v) => expandEvent(v, now, to, color));
  return events.sort((a, b) => a.start - b.start);
}

/** Merge already-parsed per-feed event lists into one sorted agenda. */
export function mergeEvents(lists: ReadonlyArray<CalendarEvent[]>): CalendarEvent[] {
  return lists.flat().sort((a, b) => a.start - b.start);
}
