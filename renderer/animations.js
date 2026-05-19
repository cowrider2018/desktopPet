import { setSprite } from './sprite.js';

export const animations = ['jump', 'walk', 'wiggle'];
export const clickAnimations = ['jump', 'wiggle'];

const SQUAT_TO_ROAR_MS = 130;

let petEl = null;
let isAnimating = false;

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
