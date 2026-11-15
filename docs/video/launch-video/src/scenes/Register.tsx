import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Beat} from '../components/Beat';
import {Cursor, Move, Pt, Ripple, press} from '../components/Cursor';
import {Check} from '../components/Icons';
import {C, CONTENT_W, FONT, SAFE, card, ramp} from '../theme';

// Mirrors the app's "Register applicant & application" wizard (App.tsx registrationFields).
// Centres this beat's content in the 150–1750 safe band.
const OFFSET_Y = 120;
const SECTIONS = ['Applicant Details', 'Contact & Address', 'Application Details', 'Household Information', 'Eligibility', 'Examination'];
const FIELDS = [
  {label: 'First Name', value: 'Maria', start: 34},
  {label: 'Last Name', value: 'Santos', start: 46},
  {label: 'Scholarship Program', value: 'Iskolar ng Bayan Educational Assistance', start: 60, instant: true},
  {label: 'Academic Average (0–100)', value: '91.40', start: 68},
];
const PER_CHAR = 2;
const CARD_TOP = 260;
const FIELD_TOP = CARD_TOP + 290;
const FIELD_STEP = 136;
const BTN_TOP = FIELD_TOP + FIELDS.length * FIELD_STEP + 18;
const CLICK_FIELD = 30;
const CLICK_BTN = 96;
const P_FIELD: Pt = {x: 420, y: FIELD_TOP + 38 + 36};
const P_BTN: Pt = {x: 640, y: BTN_TOP + 44};
const MOVES: Move[] = [
  {start: 8, from: {x: 900, y: 1640}, to: P_FIELD},
  {start: 78, from: P_FIELD, to: P_BTN},
];

export const Register: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const section = Math.min(SECTIONS.length - 1, Math.floor(ramp(frame, 34, 92) * SECTIONS.length));
  const done = frame >= CLICK_BTN + 4;
  const toast = spring({frame: frame - CLICK_BTN - 6, fps, config: {damping: 14}});

  return (
    <Beat duration={duration} push offsetY={OFFSET_Y}>
      <AbsoluteFill style={{fontFamily: FONT, color: C.ink}}>
        <div style={{...card, position: 'absolute', top: CARD_TOP, left: SAFE.side, width: CONTENT_W, height: BTN_TOP + 88 + 44 - CARD_TOP, padding: '40px 44px'}}>
          <div style={{fontSize: 28, fontWeight: 700, letterSpacing: '0.1em', color: C.blue}}>APPLICANTS</div>
          <div style={{fontSize: 52, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6, lineHeight: 1.1}}>Register applicant &amp; application</div>
          <div style={{display: 'flex', gap: 8, marginTop: 30}}>
            {SECTIONS.map((s, i) => (
              <div key={s} style={{flex: 1, height: 12, borderRadius: 6, background: i <= section ? C.blue : C.line}} />
            ))}
          </div>
          <div style={{fontSize: 30, fontWeight: 600, color: C.muted, marginTop: 14}}>
            Section {section + 1} of 6 · {SECTIONS[section]}
          </div>
        </div>

        {FIELDS.map((f, i) => {
          const top = FIELD_TOP + i * FIELD_STEP;
          const n = f.instant ? (frame >= f.start ? f.value.length : 0) : Math.max(0, Math.min(f.value.length, Math.floor((frame - f.start) / PER_CHAR) + 1));
          const active = frame >= f.start && (i === FIELDS.length - 1 ? frame < CLICK_BTN : frame < FIELDS[i + 1].start) && frame >= CLICK_FIELD;
          return (
            <div key={f.label} style={{position: 'absolute', top, left: SAFE.side + 44, width: CONTENT_W - 88}}>
              <div style={{fontSize: 28, fontWeight: 600, color: C.muted}}>{f.label}</div>
              <div
                style={{
                  marginTop: 8,
                  height: 72,
                  borderRadius: 16,
                  border: `3px solid ${active ? C.blue : C.line}`,
                  boxShadow: active ? '0 0 0 6px rgba(17,93,244,0.14)' : 'none',
                  background: C.canvas,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 24px',
                  fontSize: 36,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  opacity: f.instant && n ? ramp(frame, f.start, f.start + 5) * 0.6 + 0.4 : 1,
                }}
              >
                {f.value.slice(0, n)}
                {active && !f.instant && <span style={{width: 3, height: 42, marginLeft: 3, background: C.blue, opacity: Math.floor(frame / 7) % 2 ? 0 : 1}} />}
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
            background: done ? C.green : C.blue,
            color: 'white',
            fontSize: 38,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            transform: `scale(${press(frame, CLICK_BTN)})`,
            boxShadow: '0 16px 32px rgba(17,93,244,0.3)',
          }}
        >
          {done && <Check size={40} color="white" />}
          {done ? 'Registered' : 'Register applicant'}
        </div>

        {/* the app's success toast */}
        <div
          style={{
            position: 'absolute',
            top: BTN_TOP + 88 + 80,
            left: SAFE.side,
            width: CONTENT_W,
            boxSizing: 'border-box',
            padding: '26px 32px',
            borderRadius: 24,
            background: C.navy,
            color: 'white',
            fontSize: 34,
            fontWeight: 600,
            lineHeight: 1.3,
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            opacity: Math.min(1, toast * 1.4),
            transform: `translateY(${(1 - toast) * 60}px)`,
          }}
        >
          <div style={{width: 60, height: 60, borderRadius: 999, background: 'rgba(19,131,95,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            <Check size={38} color="white" />
          </div>
          Registered applicant #41 and application #41.
        </div>

        <Ripple frame={frame} at={CLICK_FIELD} pos={P_FIELD} />
        <Ripple frame={frame} at={CLICK_BTN} pos={P_BTN} color={C.navy} />
        <Cursor frame={frame} fps={fps} moves={MOVES} opacity={ramp(frame, 6, 12) * (1 - ramp(frame, CLICK_BTN + 14, CLICK_BTN + 20))} />
      </AbsoluteFill>
    </Beat>
  );
};
