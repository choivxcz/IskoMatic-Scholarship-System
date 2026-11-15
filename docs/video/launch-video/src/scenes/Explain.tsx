import {AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beat} from '../components/Beat';
import {Arrow} from '../components/Icons';
import {C, CLAMP, CONTENT_W, FONT, SAFE, card} from '../theme';

// Mirrors components/AiExplanation.tsx. Contributions start at the 50.0% baseline and add up
// exactly to the predicted chance, as the app's explainer does: 50 + 37.0 = 87.0.
// Centres this beat's content in the 150–1750 safe band.
const OFFSET_Y = 200;
const BASELINE = 50;
const FACTORS = [
  {label: 'Number of dependents', value: '5', pts: 12.6},
  {label: 'Monthly household income', value: '₱9,500', pts: 11.4},
  {label: 'Household size', value: '6', pts: 8.5},
  {label: 'Seniors in household', value: '2', pts: 6.7},
  {label: 'PWDs in household', value: '0', pts: -2.2},
];
const CHANCE = BASELINE + FACTORS.reduce((s, f) => s + f.pts, 0);
const MAX = 13;
const RING = 236;

export const Explain: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pct = interpolate(frame, [12, 48], [0, CHANCE], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const head = spring({frame: frame - 30, fps, config: {damping: 200}});

  return (
    <Beat duration={duration} push offsetY={OFFSET_Y}>
      <AbsoluteFill style={{fontFamily: FONT, color: C.ink}}>
        <div style={{...card, position: 'absolute', top: 250, left: SAFE.side, width: CONTENT_W, padding: '44px 44px 40px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
            <div
              style={{
                width: RING,
                height: RING,
                borderRadius: 999,
                flexShrink: 0,
                background: `conic-gradient(${C.green} ${pct}%, ${C.line} ${pct}% 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{width: RING - 36, height: RING - 36, borderRadius: 999, background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                <div style={{fontSize: 72, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums'}}>{Math.round(pct)}%</div>
                <div style={{fontSize: 28, color: C.soft, marginTop: -4}}>chance</div>
              </div>
            </div>
            <div style={{opacity: head, transform: `translateX(${(1 - head) * 40}px)`}}>
              <div style={{fontSize: 28, fontWeight: 700, letterSpacing: '0.08em', color: C.purple}}>AI PREDICTION · ADVISORY</div>
              <div style={{fontSize: 56, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6}}>Leans qualified</div>
              <div style={{display: 'inline-block', marginTop: 14, fontSize: 32, fontWeight: 700, color: C.green, background: 'rgba(19,131,95,0.1)', padding: '10px 24px', borderRadius: 999}}>
                Proceed to interview
              </div>
            </div>
          </div>

          <div style={{fontSize: 40, fontWeight: 800, color: C.blue, marginTop: 44}}>How each input moved the chance</div>
          {FACTORS.map((f, i) => {
            const g = spring({frame: frame - 40 - i * 6, fps, config: {damping: 200}});
            const up = f.pts > 0;
            const col = up ? C.green : C.red;
            const half = (CONTENT_W - 88) / 2;
            return (
              <div key={f.label} style={{marginTop: 26, opacity: Math.min(1, g * 2)}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                  <div style={{fontSize: 36, fontWeight: 600}}>
                    {f.label} <span style={{fontSize: 30, color: C.soft, fontWeight: 500}}>{f.value}</span>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 36, fontWeight: 800, color: col, fontVariantNumeric: 'tabular-nums'}}>
                    <Arrow size={24} color={col} down={!up} />
                    {up ? '+' : '−'}
                    {Math.abs(f.pts).toFixed(1)}
                  </div>
                </div>
                {/* diverging track, like the app: green grows right of centre, red grows left */}
                <div style={{position: 'relative', height: 18, borderRadius: 9, background: C.pale, marginTop: 10}}>
                  <div style={{position: 'absolute', left: half - 1, top: -6, width: 3, height: 30, background: C.line}} />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      height: 18,
                      borderRadius: 9,
                      background: col,
                      width: (Math.abs(f.pts) / MAX) * half * g,
                      ...(up ? {left: half} : {right: half}),
                    }}
                  />
                </div>
              </div>
            );
          })}
          <div style={{fontSize: 30, color: C.muted, marginTop: 30, lineHeight: 1.35}}>
            Starts at {BASELINE.toFixed(1)}%. Every input’s push adds up to the {CHANCE.toFixed(1)}%.
          </div>
        </div>
      </AbsoluteFill>
    </Beat>
  );
};
