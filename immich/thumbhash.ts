import { thumbHashToDataURL } from 'thumbhash';

/**
 * Immich returns `thumbhash` as a base64 string. Decode it to a tiny blurred
 * data URL for an instant placeholder while the full preview loads — no extra
 * network request (AGENTS.md network resilience / perceived performance).
 */
export function thumbhashToDataUrl(base64: string): string | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return thumbHashToDataURL(bytes);
  } catch {
    return null;
  }
}
