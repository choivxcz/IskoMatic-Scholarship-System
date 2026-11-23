import {VO, VoId} from './voiceover';

// When everything in the Expo video happens. Pure data (no React) so it can be checked from Node.
//
// A beat is one or more parts (sub-scenes with their own footage or animation). Each voice-over cue is
// anchored to a part, `at` frames after the part starts. A cue never starts before the previous one has
// finished (+GAP), and a part grows when its narration needs more room (+TAIL), so voice and picture stay
// together whatever the TTS lengths turn out to be. Parts never shrink below their base length.

export type BeatName =
  | 'Hook' | 'Title' | 'Sign-in' | 'Register' | 'Rules' | 'Batch' | 'Explain' | 'Factors'
  | 'Ranking' | 'ML' | 'Decision' | 'Traceability' | 'Tech stack' | 'End card';

type Cue = {id: VoId; at: number; part?: number};
type BeatSpec = {name: BeatName; parts: number[]; vo: Cue[]};

const GAP = 8;
const TAIL = 16;

const SPECS: BeatSpec[] = [
  {name: 'Hook', parts: [150], vo: [{id: 'hook1', at: 6}, {id: 'hook2', at: 56}]},
  {name: 'Title', parts: [100], vo: [{id: 'title', at: 10}]},
  {name: 'Sign-in', parts: [170], vo: [{id: 'signin', at: 10}]},
  {name: 'Register', parts: [165, 180, 105], vo: [{id: 'reg1', at: 10}, {id: 'reg2', at: 8, part: 1}, {id: 'reg3', at: 8, part: 2}]},
  {name: 'Rules', parts: [135], vo: [{id: 'rules', at: 10}]},
  {name: 'Batch', parts: [230], vo: [{id: 'batch', at: 10}]},
  {name: 'Explain', parts: [225], vo: [{id: 'explain', at: 10}]},
  {name: 'Factors', parts: [165], vo: [{id: 'factors', at: 8}]},
  {name: 'Ranking', parts: [135], vo: [{id: 'rank', at: 8}]},
  {name: 'ML', parts: [120, 180, 120, 120], vo: [{id: 'ml1', at: 8}, {id: 'ml2', at: 8, part: 1}, {id: 'ml3', at: 8, part: 2}, {id: 'ml4', at: 8, part: 3}]},
  {name: 'Decision', parts: [345], vo: [{id: 'decision', at: 12}]},
  {name: 'Traceability', parts: [135], vo: [{id: 'refs', at: 10}]},
  {name: 'Tech stack', parts: [210], vo: [{id: 'tech', at: 12}]},
  {name: 'End card', parts: [165], vo: [{id: 'end', at: 14}]},
];

export type PlacedBeat = {name: BeatName; from: number; frames: number; parts: number[]};
export type PlacedCue = {id: VoId; file: string; from: number; frames: number; text: string};

const layout = (specs: BeatSpec[]) => {
  const beats: PlacedBeat[] = [];
  const cues: PlacedCue[] = [];
  let from = 0;
  let cursor = -GAP; // end of the previous cue
  for (const spec of specs) {
    const parts = [...spec.parts];
    let partFrom = from;
    parts.forEach((base, p) => {
      for (const cue of spec.vo.filter((c) => (c.part ?? 0) === p).sort((a, b) => a.at - b.at)) {
        const vo = VO[cue.id];
        const start = Math.max(partFrom + cue.at, cursor + GAP);
        cursor = start + vo.frames;
        cues.push({id: cue.id, file: vo.file, from: start, frames: vo.frames, text: vo.text});
        parts[p] = Math.max(parts[p], cursor + TAIL - partFrom);
      }
      partFrom += parts[p] ?? base;
    });
    const frames = parts.reduce((s, n) => s + n, 0);
    beats.push({name: spec.name, from, frames, parts});
    from += frames;
  }
  return {beats, cues, total: from};
};

export const TIMELINE = layout(SPECS);
export const EXPO_FRAMES = TIMELINE.total;
