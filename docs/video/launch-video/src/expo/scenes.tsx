import {Fragment} from 'react';
import {AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, CLAMP} from '../theme';
import {AppWindow, Caption, DarkStage, Fade, PanelShot, Pill, Stage, WIN, Zoom} from './kit';

const easeOut = {...CLAMP, easing: Easing.out(Easing.cubic)};

/* ---------------------------------------------------------------- hook + title */

const Words: React.FC<{text: string; start: number; size: number; color?: string; weight?: number}> = ({text, start, size, color = 'white', weight = 800}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div style={{fontSize: size, fontWeight: weight, letterSpacing: '-0.035em', lineHeight: 1.08, color}}>
      {text.split(' ').map((w, i) => {
        const p = spring({frame: f - start - i * 3, fps, config: {damping: 16, stiffness: 140}});
        return (
          <span key={i} style={{display: 'inline-block', marginRight: '0.24em', opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 50}px)`, filter: `blur(${(1 - p) * 10}px)`}}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Hook: React.FC<{duration: number}> = ({duration}) => {
  const f = useCurrentFrame();
  const first = interpolate(f, [52, 62], [1, 0.32], CLAMP);
  return (
    <Fade duration={duration} inF={1}>
      <DarkStage>
        <AbsoluteFill style={{justifyContent: 'center', padding: '0 180px', gap: 26}}>
          <div style={{opacity: first}}>
            <Words text="Every scholarship slot matters." start={4} size={88} />
          </div>
          <Words text="Screening by hand is slow, inconsistent and hard to explain." start={58} size={66} color="#9fc0ff" weight={700} />
        </AbsoluteFill>
      </DarkStage>
    </Fade>
  );
};

export const Title: React.FC<{duration: number}> = ({duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seals = spring({frame: f, fps, config: {damping: 11, stiffness: 150}});
  const word = spring({frame: f - 10, fps, config: {damping: 200}});
  const sub = spring({frame: f - 20, fps, config: {damping: 200}});
  const pill = spring({frame: f - 32, fps, config: {damping: 14}});
  return (
    <Fade duration={duration}>
      <DarkStage>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
          <div style={{display: 'flex', gap: 28, transform: `scale(${seals})`}}>
            <div style={{background: 'white', borderRadius: 24, padding: 10}}><Img src={staticFile('stc.png')} style={{height: 120}} /></div>
            <div style={{background: 'white', borderRadius: 24, padding: 10}}><Img src={staticFile('lydo.png')} style={{height: 120, width: 120}} /></div>
          </div>
          <div style={{fontSize: 190, fontWeight: 800, letterSpacing: '-0.055em', lineHeight: 1, marginTop: 34, opacity: word, transform: `translateY(${(1 - word) * 40}px)`}}>
            Isko<span style={{color: C.azure}}>Matic</span>
          </div>
          <div style={{opacity: sub, transform: `translateY(${(1 - sub) * 30}px)`}}>
            <div style={{fontSize: 30, fontWeight: 700, letterSpacing: '0.18em', color: '#9fc0ff', marginTop: 10}}>AI-ASSISTED SCHOLARSHIP SCREENING</div>
            <div style={{fontSize: 30, color: '#d8e5ff', marginTop: 18}}>Local Youth Development Office · Santa Cruz, Laguna</div>
          </div>
          <div style={{marginTop: 40, transform: `scale(${pill})`}}>
            <Pill tone="dark" size={22}>● Real system footage · fictional demo records</Pill>
          </div>
        </AbsoluteFill>
      </DarkStage>
    </Fade>
  );
};

/* ---------------------------------------------------------------- app footage */

export const AppScene: React.FC<{
  duration: number; step: string; title: string; body: string; chip?: string; chipTone?: 'green' | 'blue' | 'amber';
  video?: string; image?: string; rate?: number; zoom?: Zoom[]; label?: string;
}> = ({duration, step, title, body, chip, chipTone, video, image, rate, zoom, label}) => (
  <Fade duration={duration}>
    <Stage>
      <Caption step={step} title={title} body={body} chip={chip} chipTone={chipTone} />
      <AppWindow video={video} image={image} rate={rate} zoom={zoom} label={label} />
    </Stage>
  </Fade>
);

/** Registration: the six-step form sped up, then the server refusing bad data at real speed, then the fix. */
export const RegisterScene: React.FC<{duration: number; parts: number[]}> = ({duration, parts}) => {
  const [FORM, ERROR] = parts;
  return (
    <Fade duration={duration}>
      <Stage>
        <Sequence durationInFrames={FORM}>
          <Caption step="02" title="One guided form" body="Applicant, contact, household, eligibility and exam details in six validated steps." chip="5× speed" chipTone="blue" />
          <AppWindow video="expo/reg_form.mp4" rate={5} />
        </Sequence>
        <Sequence from={FORM} durationInFrames={ERROR}>
          <Caption title="The server double-checks" body="20 dependents in a household of 6? Refused, whichever screen sends it." chip="Validated on the server" />
          <AppWindow video="expo/reg_error.mp4" rate={1.3} zoom={[{f: 0, s: 1, x: 0.13, y: 0.6}, {f: 50, s: 1, x: 0.13, y: 0.6}, {f: 70, s: 1.9, x: 0.13, y: 0.6}, {f: 150, s: 1.9, x: 0.13, y: 0.6}, {f: 172, s: 1, x: 0.13, y: 0.6}]} />
        </Sequence>
        <Sequence from={FORM + ERROR}>
          <Caption title="Fixed in one step" body="Corrected to 4 dependents and registered as application APP-46." chip="Registered" />
          <AppWindow video="expo/reg_fixed.mp4" rate={2.5} zoom={[{f: 0, s: 1, x: 0.98, y: 0.95}, {f: 58, s: 1, x: 0.98, y: 0.95}, {f: 74, s: 1.8, x: 0.98, y: 0.95}, {f: 113, s: 1.8, x: 0.98, y: 0.95}]} />
        </Sequence>
      </Stage>
    </Fade>
  );
};

/* ---------------------------------------------------------------- panel close-ups with callouts */

const Callouts: React.FC<{title: string; rows: {label: string; value: string; tone?: 'good' | 'bad' | 'plain'}[]; total?: {label: string; value: string}; left: number; start?: number}> = ({title, rows, total, left, start = 20}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = spring({frame: f - start + 10, fps, config: {damping: 200}});
  return (
    <div style={{position: 'absolute', left, top: 117, width: 1856 - left, height: 846, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
      <div style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.14em', color: C.blue, opacity: head}}>{title}</div>
      <div style={{marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10}}>
        {rows.map((r, i) => {
          const p = spring({frame: f - start - i * 5, fps, config: {damping: 200}});
          const color = r.tone === 'bad' ? C.red : r.tone === 'good' ? C.green : C.ink;
          return (
            <div key={i} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '12px 20px', borderRadius: 14, background: 'white', border: `2px solid ${r.tone === 'bad' ? '#f3c7cf' : C.line}`, opacity: p, transform: `translateX(${(1 - p) * 40}px)`}}>
              <div style={{fontSize: 24, color: C.ink}}>{r.label}</div>
              <div style={{fontSize: 26, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums'}}>{r.value}</div>
            </div>
          );
        })}
      </div>
      {total && (() => {
        const p = spring({frame: f - start - rows.length * 5 - 6, fps, config: {damping: 12, stiffness: 150}});
        return (
          <div style={{marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderRadius: 16, background: C.navy, color: 'white', transform: `scale(${p})`, transformOrigin: '0 50%'}}>
            <div style={{fontSize: 26, fontWeight: 700}}>{total.label}</div>
            <div style={{fontSize: 44, fontWeight: 800}}>{total.value}</div>
          </div>
        );
      })()}
    </div>
  );
};

export const RulesScene: React.FC<{duration: number}> = ({duration}) => (
  <Fade duration={duration}>
    <Stage>
      <Caption step="03" title="Rules come first" body="The office's eligibility rules run before the AI. Fail one, and the AI doesn't score it — staff confirm." chip="AI never overrides policy" />
      <PanelShot image="expo/rulefail.png" srcW={640} srcH={1065} width={560} left={600} duration={duration} viewH={932} top={74} />
      <Callouts
        title="APP-28 · RULES CHECKED"
        left={1220}
        rows={[
          {label: 'Entrance exam ≥ 80%', value: '✗ 58%', tone: 'bad'},
          {label: 'Academic average > 75', value: '✓ 86', tone: 'good'},
          {label: 'Not a 4Ps beneficiary', value: '✓', tone: 'good'},
          {label: 'Not an SPES beneficiary', value: '✓', tone: 'good'},
          {label: 'No other scholar in family', value: '✓', tone: 'good'},
        ]}
      />
    </Stage>
  </Fade>
);

export const ExplainPanelScene: React.FC<{duration: number}> = ({duration}) => (
  <Fade duration={duration}>
    <Stage>
      <Caption title="Every factor adds up" body="The starting chance plus each factor's push equals the prediction — exactly. No black box." chip="From the forest's own decision paths" />
      <PanelShot image="expo/explain_bea.png" srcW={640} srcH={2110} width={540} left={590} duration={duration} />
      <Callouts
        title="BEA REYES SANTOS · APP-46"
        left={1180}
        start={10}
        rows={[
          {label: 'Starting chance', value: '50.0%'},
          {label: 'Household size 6', value: '+9.6', tone: 'good'},
          {label: 'Seniors in household 1', value: '+9.0', tone: 'good'},
          {label: 'Dependents 4', value: '+8.5', tone: 'good'},
          {label: 'Below MSWDO poverty line', value: '+7.8', tone: 'good'},
          {label: 'Academic average 92.5', value: '+5.3', tone: 'good'},
          {label: 'Income ₱9,000 a month', value: '+5.2', tone: 'good'},
          {label: 'Children 3 · solo parent · PWDs 0', value: '+1.7', tone: 'good'},
        ]}
        total={{label: 'Chance of qualifying', value: '97.1%'}}
      />
    </Stage>
  </Fade>
);

export const RefsScene: React.FC<{duration: number}> = ({duration}) => (
  <Fade duration={duration}>
    <Stage>
      <Caption step="08" title="Every result is traceable" body="Source records, each rule with the value used, the model behind it, and who did what." chip="6 steps, each with a name" />
      <PanelShot image="expo/refs_bea.png" srcW={640} srcH={2680} width={560} left={700} duration={duration} startAt={10} />
      <Callouts
        title="WHAT A REVIEWER SEES"
        left={1330}
        start={14}
        rows={[
          {label: 'Source records', value: '5'},
          {label: 'Rules checked', value: '5 / 5'},
          {label: 'Model', value: 'rf-3.0.0'},
          {label: 'Recorded steps', value: '6'},
        ]}
      />
    </Stage>
  </Fade>
);

/* ---------------------------------------------------------------- machine learning */

const SectionHead: React.FC<{kicker: string; title: string}> = ({kicker, title}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: f, fps, config: {damping: 200}});
  return (
    <div style={{position: 'absolute', left: 120, top: 84, opacity: p, transform: `translateY(${(1 - p) * 24}px)`}}>
      <div style={{fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', color: C.azure}}>{kicker}</div>
      <div style={{fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', marginTop: 10}}>{title}</div>
    </div>
  );
};

const Spec: React.FC<{value: string; label: string; i: number}> = ({value, label, i}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: f - 12 - i * 5, fps, config: {damping: 200}});
  return (
    <div style={{padding: '30px 34px', borderRadius: 22, background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.12)', opacity: p, transform: `translateY(${(1 - p) * 30}px)`}}>
      <div style={{fontSize: 56, fontWeight: 800, letterSpacing: '-0.02em'}}>{value}</div>
      <div style={{fontSize: 24, color: '#b9c9ea', marginTop: 6}}>{label}</div>
    </div>
  );
};

const ModelSpecs: React.FC = () => (
  <>
    <SectionHead kicker="UNDER THE HOOD · MACHINE LEARNING" title="A Random Forest that shows its work." />
    <div style={{position: 'absolute', left: 120, right: 120, top: 330, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 26}}>
      <Spec i={0} value="300" label="decision trees vote on each applicant" />
      <Spec i={1} value="9" label="need and merit factors (never sex, age or barangay)" />
      <Spec i={2} value="5,502" label="applicants used for training" />
      <Spec i={3} value="1,376" label="unseen applicants used for testing" />
      <Spec i={4} value="1.8" label="scikit-learn version, pinned" />
      <Spec i={5} value="rf-3.0.0" label="model version saved with every result" />
    </div>
  </>
);

const Matrix: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  // reports/model_evaluation/metrics.json, held-out test split
  const cells = [
    {n: 547, label: 'Correct: not qualified', good: true},
    {n: 141, label: 'Wrongly called qualified', good: false},
    {n: 100, label: 'Missed: was qualified', good: false},
    {n: 588, label: 'Correct: qualified', good: true},
  ];
  const metrics: [string, number, number, string][] = [
    ['Accuracy', 82.5, 1, '%'], ['Precision', 80.7, 1, '%'], ['Recall', 85.5, 1, '%'],
    ['Specificity', 79.5, 1, '%'], ['F1 score', 83.0, 1, '%'], ['ROC-AUC', 0.91, 2, ''],
  ];
  return (
    <>
      <SectionHead kicker="TESTED ON 1,376 APPLICANTS IT NEVER SAW" title="Confusion matrix and scores." />
      <div style={{position: 'absolute', left: 120, top: 300}}>
        <div style={{display: 'grid', gridTemplateColumns: '170px 300px 300px', gridTemplateRows: '50px 200px 200px', gap: 12}}>
          <div />
          <div style={{fontSize: 22, color: '#b9c9ea', textAlign: 'center', alignSelf: 'end'}}>Predicted not qualified</div>
          <div style={{fontSize: 22, color: '#b9c9ea', textAlign: 'center', alignSelf: 'end'}}>Predicted qualified</div>
          {[0, 1].map((r) => (
            <Fragment key={r}>
              <div style={{fontSize: 22, color: '#b9c9ea', alignSelf: 'center', textAlign: 'right', paddingRight: 8}}>{r === 0 ? 'Actually not qualified' : 'Actually qualified'}</div>
              {[0, 1].map((c) => {
                const cell = cells[r * 2 + c];
                const p = spring({frame: f - 10 - (r * 2 + c) * 6, fps, config: {damping: 14, stiffness: 120}});
                const n = Math.round(interpolate(f, [14 + (r * 2 + c) * 6, 50 + (r * 2 + c) * 6], [0, cell.n], easeOut));
                return (
                  <div key={`c${r}${c}`} style={{borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: cell.good ? 'rgba(47,208,143,0.18)' : 'rgba(255,107,129,0.14)', border: `2px solid ${cell.good ? 'rgba(47,208,143,0.55)' : 'rgba(255,107,129,0.45)'}`, transform: `scale(${p})`}}>
                    <div style={{fontSize: 72, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: cell.good ? '#62e3ad' : '#ff9aa8'}}>{n}</div>
                    <div style={{fontSize: 22, color: '#d8e5ff'}}>{cell.label}</div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: 1050, top: 330, width: 750, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18}}>
        {metrics.map(([label, v, dp, unit], i) => {
          const p = spring({frame: f - 30 - i * 5, fps, config: {damping: 200}});
          const val = interpolate(f, [34 + i * 5, 80 + i * 5], [0, v], easeOut);
          return (
            <div key={label} style={{padding: '24px 22px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.12)', opacity: p}}>
              <div style={{fontSize: 52, fontWeight: 800, fontVariantNumeric: 'tabular-nums'}}>{val.toFixed(dp)}{unit}</div>
              <div style={{fontSize: 22, color: '#b9c9ea', marginTop: 4}}>{label}</div>
            </div>
          );
        })}
        <div style={{gridColumn: '1 / span 3', marginTop: 10, opacity: interpolate(f, [70, 85], [0, 1], CLAMP)}}>
          <Pill tone="dark" size={22}>5-fold cross-validation: 83.1% ± 0.8% accuracy</Pill>
        </div>
      </div>
    </>
  );
};

const Importance: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  // Impurity importance from metrics.json (share of the model's decisions).
  const rows: [string, number][] = [
    ['Within MSWDO poverty threshold', 28.5], ['Household size', 19.9], ['Number of dependents', 14.5],
    ['Monthly household income', 11.9], ['Academic average', 8.8], ['Seniors in household', 7.7],
    ['PWDs in household', 4.6], ['Children in household', 2.9], ['Solo parent household', 1.2],
  ];
  const stat = spring({frame: f - 40, fps, config: {damping: 14}});
  return (
    <>
      <SectionHead kicker="WHAT THE MODEL RELIES ON" title="Need first. Merit is already a rule." />
      <div style={{position: 'absolute', left: 120, top: 290, width: 1060}}>
        {rows.map(([label, v], i) => {
          const w = interpolate(f, [8 + i * 4, 40 + i * 4], [0, v / 28.5], easeOut);
          return (
            <div key={label} style={{display: 'flex', alignItems: 'center', gap: 20, height: 62}}>
              <div style={{width: 400, fontSize: 25, color: '#d8e5ff', textAlign: 'right'}}>{label}</div>
              <div style={{flex: 1, height: 34, position: 'relative'}}>
                <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w * 88}%`, borderRadius: 8, background: i === 0 ? C.azure : 'rgba(50,136,255,0.55)'}} />
                <div style={{position: 'absolute', left: `calc(${w * 88}% + 14px)`, top: 0, fontSize: 25, fontWeight: 800, lineHeight: '34px', opacity: w > 0.02 ? 1 : 0}}>{(w * 28.5).toFixed(1)}%</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 1280, top: 330, width: 520, padding: '40px 44px', borderRadius: 26, background: 'rgba(255,255,255,0.07)', border: '2px solid rgba(255,255,255,0.14)', transform: `scale(${stat})`}}>
        <div style={{fontSize: 24, fontWeight: 800, letterSpacing: '0.12em', color: C.azure}}>PRIORITY RANKING</div>
        <div style={{fontSize: 120, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05, marginTop: 12}}>96.4%</div>
        <div style={{fontSize: 28, color: '#d8e5ff', lineHeight: 1.35}}>of the top-ranked 10% were truly qualified, against 50% overall.</div>
      </div>
    </>
  );
};

