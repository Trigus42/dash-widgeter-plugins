import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { Video } from '@videojs/react/video';
import { PlaybackPlayer, usePlaybackMedia, usePlaybackPlayer } from '@/media/PlaybackPlayer';
import type { ReactWidgetProps } from '@/sandbox/react';
import { FRAME_PLAYBACK_ACTIVATION_MESSAGE } from '@/sandbox/frame-interaction';

import de from '../locales/de.json';
const EN = { playbackBlocked: 'Playback needs a user gesture.', playbackFailed: 'The shared media could not be played.' };
interface Props {
  context: ReactWidgetProps['context'];
  stream: MediaStream | null;
  relayUrl?: string;
  relayHasAudio?: boolean;
  paused: boolean;
  volume: number;
  muted: boolean;
  audioOnly: boolean;
  visible: boolean;
}

function StreamMedia({ context, stream, relayUrl, relayHasAudio, paused, volume, muted, visible }: Props): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const player = usePlaybackPlayer();
  const media = usePlaybackMedia();
  const [, refreshTracks] = useReducer((version: number) => version + 1, 0);
  const playbackMuted = muted || Boolean(stream && !stream.getAudioTracks().some((track) => track.readyState === 'live')) || relayHasAudio === false;
  const attachedRef = useRef(false);
  const sourceEpochRef = useRef(0);
  const intentRef = useRef<boolean | null>(null);
  const blockedRef = useRef(false);
  const activeRef = useRef(true);
  const latestRef = useRef({ paused, volume, muted: playbackMuted });
  latestRef.current = { paused, volume, muted: playbackMuted };
  const apply = useCallback((): void => {
    if (!attachedRef.current) return;
    // Video.js setVolume also unmutes; applying remote volume must preserve autoplay mute.
    if (videoRef.current && player.volumeAvailability !== 'unsupported') videoRef.current.volume = latestRef.current.volume;
    player.setMuted(latestRef.current.muted);
    if (latestRef.current.paused) {
      if (intentRef.current !== true) player.pause();
      intentRef.current = true;
    } else if (intentRef.current !== false) {
      intentRef.current = false;
      const epoch = sourceEpochRef.current;
      void player.play().then(() => {
        if (activeRef.current && epoch === sourceEpochRef.current) context.reportStatus('ok', '');
      }).catch((cause: unknown) => {
        if (!activeRef.current || epoch !== sourceEpochRef.current) return;
        blockedRef.current = cause instanceof Error && cause.name === 'NotAllowedError';
        context.telemetry.disclose({ operation: 'cast.playback.play', category: blockedRef.current ? 'permission_denied' : 'dependency_response',
          cause, publicMessage: (context.locale.startsWith('de') ? de.runtime : EN)[blockedRef.current ? 'playbackBlocked' : 'playbackFailed'] });
      });
    }
  }, [context, player]);
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    sourceEpochRef.current += 1;
    activeRef.current = true; intentRef.current = null; blockedRef.current = false;
    video.defaultMuted = latestRef.current.muted;
    video.muted = latestRef.current.muted;
    if (stream) video.srcObject = stream;
    else if (relayUrl) video.src = relayUrl;
    return () => {
      activeRef.current = false;
      video.pause(); video.srcObject = null; video.removeAttribute('src'); video.load();
    };
  }, [relayUrl, stream]);
  useEffect(() => {
    if (!stream) return;
    const tracks = new Set<MediaStreamTrack>();
    const observe = (): void => {
      for (const track of stream.getAudioTracks()) {
        if (tracks.has(track)) continue;
        tracks.add(track); track.addEventListener('ended', refreshTracks);
      }
      refreshTracks();
    };
    observe(); stream.addEventListener('addtrack', observe); stream.addEventListener('removetrack', observe);
    return () => {
      stream.removeEventListener('addtrack', observe); stream.removeEventListener('removetrack', observe);
      tracks.forEach((track) => track.removeEventListener('ended', refreshTracks));
    };
  }, [stream]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active && media) { attachedRef.current = true; apply(); } });
    return () => { active = false; attachedRef.current = false; };
  }, [media, paused, volume, playbackMuted, relayUrl, stream, apply]);
  useEffect(() => {
    const activate = (): void => {
      if (blockedRef.current && document.visibilityState !== 'hidden') {
        blockedRef.current = false; intentRef.current = null; apply();
      }
    };
    const activateFromHost = (event: MessageEvent<{ type?: string } | null>): void => {
      if (event.source === window.parent && event.data?.type === FRAME_PLAYBACK_ACTIVATION_MESSAGE) activate();
    };
    window.addEventListener('pointerdown', activate); document.addEventListener('visibilitychange', activate);
    window.addEventListener('message', activateFromHost);
    return () => { window.removeEventListener('pointerdown', activate); document.removeEventListener('visibilitychange', activate); window.removeEventListener('message', activateFromHost); };
  }, [apply]);
  return <Video ref={videoRef} className="cast-media" hidden={!visible} autoPlay={!paused} muted={playbackMuted}
    playsInline controls={false} onLoadedMetadata={apply} />;
}

/** MediaStream stays in its plugin realm; only ordinary cast state crosses RPC. */
export function LivePlayback(props: Props): React.JSX.Element {
  return <div aria-hidden={!props.visible} inert={!props.visible} style={{ width: '100%', height: '100%', ...(!props.visible ? { opacity: 0, pointerEvents: 'none' as const } : {}) }}>
    <PlaybackPlayer live audioOnly={props.audioOnly} locale={props.context.locale} className="cast-live-player">
      <StreamMedia {...props} />
    </PlaybackPlayer>
  </div>;
}
