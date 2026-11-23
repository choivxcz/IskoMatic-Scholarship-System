import {AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, CLAMP, FONT} from '../theme';

// Landscape 16:9 for expo screens and projectors.
export const EW = 1920;
export const EH = 1080;

// App window: the real app was recorded at 1440x900, shown here at 0.9.
export const WIN = {x: 560, y: 108, w: 1296, h: 810, bar: 40};

const easeInOut = {...CLAMP, easing: Easing.inOut(Easing.cubic)};
const easeOut = {...CLAMP, easing: Easing.out(Easing.cubic)};

/** Fades a whole scene in over its first frames and out over its last ones. */
export const Fade: React.FC<{duration: number; children: React.ReactNode; inF?: number; outF?: number}> = ({duration, children, inF = 8, outF = 8}) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, inF], [0, 1], CLAMP), interpolate(f, [duration - outF, duration], [1, 0], CLAMP));
  return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

/** Light municipal backdrop used behind the app footage. */
export const Stage: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{fontFamily: FONT, background: 'linear-gradient(135deg, #f6f9ff 0%, #e9f1fd 100%)'}}>
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(circle 900px at 1500px 520px, rgba(50,136,255,0.16), rgba(50,136,255,0) 70%)'}} />
    <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(17,93,244,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(17,93,244,0.05) 1px, transparent 1px)', backgroundSize: '48px 48px'}} />
    {children}
  </AbsoluteFill>
);

/** Navy backdrop for the title, hook and machine-learning scenes. */
export const DarkStage: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{fontFamily: FONT, background: C.navy, color: 'white'}}>
    <AbsoluteFill style={{backgroundImage: 'radial-gradient(circle 1000px at 960px 420px, rgba(50,136,255,0.30), rgba(6,31,78,0) 70%)'}} />
    <AbsoluteFill style={{backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)', backgroundSize: '48px 48px'}} />
    {children}
  </AbsoluteFill>
);

export const Pill: React.FC<{children: React.ReactNode; tone?: 'green' | 'blue' | 'amber' | 'dark'; size?: number}> = ({children, tone = 'blue', size = 22}) => {
  const tones = {
    green: {bg: '#e3f5ec', fg: C.green, bd: '#bfe6d2'},
    blue: {bg: C.pale, fg: C.blue, bd: '#cfe0fb'},
    amber: {bg: '#fdf1e2', fg: '#a8640f', bd: '#f5d9b3'},
    dark: {bg: 'rgba(255,255,255,0.08)', fg: '#d8e5ff', bd: 'rgba(255,255,255,0.18)'},
  }[tone];
  return (
    <div style={{display: 'inline-flex', alignItems: 'center', gap: 10, padding: `${size * 0.45}px ${size * 0.9}px`, borderRadius: 999, background: tones.bg, color: tones.fg, border: `2px solid ${tones.bd}`, fontSize: size, fontWeight: 700, whiteSpace: 'nowrap'}}>
      {children}
    </div>
  );
};

