import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuestWidgetContext } from '@/sandbox/sdk';

const mocks = vi.hoisted(() => ({ useCastPlayback: vi.fn() }));
vi.mock('./session-store', () => ({ useCastPlayback: mocks.useCastPlayback }));
import { PairingWidget } from './PairingWidget';

const baseState = { status: 'paired', command: null, presentationEpoch: 0, stream: null, peerCount: 1, error: null,
  roomCode: '1234567890', relayUrl: 'https://relay.example', senderUrl: 'https://sender.example', pairingReveal: 0,
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
    expect(setPairingDetails).toHaveBeenLastCalledWith(expect.objectContaining({ code: '1234567890' }));

    state = { ...baseState, sasTrusted: true }; view.rerender(<PairingWidget context={ctx} />);
    await waitFor(() => expect(setPairingDetails).toHaveBeenLastCalledWith(null));

    setPairingDetails.mockClear();
    state = { ...baseState, sasTrusted: true, pairingReveal: 1 }; view.rerender(<PairingWidget context={ctx} />);
    await waitFor(() => expect(setPairingDetails).toHaveBeenCalledTimes(1));
    expect(setPairingDetails).toHaveBeenLastCalledWith(expect.objectContaining({ code: '1234567890' }));
  });

  it('does not reopen a persisted reveal when the widget remounts', async () => {
    mocks.useCastPlayback.mockReturnValue({ ...baseState, sasTrusted: true, pairingReveal: 4 });
    const ctx = context(); const setPairingDetails = vi.fn(() => Promise.resolve());
    ctx.setPairingDetails = setPairingDetails;
    render(<PairingWidget context={ctx} />);
    await Promise.resolve();
    expect(setPairingDetails).not.toHaveBeenCalled();
  });
});
