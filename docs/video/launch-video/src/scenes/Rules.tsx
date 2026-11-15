import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beat} from '../components/Beat';
import {Check} from '../components/Icons';
import {C, CONTENT_W, FONT, SAFE, card} from '../theme';

// The five eligibility rules from the README; checked before the model ever scores anyone.
// Centres this beat's content in the 150–1750 safe band.
const OFFSET_Y = 70;
const RULES = [
  {rule: 'Entrance exam 80% or higher', value: '34 of 40 items · 85.0%'},
  {rule: 'Academic average above 75', value: '91.40'},
  {rule: 'Not a 4Ps beneficiary', value: 'No'},
  {rule: 'Not an SPES beneficiary', value: 'No'},
  {rule: 'No other scholar in the family', value: '0 scholars'},
];
const ROW_H = 150;
const TOP = 300;

export const Rules: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const result = spring({frame: frame - 62, fps, config: {damping: 14}});

  return (
    <Beat duration={duration} push offsetY={OFFSET_Y}>
      <AbsoluteFill style={{fontFamily: FONT, color: C.ink}}>
        <div style={{...card, position: 'absolute', top: TOP, left: SAFE.side, width: CONTENT_W, padding: '40px 44px 30px'}}>
          <div style={{fontSize: 28, fontWeight: 700, letterSpacing: '0.1em', color: C.purple}}>ELIGIBILITY CHECK · ADVISORY</div>
          <div style={{fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6}}>Maria Santos</div>
          <div style={{fontSize: 30, color: C.muted, marginTop: 4}}>APP-41 · Iskolar ng Bayan Educational Assistance</div>
          <div style={{marginTop: 22}}>
            {RULES.map((r, i) => {
              const tick = spring({frame: frame - 14 - i * 9, fps, config: {damping: 11, stiffness: 170}});
              return (
                <div key={r.rule} style={{height: ROW_H, display: 'flex', alignItems: 'center', gap: 28, borderTop: `2px solid ${C.line}`}}>
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 999,
                      flexShrink: 0,
                      background: tick > 0.05 ? C.green : C.line,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: `scale(${0.6 + 0.4 * tick})`,
                    }}
                  >
                    <div style={{opacity: tick, transform: `scale(${tick})`}}>
                      <Check size={46} color="white" />
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize: 38, fontWeight: 700}}>{r.rule}</div>
                    <div style={{fontSize: 30, color: C.muted, marginTop: 4}}>{r.value}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            top: TOP + 40 + 146 + 22 + RULES.length * ROW_H + 30 + 50,
            left: SAFE.side,
            width: CONTENT_W,
            boxSizing: 'border-box',
            padding: '26px 32px',
            borderRadius: 24,
            background: 'rgba(19,131,95,0.1)',
            border: `3px solid ${C.green}`,
            color: C.green,
            textAlign: 'center',
            opacity: Math.min(1, result * 1.4),
            transform: `scale(${0.85 + 0.15 * result})`,
          }}
        >
          <div style={{fontSize: 42, fontWeight: 800}}>Passes every rule</div>
          <div style={{fontSize: 30, fontWeight: 600, marginTop: 6, color: C.ink}}>Fail one, and the AI never scores it. Staff confirm.</div>
        </div>
      </AbsoluteFill>
    </Beat>
  );
};
