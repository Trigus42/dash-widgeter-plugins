import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuestWidgetContext } from '@/sandbox/sdk';

const mocks = vi.hoisted(() => ({ useCastPlayback: vi.fn() }));
vi.mock('../session/session-store', () => ({ useCastPlayback: mocks.useCastPlayback }));
import { PairingWidget } from './PairingWidget';

const baseState = { status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null,
  roomJoinCode: '123456', authCode: '789012', relayUrl: 'https://relay.example', senderUrl: 'https://sender.example', pairingReveal: 0,
  sas: undefined as string | undefined, sasTrusted: undefined as boolean | undefined };

function context(): GuestWidgetContext {
  return { config: {}, locale: 'en', setPairingDetails: vi.fn(() => Promise.resolve()), castDefaultSenderUrl: vi.fn(() => Promise.resolve('')),
    reportStatus: vi.fn() } as unknown as GuestWidgetContext;
}

describe('PairingWidget', () => {
  it('reopens after host dismissal and across trusted close and reveal', async () => {
    let state: typeof baseState = { ...baseState, sas: '654321', sasTrusted: false };
    mocks.useCastPlayback.mockImplementation(() => state);
    const ctx = context(); const setPairingDetails = vi.fn(() => Promise.resolve()); ctx.setPairingDetails = setPairingDetails;
    const view = render(<PairingWidget context={ctx} />);

    await waitFor(() => expect(setPairingDetails).toHaveBeenLastCalledWith(expect.objectContaining({ sas: '654321' })));
    setPairingDetails.mockClear();
    fireEvent.click(view.getByRole('button'));
    await waitFor(() => expect(setPairingDetails).toHaveBeenLastCalledWith(expect.objectContaining({ sas: '654321' })));

    // The host dismisses its overlay independently (for example via Escape).
    setPairingDetails.mockClear();
    fireEvent.click(view.getByRole('button'));
    await waitFor(() => expect(setPairingDetails).toHaveBeenCalledTimes(1));
    expect(setPairingDetails).toHaveBeenLastCalledWith(expect.objectContaining({ roomJoinCode: '123456', authCode: '789012' }));

    state = { ...baseState, sasTrusted: true }; view.rerender(<PairingWidget context={ctx} />);
    await waitFor(() => expect(setPairingDetails).toHaveBeenLastCalledWith(null));

    setPairingDetails.mockClear();
    state = { ...baseState, sasTrusted: true, pairingReveal: 1 }; view.rerender(<PairingWidget context={ctx} />);
    await waitFor(() => expect(setPairingDetails).toHaveBeenCalledTimes(1));
    expect(setPairingDetails).toHaveBeenLastCalledWith(expect.objectContaining({ roomJoinCode: '123456', authCode: '789012' }));
  });

  it('does not reopen a persisted reveal when the widget remounts', async () => {
    mocks.useCastPlayback.mockReturnValue({ ...baseState, sasTrusted: true, pairingReveal: 4 });
    const ctx = context(); const setPairingDetails = vi.fn(() => Promise.resolve());
    ctx.setPairingDetails = setPairingDetails;
    render(<PairingWidget context={ctx} />);
    await Promise.resolve();
    expect(setPairingDetails).not.toHaveBeenCalled();
  });

  it('renders a localized icon-only control and reflects connection health', () => {
    mocks.useCastPlayback.mockReturnValue({ ...baseState, peerCount: 0 });
    const ctx = context(); ctx.locale = 'de';
    const view = render(<PairingWidget context={ctx} />);
    const button = view.getByRole('button', { name: 'Cast-Kopplung. Verbundene Geräte: 0' });
    expect(button.getAttribute('title')).toBe('Cast-Kopplung. Verbundene Geräte: 0');
    expect(button.textContent).toBe('');
    const dot = button.querySelector('.cast-pairing-status');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    expect(dot?.classList.contains('cast-pairing-status-connected')).toBe(false);

    mocks.useCastPlayback.mockReturnValue({ ...baseState, peerCount: 2 });
    view.rerender(<PairingWidget context={ctx} />);
    expect(view.getByRole('button', { name: 'Cast-Kopplung. Verbundene Geräte: 2' })
      .querySelector('.cast-pairing-status')?.classList.contains('cast-pairing-status-connected')).toBe(true);
  });



  it('keeps the launch click behavior unchanged', () => {
    mocks.useCastPlayback.mockReturnValue(baseState);
    const ctx = context();
    const setPairingDetails = vi.fn<GuestWidgetContext['setPairingDetails']>(() => Promise.resolve());
    ctx.setPairingDetails = setPairingDetails;
    render(<PairingWidget context={ctx} />);
    fireEvent.click(document.querySelector('.cast-pairing-button') as HTMLButtonElement);
    expect(setPairingDetails).toHaveBeenCalledWith(expect.objectContaining({ roomJoinCode: '123456', authCode: '789012' }));
    const details = setPairingDetails.mock.calls[0]?.[0];
    expect(details && 'url' in details ? details.url : '').toMatch(/^https:\/\/sender\.example\/#{1}[A-Za-z0-9_-]+$/);
  });
});