/** Left-hand caption: step number, title, one or two lines, an optional proof chip. */
export const Caption: React.FC<{step?: string; title: string; body: string; chip?: string; chipTone?: 'green' | 'blue' | 'amber'; delay?: number}> = ({step, title, body, chip, chipTone = 'green', delay = 0}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = spring({frame: f - delay, fps, config: {damping: 200}});
  const b = spring({frame: f - delay - 6, fps, config: {damping: 200}});
  const c = spring({frame: f - delay - 14, fps, config: {damping: 14, stiffness: 140}});
  return (
    <div style={{position: 'absolute', left: 72, top: 0, bottom: 0, width: 440, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      {step && (
        <div style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.16em', color: C.blue, opacity: a, transform: `translateY(${(1 - a) * 20}px)`}}>
          STEP {step}
        </div>
      )}
      <div style={{fontSize: 56, fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.03em', color: C.navy, marginTop: 14, opacity: a, transform: `translateY(${(1 - a) * 30}px)`}}>{title}</div>
      <div style={{fontSize: 26, lineHeight: 1.4, color: C.muted, marginTop: 22, opacity: b, transform: `translateY(${(1 - b) * 24}px)`}}>{body}</div>
      {chip && (
        <div style={{marginTop: 30, transform: `scale(${c})`, transformOrigin: '0 50%'}}>
          <Pill tone={chipTone}>
            <span style={{fontSize: 24}}>✓</span>
            {chip}
          </Pill>
        </div>
      )}
    </div>
  );
};

export type Zoom = {f: number; s: number; x: number; y: number};

/** Scale + focus point (fractions of the frame) at this frame, eased between keyframes. */
export const zoomAt = (frame: number, keys: Zoom[]) => {
  if (keys.length < 2) return keys[0] ?? {f: 0, s: 1, x: 0.5, y: 0.5};
  const fs = keys.map((k) => k.f);
  return {
    f: frame,
    s: interpolate(frame, fs, keys.map((k) => k.s), easeInOut),
    x: interpolate(frame, fs, keys.map((k) => k.x), easeInOut),
    y: interpolate(frame, fs, keys.map((k) => k.y), easeInOut),
  };
};

/** A desktop window holding real footage (video) or a real screenshot, with optional zooms. */
export const AppWindow: React.FC<{video?: string; image?: string; rate?: number; zoom?: Zoom[]; label?: string}> = ({video, image, rate = 1, zoom = [], label = 'Recorded from the running app'}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: f, fps, config: {damping: 200}});
  const z = zoomAt(f, zoom);
  return (
    <div
      style={{
        position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h + WIN.bar, borderRadius: 18, overflow: 'hidden',
        background: 'white', border: `2px solid ${C.line}`, boxShadow: '0 50px 110px rgba(6,31,78,0.22), 0 8px 24px rgba(6,31,78,0.08)',
        transform: `translateX(${(1 - enter) * 90}px)`, opacity: enter,
      }}
    >
      <div style={{height: WIN.bar, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: '#f3f6fb', borderBottom: `1px solid ${C.line}`}}>
        <Img src={staticFile('lydo.png')} style={{width: 22, height: 22}} />
        <div style={{fontSize: 16, fontWeight: 700, color: C.ink}}>IskoMatic</div>
        <div style={{fontSize: 15, color: C.soft}}>· LYDO Santa Cruz</div>
        <div style={{flex: 1}} />
        <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: C.red}}>
          <span style={{width: 10, height: 10, borderRadius: 99, background: C.red, opacity: 0.55 + 0.45 * Math.abs(Math.sin(f / 10))}} />
          {label.toUpperCase()}
        </div>
      </div>
      <div style={{position: 'relative', width: WIN.w, height: WIN.h, overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: 0, transform: `scale(${z.s})`, transformOrigin: `${z.x * 100}% ${z.y * 100}%`}}>
          {video && <OffthreadVideo src={staticFile(video)} playbackRate={rate} muted style={{width: '100%', height: '100%'}} />}
          {image && <Img src={staticFile(image)} style={{width: '100%', height: '100%'}} />}
        </div>
      </div>
    </div>
  );
};

/** A tall real panel screenshot shown as a card that scrolls from top to bottom. */
export const PanelShot: React.FC<{image: string; srcW: number; srcH: number; width: number; left: number; duration: number; viewH?: number; top?: number; startAt?: number}> = ({image, srcW, srcH, width, left, duration, viewH = 846, top = 117, startAt = 18}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: f, fps, config: {damping: 200}});
  const scale = width / srcW;
  const travel = Math.max(0, srcH * scale - viewH);
  const y = interpolate(f, [startAt, duration - 20], [0, travel], easeInOut);
  return (
    <div
      style={{
        position: 'absolute', left, top, width, height: Math.min(viewH, srcH * scale), overflow: 'hidden', borderRadius: 18, background: 'white',
        border: `2px solid ${C.line}`, boxShadow: '0 50px 110px rgba(6,31,78,0.22)', opacity: enter, transform: `translateY(${(1 - enter) * 40}px)`,
      }}
    >
      <Img src={staticFile(image)} style={{position: 'absolute', left: 0, top: -y, width, height: srcH * scale}} />
    </div>
  );
};

/** Counts a number up from 0 between two frames. */
export const useCount = (to: number, from: number, until: number) => interpolate(useCurrentFrame(), [from, until], [0, to], easeOut);
