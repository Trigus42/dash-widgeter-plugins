/**
 * Fit-to-box text sizing for the clock. CSS container units size to the
 * container, not the text, so a wider string (HH:MM:SS) at a fixed cqw
 * overflows. These helpers measure the rendered text and scale each line to fit
 * both a height budget and the available width. Kept pure + separate so the
 * sizing logic is unit-testable and reused by the React widget.
 */

/** Absolute floor so the clock stays legible in the smallest cell (min 3x2). */
export const MIN_FONT_PX = 12;
/** When the date shows, the time takes this share of height and the date the rest. */
export const TIME_HEIGHT_SHARE = 0.7;
export const DATE_HEIGHT_SHARE = 0.22;

/**
 * The font size (px) that fits `text` of the given font weight within both a
 * height budget and a width, measured with the element's own metrics. Pure math
 * given a measured width at the height-budget size.
 */
export function fittedFontSize(heightBudgetPx: number, measuredWidthPx: number, availWidthPx: number): number {
  const scaled =
    measuredWidthPx > availWidthPx
      ? heightBudgetPx * (availWidthPx / measuredWidthPx)
      : heightBudgetPx;
  return Math.max(MIN_FONT_PX, Math.floor(scaled));
}

/** Size one line element to fit height budget + width (one measured reflow). */
export function fitLine(el: HTMLElement, heightBudgetPx: number, availWidthPx: number): void {
  el.style.fontSize = `${heightBudgetPx}px`;
  el.style.fontSize = `${fittedFontSize(heightBudgetPx, el.scrollWidth, availWidthPx)}px`;
}

/**
 * Fit time (and date, when shown) within `widget`. Time and date are each sized
 * off the box height — the date is NOT a fraction of a width-squeezed time, so a
 * long HH:MM:SS shrinks only the time, leaving the date legible.
 */
export function fitClock(
  widget: HTMLElement,
  timeEl: HTMLElement,
  dateEl: HTMLElement | null,
): void {
  const style = getComputedStyle(widget);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const availW = widget.clientWidth - padX;
  const availH = widget.clientHeight - padY;
  if (availW <= 0 || availH <= 0) return;

  const hasDate = Boolean(dateEl);
  fitLine(timeEl, availH * (hasDate ? TIME_HEIGHT_SHARE : 0.92), availW);
  if (dateEl) fitLine(dateEl, availH * DATE_HEIGHT_SHARE, availW);
}
