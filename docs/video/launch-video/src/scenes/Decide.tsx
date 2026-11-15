import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beat} from '../components/Beat';
import {Cursor, Move, Pt, Ripple, press} from '../components/Cursor';
import {Check} from '../components/Icons';
import {C, CONTENT_W, FONT, SAFE, card} from '../theme';

// "Record decision" is Administrator-only; every change lands in the Activity Log
// under the signed-in staff member before it runs (app/ui/desktop/README.md).
// Centres this beat's content in the 150–1750 safe band.
const OFFSET_Y = 190;
const OPTIONS = [
  {label: 'Approved', color: C.green},
  {label: 'Waitlisted', color: C.amber},
  {label: 'Rejected', color: C.red},
];
const TOP = 230;
const OPT_TOP = TOP + 250;
const OPT_W = (CONTENT_W - 88 - 32) / 3;
const CLICK = 26;
const P_APPROVE: Pt = {x: SAFE.side + 44 + OPT_W / 2, y: OPT_TOP + 50};
const MOVES: Move[] = [{start: 4, from: {x: 900, y: 1650}, to: P_APPROVE}];
const LOG = [
  {what: 'Official decision recorded · Approved', who: 'Demo Administrator'},
  {what: 'Interview result saved', who: 'Demo Staff'},
  {what: 'Endorsed for interview', who: 'Demo Staff'},
];
const LOG_TOP = TOP + 470;

export const Decide: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chosen = frame >= CLICK + 4;

  return (
    <Beat duration={duration} push offsetY={OFFSET_Y}>
      <AbsoluteFill style={{fontFamily: FONT, color: C.ink}}>
        <div style={{...card, position: 'absolute', top: TOP, left: SAFE.side, width: CONTENT_W, height: 400, padding: '40px 44px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <div style={{fontSize: 28, fontWeight: 700, letterSpacing: '0.1em', color: C.blue}}>DECISIONS</div>
            <div style={{fontSize: 28, fontWeight: 700, color: '#996500', background: 'rgba(231,160,74,0.18)', padding: '6px 18px', borderRadius: 999}}>Administrators only</div>
          </div>
          <div style={{fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 8}}>Record decision</div>
        </div>
        {OPTIONS.map((o, i) => {
          const sel = chosen && i === 0;
          return (
            <div
              key={o.label}
              style={{
                position: 'absolute',
                top: OPT_TOP,
                left: SAFE.side + 44 + i * (OPT_W + 16),
                width: OPT_W,
                height: 100,
                boxSizing: 'border-box',
                borderRadius: 18,
                border: `3px solid ${o.color}`,
                background: sel ? o.color : C.white,
                color: sel ? 'white' : o.color,
                fontSize: 36,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transform: `scale(${i === 0 ? press(frame, CLICK) : 1})`,
                opacity: chosen && !sel ? 0.45 : 1,
              }}
            >
              {sel && <Check size={34} color="white" />}
              {o.label}
            </div>
          );
        })}

        <div style={{position: 'absolute', top: LOG_TOP, left: SAFE.side, width: CONTENT_W, fontSize: 40, fontWeight: 800}}>Activity log</div>
        {LOG.map((l, i) => {
          const p = spring({frame: frame - CLICK - 6 - i * 6, fps, config: {damping: 15}});
          return (
            <div
              key={l.what}
              style={{
                ...card,
                position: 'absolute',
                top: LOG_TOP + 80 + i * 170,
                left: SAFE.side,
                width: CONTENT_W,
                height: 148,
                borderRadius: 24,
                padding: '0 32px',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                opacity: Math.min(1, p * 1.5),
                transform: `perspective(1400px) rotateX(${(1 - p) * 35}deg) translateY(${(1 - p) * 90}px)`,
                transformOrigin: '50% 0%',
              }}
            >
              <div style={{width: 64, height: 64, borderRadius: 999, background: C.pale, color: C.blue, fontSize: 28, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                {l.who.split(' ').map((w) => w[0]).join('')}
              </div>
              <div>
                <div style={{fontSize: 36, fontWeight: 700}}>{l.what}</div>
                <div style={{fontSize: 28, color: C.muted, marginTop: 4}}>Processed by {l.who} · Maria Santos</div>
              </div>
            </div>
          );
        })}

        <Ripple frame={frame} at={CLICK} pos={P_APPROVE} color={C.green} />
        <Cursor frame={frame} fps={fps} moves={MOVES} opacity={frame < CLICK + 14 ? 1 : Math.max(0, 1 - (frame - CLICK - 14) / 6)} />
      </AbsoluteFill>
    </Beat>
  );
};
