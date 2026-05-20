import { setSprite } from './sprite.js';

export const animations = ['jump', 'walk', 'wiggle'];
export const clickAnimations = ['jump', 'wiggle'];

const SQUAT_TO_ROAR_MS = 130;

let petEl = null;
let isAnimating = false;
let sequenceTimers = [];

export function initAnimations(el) {
  petEl = el;
}

export function getIsAnimating() {
  return isAnimating;
}

export function playAnimation(name) {
  if (isAnimating || !petEl) return;
  isAnimating = true;
  petEl.classList.remove('idle');

  if (name === 'jump') {
    setSprite('squat');
    setTimeout(() => setSprite('roar'), SQUAT_TO_ROAR_MS);
  } else {
    setSprite('roar');
  }
  petEl.classList.add(name);

  const onEnd = () => {
    petEl.classList.remove(name);
    petEl.classList.add('idle');
    setSprite('normal');
    petEl.removeEventListener('animationend', onEnd);
    isAnimating = false;
  };
  petEl.addEventListener('animationend', onEnd);
}

// Multi-stage body-language sequences played in reaction to LLM emotion.
// Each stage: { cssClass, sprite, durationMs }. CSS class drives the motion
// (keyframe in styles.css); sprite swap happens at stage start.
const emotionSequences = {
  happy: [
    { cssClass: 'emo-bounce', sprite: 'normal', durationMs: 600, face: 'right' },
    { cssClass: 'emo-bounce', sprite: 'normal', durationMs: 600, face: 'left' }
  ],
  excited: [
    { cssClass: 'emo-spin-jump', sprite: 'roar', durationMs: 900, face: 'left' },
    { cssClass: 'emo-bounce', sprite: 'normal', durationMs: 500, face: 'right' }
  ],
  sad: [
    { cssClass: 'emo-droop', sprite: 'squat', durationMs: 700, face: 'right' },
    { cssClass: 'emo-lift', sprite: 'normal', durationMs: 700, face: 'left' }
  ],
  angry: [
    { cssClass: 'emo-shake', sprite: 'roar', durationMs: 800, face: 'left' },
    { cssClass: 'emo-bounce', sprite: 'normal', durationMs: 400, face: 'right' }
  ],
  surprised: [
    { cssClass: 'emo-squash', sprite: 'squat', durationMs: 220 },
    { cssClass: 'emo-tall', sprite: 'roar', durationMs: 700, face: 'right' },
    { cssClass: 'emo-bounce', sprite: 'normal', durationMs: 400, face: 'left' }
  ],
  thoughtful: [
    { cssClass: 'emo-lean-left', sprite: 'normal', durationMs: 700, face: 'left' },
    { cssClass: 'emo-lean-right', sprite: 'normal', durationMs: 700, face: 'right' }
  ],
  neutral: []
};

function clearSequenceTimers() {
  for (const t of sequenceTimers) clearTimeout(t);
  sequenceTimers = [];
}

export function playEmotionSequence(emotion) {
  if (!petEl) return;
  const stages = emotionSequences[emotion];
  if (!stages || stages.length === 0) return;
  if (isAnimating) return;

  isAnimating = true;
  petEl.classList.remove('idle');
  const initialFaceLeft = document.body.classList.contains('face-left');

  let cumulative = 0;
  const stageClasses = stages.map((s) => s.cssClass);

  stages.forEach((stage, i) => {
    sequenceTimers.push(setTimeout(() => {
      for (const c of stageClasses) petEl.classList.remove(c);
      petEl.classList.add(stage.cssClass);
      setSprite(stage.sprite);
      if (stage.face === 'left') document.body.classList.add('face-left');
      else if (stage.face === 'right') document.body.classList.remove('face-left');
    }, cumulative));
    cumulative += stage.durationMs;
  });

  sequenceTimers.push(setTimeout(() => {
    for (const c of stageClasses) petEl.classList.remove(c);
    setSprite('normal');
    document.body.classList.toggle('face-left', initialFaceLeft);
    petEl.classList.add('idle');
    isAnimating = false;
    sequenceTimers = [];
  }, cumulative));
}