const ReportPan: React.FC<{duration: number}> = ({duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame: f, fps, config: {damping: 200}});
  const imgH = 4892 * (WIN.w / 1920);
  const y = interpolate(f, [12, duration - 12], [0, imgH - WIN.h], {...CLAMP, easing: Easing.inOut(Easing.cubic)});
  return (
    <>
      <div style={{position: 'absolute', left: 72, top: 0, bottom: 0, width: 440, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: enter}}>
        <div style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.16em', color: C.azure}}>REPRODUCIBLE</div>
        <div style={{fontSize: 54, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', marginTop: 14}}>The system writes its own report card.</div>
        <div style={{fontSize: 25, lineHeight: 1.4, color: '#b9c9ea', marginTop: 20}}>One command regenerates every number shown here: matrix, ROC curve, cross-validation and feature importance.</div>
        <div style={{marginTop: 28, padding: '14px 18px', borderRadius: 14, border: '2px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.08)', fontSize: 20, lineHeight: 1.4, color: '#d8e5ff'}}>
          Trained on synthetic data because of the Data Privacy Act (RA 10173). Retrains on real LYDO records with two commands.
        </div>
      </div>
      <div style={{position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h + WIN.bar, borderRadius: 18, overflow: 'hidden', background: 'white', boxShadow: '0 50px 110px rgba(0,0,0,0.45)', opacity: enter, transform: `translateX(${(1 - enter) * 90}px)`}}>
        <div style={{height: WIN.bar, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10, background: '#f3f6fb', borderBottom: `1px solid ${C.line}`, fontSize: 16, color: C.ink, fontWeight: 700}}>
          evaluation_report.html <span style={{fontWeight: 400, color: C.soft}}>· generated by evaluate_ml_model.py</span>
        </div>
        <div style={{position: 'relative', width: WIN.w, height: WIN.h, overflow: 'hidden'}}>
          <Img src={staticFile('expo/report.png')} style={{position: 'absolute', left: 0, top: -y, width: WIN.w, height: imgH}} />
        </div>
      </div>
    </>
  );
};

/** parts: frames for the model specs, confusion matrix, feature importance and report pan. */
export const MLScene: React.FC<{duration: number; parts: number[]}> = ({duration, parts}) => {
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((a, b) => a + b, 0));
  const nodes = [<ModelSpecs key="a" />, <Matrix key="b" />, <Importance key="c" />, <ReportPan key="d" duration={parts[3]} />];
  return (
    <Fade duration={duration}>
      <DarkStage>
        {nodes.map((n, i) => (
          <Sequence key={i} from={starts[i]} durationInFrames={parts[i]}>
            <Fade duration={parts[i]} inF={i === 0 ? 1 : 8} outF={i === 3 ? 1 : 8}>{n}</Fade>
          </Sequence>
        ))}
      </DarkStage>
    </Fade>
  );
};

