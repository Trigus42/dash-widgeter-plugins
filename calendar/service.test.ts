import { describe, expect, it } from 'vitest';
import { mergeEvents, normalizeIcalUrl, parseCalendar } from './service';
import { readCalendarConfig } from './types';

function ics(startIso: string): string {
  const dt = startIso.replace(/[-:]/g, '').replace('.000', '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dash-widgeter//test//EN',
    'BEGIN:VEVENT',
    'UID:evt-1',
    `DTSTART:${dt}`,
    `DTEND:${dt}`,
    'SUMMARY:Standup',
    'LOCATION:Room 1',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

describe('normalizeIcalUrl', () => {
  it('rewrites webcal:// to https://', () => {
    expect(normalizeIcalUrl('webcal://host/c.ics').url).toBe('https://host/c.ics');
  });

  it('extracts embedded userinfo into a Basic auth header', () => {
    const { url, headers } = normalizeIcalUrl('https://user:pass@host/c.ics');
    expect(url).not.toContain('user:pass');
    expect(headers.authorization).toBe(`Basic ${btoa('user:pass')}`);
  });
});

describe('parseCalendar', () => {
  it('returns events within the window', () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const events = parseCalendar(ics(soon), 7);
    expect(events).toHaveLength(1);
    expect(events[0]?.summary).toBe('Standup');
    expect(events[0]?.location).toBe('Room 1');
  });

  it('excludes events outside the window', () => {
    const past = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(parseCalendar(ics(past), 7)).toHaveLength(0);
  });

  it('tags each event with its feed color', () => {
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    expect(parseCalendar(ics(soon), 7, '#ff0000')[0]?.color).toBe('#ff0000');
  });
});

describe('mergeEvents', () => {
  it('interleaves multiple feeds in chronological order', () => {
    const now = Date.now();
    const a = new Date(now + 60 * 60 * 1000).toISOString();
    const b = new Date(now + 30 * 60 * 1000).toISOString();
    const merged = mergeEvents([
      parseCalendar(ics(a), 7, '#a'),
      parseCalendar(ics(b), 7, '#b'),
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.color).toBe('#b'); // earlier event first
    expect(merged[1]?.color).toBe('#a');
  });
});

describe('readCalendarConfig', () => {
  it('migrates a legacy single icalUrl into one colored source', () => {
    const cfg = readCalendarConfig({ icalUrl: 'https://h/c.ics', title: 'Old' });
    expect(cfg.sources).toHaveLength(1);
    expect(cfg.sources[0]?.icalUrl).toBe('https://h/c.ics');
    expect(cfg.sources[0]?.color).toMatch(/^#/);
  });

  it('reads a multi-source list and drops empty URLs', () => {
    const cfg = readCalendarConfig({
      sources: [
        { icalUrl: 'https://a/c.ics', color: '#123456' },
        { icalUrl: '', color: '#000000' },
      ],
    });
    expect(cfg.sources).toHaveLength(1);
    expect(cfg.sources[0]?.color).toBe('#123456');
  });
});
