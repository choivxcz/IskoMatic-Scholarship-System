import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP} from '../theme';

/**
 * Wraps every beat with the same whip transition: rises in from below out of a blur,
 * leaves upward into a blur. `push` adds a slow camera push-in while the beat holds.
 */
export const Beat: React.FC<{duration: number; push?: boolean; offsetY?: number; children: React.ReactNode}> = ({
  duration,
  push = false,
  offsetY = 0,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}, durationInFrames: 14});
  const exit = interpolate(frame, [duration - 9, duration], [0, 1], {...CLAMP, easing: (t) => t * t});
  const y = offsetY + (1 - enter) * 220 - exit * 260;
  const blur = (1 - enter) * 18 + exit * 22;
  const opacity = Math.min(enter * 1.3, 1 - exit);
  const scale = push ? interpolate(frame, [0, duration], [1, 1.045]) : 1;
  return (
    <AbsoluteFill style={{transform: `translateY(${y}px) scale(${scale})`, filter: `blur(${blur}px)`, opacity}}>
      {children}
    </AbsoluteFill>
  );
};
