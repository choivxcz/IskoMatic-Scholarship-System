import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, CONTENT_W, FONT} from '../theme';
import {Beat} from './Beat';

/** A short text beat: words rise in one by one out of a blur; the period lands last in app blue. */
export const Headline: React.FC<{duration: number; text: string}> = ({duration, text}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.replace(/\.$/, '').split(' ');
  const dot = spring({frame: frame - 4 - words.length * 3, fps, config: {damping: 9, stiffness: 160}});
  return (
    <Beat duration={duration}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: CONTENT_W,
            textAlign: 'center',
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: 118,
            lineHeight: 1.04,
            letterSpacing: '-0.035em',
            color: C.navy,
          }}
        >
          {words.map((w, i) => {
            const p = spring({frame: frame - i * 3, fps, config: {damping: 16, stiffness: 140}});
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  marginRight: i < words.length - 1 ? '0.24em' : 0,
                  transform: `translateY(${(1 - p) * 70}px)`,
                  filter: `blur(${(1 - p) * 12}px)`,
                  opacity: Math.min(1, p * 1.5),
                }}
              >
                {w}
              </span>
            );
          })}
          <span style={{display: 'inline-block', color: C.blue, transform: `scale(${dot})`, transformOrigin: '50% 80%'}}>.</span>
        </div>
      </AbsoluteFill>
    </Beat>
  );
};