/* ---------------------------------------------------------------- tech stack */

const Layer: React.FC<{i: number; name: string; tech: string; detail: string; accent?: boolean}> = ({i, name, tech, detail, accent}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = spring({frame: f - 8 - i * 7, fps, config: {damping: 200}});
  return (
    <div style={{flex: 1, padding: '28px 26px', borderRadius: 22, background: accent ? '#e8f0ff' : 'white', border: `2px solid ${accent ? C.azure : C.line}`, boxShadow: '0 24px 60px rgba(6,31,78,0.10)', opacity: p, transform: `translateY(${(1 - p) * 40}px)`}}>
      <div style={{fontSize: 20, fontWeight: 800, letterSpacing: '0.12em', color: C.blue}}>{name.toUpperCase()}</div>
      <div style={{fontSize: 33, fontWeight: 800, color: C.navy, marginTop: 10, lineHeight: 1.15}}>{tech}</div>
      <div style={{fontSize: 21, color: C.muted, marginTop: 10, lineHeight: 1.35}}>{detail}</div>
    </div>
  );
};

const Arrow: React.FC<{i: number}> = ({i}) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [14 + i * 7, 24 + i * 7], [0, 1], CLAMP);
  return <div style={{alignSelf: 'center', fontSize: 40, color: C.azure, opacity: o, fontWeight: 800}}>→</div>;
};

