import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, CLAMP, FONT} from '../theme';

// The two official seals pop in, a ring of short strokes flares, then the app's wordmark.
const SEAL = 170;
const SEALS_CY = 700;

export const EndCard: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 10, stiffness: 160}});
  const flare = interpolate(frame, [4, 22], [0, 1], CLAMP);
  const word = spring({frame: frame - 14, fps, config: {damping: 200}});
  const sub = spring({frame: frame - 22, fps, config: {damping: 200}});
  const fade = interpolate(frame, [duration - 10, duration], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{fontFamily: FONT, color: C.navy}}>
      {Array.from({length: 14}, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const r = 210 + 80 * flare;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 540 + Math.cos(a) * r,
              top: SEALS_CY + Math.sin(a) * r * 0.8,
              width: 34,
              height: 6,
              borderRadius: 3,
              background: i % 2 ? C.amber : C.blue,
              opacity: flare > 0 && flare < 1 ? 1 - flare : 0,
              transform: `translate(-50%, -50%) rotate(${a}rad)`,
            }}
          />
        );
      })}
      <div style={{position: 'absolute', top: SEALS_CY - SEAL / 2, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 36, transform: `scale(${pop})`}}>
        <Img src={staticFile('stc.png')} style={{height: SEAL, width: 'auto'}} />
        <Img src={staticFile('lydo.png')} style={{height: SEAL, width: SEAL}} />
      </div>
      <div style={{position: 'absolute', top: SEALS_CY + 150, left: 60, right: 60, textAlign: 'center', opacity: word, transform: `translateY(${(1 - word) * 40}px)`}}>
        <div style={{fontSize: 168, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1}}>
          Isko<span style={{color: C.blue}}>Matic</span>
        </div>
      </div>
      <div style={{position: 'absolute', top: SEALS_CY + 350, left: 60, right: 60, textAlign: 'center', opacity: sub, transform: `translateY(${(1 - sub) * 30}px)`}}>
        <div style={{fontSize: 32, fontWeight: 700, letterSpacing: '0.14em', color: C.muted}}>SCHOLARSHIP MANAGEMENT</div>
        <div style={{fontSize: 40, fontWeight: 600, marginTop: 56, color: C.ink}}>Local Youth Development Office</div>
        <div style={{fontSize: 36, marginTop: 8, color: C.muted}}>Santa Cruz, Laguna</div>
      </div>
      <AbsoluteFill style={{background: C.navy, opacity: fade}} />
    </AbsoluteFill>
  );
};
