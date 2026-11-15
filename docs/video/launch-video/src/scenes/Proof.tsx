import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {C, CLAMP, FONT} from '../theme';

// Model rf-3.0.0 on its held-out test split (reports/model_evaluation/metrics.json):
// 1,376 records, accuracy 0.8249. Each dot stands for about 4 records.
const COLS = 24;
const ROWS = 14;
const DOTS = COLS * ROWS; // 336
const ACC = 82.5;
const CORRECT = Math.round((DOTS * ACC) / 100); // 277
const PITCH = 36;
const GRID_TOP = 780;
// A shuffled order decides which dots turn green, so the fill looks organic.
const ORDER = Array.from({length: DOTS}, (_, i) => i).sort((a, b) => random(`o${a}`) - random(`o${b}`));
const RANK = new Map(ORDER.map((d, i) => [d, i]));

export const Proof: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  // navy takes over in a circle from the centre, and hands back the same way
  const wipeIn = interpolate(frame, [0, 16], [0, 1], {...CLAMP, easing: Easing.inOut(Easing.cubic)});
  const wipeOut = interpolate(frame, [duration - 14, duration], [0, 1], {...CLAMP, easing: Easing.inOut(Easing.cubic)});
  const radius = 1250 * wipeIn * (1 - wipeOut);
  const lit = interpolate(frame, [44, 84], [0, CORRECT], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const pct = interpolate(frame, [44, 84], [0, ACC], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const textIn = interpolate(frame, [12, 26], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{clipPath: `circle(${radius}px at 540px 960px)`, background: C.navy, fontFamily: FONT, color: 'white'}}>
      <AbsoluteFill style={{backgroundImage: 'radial-gradient(circle 700px at 540px 900px, rgba(50,136,255,0.28), rgba(6,31,78,0) 70%)'}} />
      <div style={{position: 'absolute', top: 260, left: 60, right: 60, textAlign: 'center', opacity: textIn}}>
        <div style={{fontSize: 30, fontWeight: 700, letterSpacing: '0.1em', color: C.azure}}>TESTED ON 1,376 RECORDS IT NEVER SAW</div>
        <div style={{fontSize: 210, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, marginTop: 30, fontVariantNumeric: 'tabular-nums'}}>
          {pct.toFixed(1)}%
        </div>
        <div style={{fontSize: 44, fontWeight: 700, marginTop: 14}}>classified correctly</div>
      </div>

      {Array.from({length: DOTS}, (_, d) => {
        const col = d % COLS;
        const row = Math.floor(d / COLS);
        const appear = interpolate(frame, [14 + (row + col) * 0.8, 24 + (row + col) * 0.8], [0, 1], CLAMP);
        const on = (RANK.get(d) ?? 0) < lit;
        return (
          <div
            key={d}
            style={{
              position: 'absolute',
              left: 540 - (COLS * PITCH) / 2 + col * PITCH + 6,
              top: GRID_TOP + row * PITCH + 6,
              width: PITCH - 12,
              height: PITCH - 12,
              borderRadius: 999,
              background: on ? '#2fd08f' : 'rgba(255,255,255,0.18)',
              transform: `scale(${appear * (on ? 1.08 : 1)})`,
            }}
          />
        );
      })}

      <div style={{position: 'absolute', top: GRID_TOP + ROWS * PITCH + 40, left: 60, right: 60, textAlign: 'center', fontSize: 30, color: '#b9c9ea', opacity: textIn}}>
        Each dot ≈ 4 records · synthetic test data
      </div>
    </AbsoluteFill>
  );
};
