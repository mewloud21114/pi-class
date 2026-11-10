import { useEffect, useRef } from 'react';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

const REPORT_EVERY_MS = 10_000;

/**
 * 16:9 player with native controls; starts playing as soon as it mounts.
 * onProgress(positionSeconds, durationSeconds) is called every 10 s while the furthest
 * position moves forward, when the video ends, and when the player is closed.
 */
export default function Player({ url, onProgress }) {
  const player = useVideoPlayer(url, (p) => {
    p.timeUpdateEventInterval = 1;
    p.play();
  });
  const furthest = useRef(0);
  const reported = useRef(0);
  const callback = useRef(onProgress);
  callback.current = onProgress;

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (currentTime > furthest.current) furthest.current = currentTime;
  });

  const report = () => {
    if (!callback.current || furthest.current <= reported.current) return;
    reported.current = furthest.current;
    callback.current(furthest.current, player.duration || undefined);
  };

  useEventListener(player, 'playToEnd', () => {
    furthest.current = player.duration || furthest.current;
    report();
  });

  useEffect(() => {
    const timer = setInterval(report, REPORT_EVERY_MS);
    return () => {
      clearInterval(timer);
      report();   // final position when the screen is left
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return (
    <VideoView
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true }}
      style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}
    />
  );
}
