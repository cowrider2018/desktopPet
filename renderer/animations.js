import { setSprite } from './sprite.js';
import { getWinPosition, getHorizontalBounds, slideTo, cancelSlide, setFacing } from './dragMove.js';

function logAnimClass(action, name, source) {
  console.log('[debug] anim-class:', `${action === 'remove' ? '-' : '+'}${name}`, `(${source})`);
}

export const animations = ['jump', 'walk', 'wiggle'];
export const clickAnimations = ['jump', 'wiggle'];

const SQUAT_TO_ROAR_MS = 130;
const WALK_MIN_PX = 180;
const WALK_MAX_PX = 720;
const WALK_SPEED_PX_PER_MS = 0.18;
const WALK_FRAME_MS = 180;

let petEl = null;
let isAnimating = false;
let sequenceTimers = [];
let walkFrameTimer = null;

export function initAnimations(el) {
  petEl = el;
}

export function getIsAnimating() {
  return isAnimating;
}

export function playAnimation(name) {
  if (isAnimating || !petEl) return;
  if (name === 'walk') { playWalk(); return; }
  isAnimating = true;
  petEl.classList.remove('idle');
  logAnimClass('remove', 'idle', `playAnimation:${name}`);

  if (name === 'jump') {
    setSprite('squat');
    setTimeout(() => setSprite('roar'), SQUAT_TO_ROAR_MS);
  } else {
    setSprite('roar');
  }
  petEl.classList.add(name);
  logAnimClass('add', name, 'playAnimation');

  const onEnd = () => {
    petEl.classList.remove(name);
    logAnimClass('remove', name, 'playAnimation:end');
    petEl.classList.add('idle');
    logAnimClass('add', 'idle', 'playAnimation:end');
    setSprite('normal');
    petEl.removeEventListener('animationend', onEnd);
    isAnimating = false;
  };
  petEl.addEventListener('animationend', onEnd);
}

function stopWalkFrames() {
  if (walkFrameTimer != null) {
    clearInterval(walkFrameTimer);
    walkFrameTimer = null;
  }
}

export function cancelWalk() {
  stopWalkFrames();
  cancelSlide();
}

async function playWalk() {
  const bounds = getHorizontalBounds();
  const pos = getWinPosition();
  if (!bounds || !pos) return;

  isAnimating = true;
  petEl.classList.remove('idle');
  logAnimClass('remove', 'idle', 'playWalk');

  let direction = Math.random() < 0.5 ? -1 : 1;
  let distance = Math.round(WALK_MIN_PX + Math.random() * (WALK_MAX_PX - WALK_MIN_PX));
  let targetX = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x + direction * distance));
  if (Math.abs(targetX - pos.x) < 30) {
    direction = -direction;
    targetX = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x + direction * distance));
  }
  const actualDistance = Math.abs(targetX - pos.x);

  setFacing(direction < 0, 'playWalk');

  let frame = 0;
  setSprite('walk1');
  walkFrameTimer = setInterval(() => {
    frame = 1 - frame;
    setSprite(frame === 0 ? 'walk1' : 'walk2');
  }, WALK_FRAME_MS);

  const durationMs = Math.max(120, Math.round(actualDistance / WALK_SPEED_PX_PER_MS));
  await slideTo(targetX, durationMs);

  stopWalkFrames();
  setSprite('normal');
  petEl.classList.add('idle');
  logAnimClass('add', 'idle', 'playWalk:end');
  isAnimating = false;
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
  logAnimClass('remove', 'idle', `playEmotionSequence:${emotion}`);
  const initialFaceLeft = document.body.classList.contains('face-left');

  let cumulative = 0;
  const stageClasses = stages.map((s) => s.cssClass);

  stages.forEach((stage, i) => {
    sequenceTimers.push(setTimeout(() => {
      for (const c of stageClasses) {
        if (petEl.classList.contains(c)) {
          petEl.classList.remove(c);
          logAnimClass('remove', c, `emo:${emotion}:stage${i}`);
        }
      }
      petEl.classList.add(stage.cssClass);
      logAnimClass('add', stage.cssClass, `emo:${emotion}:stage${i}`);
      setSprite(stage.sprite);
      if (stage.face === 'left') setFacing(true, `emo:${emotion}:stage${i}`);
      else if (stage.face === 'right') setFacing(false, `emo:${emotion}:stage${i}`);
    }, cumulative));
    cumulative += stage.durationMs;
  });

  sequenceTimers.push(setTimeout(() => {
    for (const c of stageClasses) {
      if (petEl.classList.contains(c)) {
        petEl.classList.remove(c);
        logAnimClass('remove', c, `emo:${emotion}:cleanup`);
      }
    }
    setSprite('normal');
    setFacing(initialFaceLeft, `emo:${emotion}:restore`);
    petEl.classList.add('idle');
    logAnimClass('add', 'idle', `emo:${emotion}:cleanup`);
    isAnimating = false;
    sequenceTimers = [];
  }, cumulative));
}
