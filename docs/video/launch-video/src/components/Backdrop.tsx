import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {C} from '../theme';

/** The app's pale canvas with slow-drifting soft light, so flat frames never feel static. */
export const Backdrop: React.FC = () => {
  const f = useCurrentFrame();
  const blob = (x: number, y: number, r: number, color: string) =>
    `radial-gradient(circle ${r}px at ${x}px ${y}px, ${color} 0%, rgba(255,255,255,0) 100%)`;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.canvas,
        backgroundImage: [
          blob(860 + 60 * Math.sin(f / 70), 300 + 40 * Math.cos(f / 55), 620, 'rgba(50,136,255,0.20)'),
          blob(160 + 50 * Math.cos(f / 80), 1500 + 60 * Math.sin(f / 60), 680, 'rgba(17,93,244,0.12)'),
          blob(620 + 40 * Math.sin(f / 50), 1020, 520, 'rgba(231,160,74,0.10)'),
        ].join(','),
      }}
    />
  );
};