export const TechStack: React.FC<{duration: number}> = ({duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const head = spring({frame: f, fps, config: {damping: 200}});
  const security = ['PBKDF2-SHA256 · 600,000 iterations', 'Sign-in locks after 5 wrong tries', 'Logged before every change', 'Loopback-only service', 'Parameterized SQL', 'CSV formula-injection guard'];
  return (
    <Fade duration={duration}>
      <Stage>
        <div style={{position: 'absolute', left: 120, top: 90, opacity: head}}>
          <div style={{fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', color: C.blue}}>TECH STACK</div>
          <div style={{fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em', color: C.navy, marginTop: 10}}>Runs entirely on the office computer.</div>
        </div>
        <div style={{position: 'absolute', left: 120, right: 120, top: 330, display: 'flex', gap: 18}}>
          <Layer i={0} name="Interface" tech="React 18 + TypeScript" detail="Built with Vite 6 · Inter type · light and dark modes" />
          <Arrow i={0} />
          <Layer i={1} name="Desktop window" tech="Tauri 2" detail="Native Windows app (Rust + WebView2)" />
          <Arrow i={1} />
          <Layer i={2} name="Local service" tech="Python" detail="Business rules, workflow and validation · 127.0.0.1 only" accent />
          <Arrow i={2} />
          <Layer i={3} name="AI screening" tech="scikit-learn 1.8" detail="Random Forest · pandas 3 · NumPy 2 · joblib" />
          <Arrow i={3} />
          <Layer i={4} name="Database" tech="MySQL" detail="Applicants, decisions, screening history, activity log" />
        </div>
        <div style={{position: 'absolute', left: 120, right: 120, top: 700}}>
          <div style={{fontSize: 22, fontWeight: 800, letterSpacing: '0.14em', color: C.blue, opacity: interpolate(f, [40, 52], [0, 1], CLAMP)}}>SECURITY BUILT IN</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 18}}>
            {security.map((s, i) => {
              const p = spring({frame: f - 46 - i * 4, fps, config: {damping: 14}});
              return (
                <div key={s} style={{transform: `scale(${p})`}}>
                  <Pill tone="green" size={22}>✓ {s}</Pill>
                </div>
              );
            })}
          </div>
        </div>
      </Stage>
    </Fade>
  );
};

/* ---------------------------------------------------------------- end card */

export const EndCard: React.FC<{duration: number}> = ({duration}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const seals = spring({frame: f, fps, config: {damping: 11, stiffness: 150}});
  const a = spring({frame: f - 10, fps, config: {damping: 200}});
  const b = spring({frame: f - 24, fps, config: {damping: 200}});
  const out = interpolate(f, [duration - 14, duration], [0, 1], CLAMP);
  return (
    <AbsoluteFill>
      <Stage>
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: C.navy}}>
          <div style={{display: 'flex', gap: 28, transform: `scale(${seals})`}}>
            <Img src={staticFile('stc.png')} style={{height: 110}} />
            <Img src={staticFile('lydo.png')} style={{height: 110, width: 110}} />
          </div>
          <div style={{fontSize: 150, fontWeight: 800, letterSpacing: '-0.055em', lineHeight: 1, marginTop: 26, opacity: a, transform: `translateY(${(1 - a) * 30}px)`}}>
            Isko<span style={{color: C.blue}}>Matic</span>
          </div>
          <div style={{fontSize: 46, fontWeight: 700, marginTop: 14, opacity: a}}>Fair opportunities. A brighter Santa Cruz.</div>
          <div style={{opacity: b, transform: `translateY(${(1 - b) * 20}px)`, marginTop: 46}}>
            <div style={{fontSize: 24, fontWeight: 800, letterSpacing: '0.18em', color: C.blue}}>TEAM TRIARCH</div>
            <div style={{fontSize: 30, color: C.ink, marginTop: 12}}>Emlyn Nicole U. Abe · Karl Sebastian V. Cuerdo · Marian Therese D. Flores</div>
            <div style={{fontSize: 26, color: C.muted, marginTop: 10}}>Laguna State Polytechnic University · for the Local Youth Development Office, Santa Cruz, Laguna</div>
          </div>
        </AbsoluteFill>
      </Stage>
      <AbsoluteFill style={{background: C.navy, opacity: out}} />
    </AbsoluteFill>
  );
};
