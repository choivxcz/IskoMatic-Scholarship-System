import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beat} from '../components/Beat';
import {Cursor, Move, Pt, Ripple, press} from '../components/Cursor';
import {Check} from '../components/Icons';
import {C, CONTENT_W, FONT, SAFE, card} from '../theme';

// The AI Screening table sorts eligible applicants by chance within one program and year.
// Fictional applicants; the app shows "#rank of cohort · NN% chance".
// Centres this beat's content in the 150–1750 safe band.
const OFFSET_Y = 200;
const PEOPLE = [
  {name: 'Maria Santos', pct: 87, rank: 3, from: 0},
  {name: 'Paolo Reyes', pct: 81, rank: 4, from: 1},
  {name: 'Andrea Villanueva', pct: 95, rank: 1, from: 2},
  {name: 'Joshua Ramos', pct: 93, rank: 2, from: 3},
];
const COHORT = 23;
const TOP = 250;
const ROWS_TOP = TOP + 230;
const ROW_H = 150;
const BTN_TOP = ROWS_TOP + PEOPLE.length * ROW_H + 40;
const CLICK = 66;
const P_BTN: Pt = {x: 560, y: BTN_TOP + 44};
const MOVES: Move[] = [{start: 38, from: {x: 920, y: 1700}, to: P_BTN}];

export const Rank: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sort = spring({frame: frame - 12, fps, config: {damping: 16, stiffness: 90}});
  const endorsed = frame >= CLICK + 4;

  return (
    <Beat duration={duration} push offsetY={OFFSET_Y}>
      <AbsoluteFill style={{fontFamily: FONT, color: C.ink}}>
        <div style={{...card, position: 'absolute', top: TOP, left: SAFE.side, width: CONTENT_W, height: BTN_TOP + 88 + 44 - TOP, padding: '40px 44px'}}>
          <div style={{fontSize: 28, fontWeight: 700, letterSpacing: '0.1em', color: C.blue}}>AI SCREENING</div>
          <div style={{fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6}}>Screening records</div>
          <div style={{fontSize: 30, color: C.muted, marginTop: 6}}>Educational Assistance 2026 · sorted by priority rank</div>
        </div>

        {PEOPLE.map((p) => {
          const slot = interpolate(sort, [0, 1], [p.from, p.rank - 1]);
          const isMaria = p.name === 'Maria Santos';
          const hl = isMaria ? interpolate(frame, [40, 50], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
          return (
            <div
              key={p.name}
              style={{
                position: 'absolute',
                top: ROWS_TOP + slot * ROW_H,
                left: SAFE.side + 24,
                width: CONTENT_W - 48,
                height: ROW_H - 16,
                boxSizing: 'border-box',
                borderRadius: 20,
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                background: hl ? `rgba(17,93,244,${0.08 * hl})` : C.white,
                border: `3px solid ${hl ? `rgba(17,93,244,${hl})` : C.line}`,
              }}
            >
              <div style={{width: 200, flexShrink: 0}}>
                <div style={{fontSize: 38, fontWeight: 800, color: C.blue}}>
                  #{p.rank} of {COHORT}
                </div>
                <div style={{fontSize: 28, color: C.muted, marginTop: 2}}>{p.pct}% chance</div>
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 36, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{p.name}</div>
                <div style={{fontSize: 28, fontWeight: 600, color: isMaria && endorsed ? C.green : C.purple, marginTop: 2}}>
                  {isMaria && endorsed ? 'For interview' : 'Model predicts qualified'}
                </div>
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: 'absolute',
            top: BTN_TOP,
            left: SAFE.side + 44,
            width: CONTENT_W - 88,
            height: 88,
            borderRadius: 18,
            boxSizing: 'border-box',
            border: `3px solid ${endorsed ? C.green : C.blue}`,
            background: endorsed ? C.green : C.white,
            color: endorsed ? 'white' : C.blue,
            fontSize: 38,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            transform: `scale(${press(frame, CLICK)})`,
          }}
        >
          {endorsed && <Check size={40} color="white" />}
          {endorsed ? 'Endorsed for interview' : 'Endorse for interview'}
        </div>

        <Ripple frame={frame} at={CLICK} pos={P_BTN} />
        <Cursor frame={frame} fps={fps} moves={MOVES} opacity={interpolate(frame, [36, 42, CLICK + 14, CLICK + 20], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />
      </AbsoluteFill>
    </Beat>
  );
};
