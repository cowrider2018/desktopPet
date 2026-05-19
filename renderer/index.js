import { pick } from './utils.js';
import { initSprite, isOverPetBody } from './sprite.js';
import { initBubble, showBubble, clickLines, enterEditMode, isBubbleEditing } from './bubble.js';
import { setVoiceEnabled } from './voice.js';
import {
  initAnimations,
  playAnimation,
  getIsAnimating,
  animations,
  clickAnimations
} from './animations.js';
import {
  initPlacement,
  attachDragHandlers,
  onScreenInfoUpdate,
  setIgnore,
  consumeWasDragging,
  getIsDragging
} from './dragMove.js';
import { startTickerLoop } from './ticker.js';

const RANDOM_BEHAVIOR_INTERVAL_MS = 15000;
const RANDOM_BEHAVIOR_PROBABILITY = 0.25;
const CLICK_BUBBLE_MS = 3000;
const HELLO_BUBBLE_MS = 4500;
const HELLO_DELAY_MS = 800;

const pet = document.getElementById('pet');
const bubble = document.getElementById('bubble');
const sprite = document.getElementById('sprite');

initSprite(sprite);
initBubble(bubble);
initAnimations(pet);

function isOverBubble(clientX, clientY) {
  if (!bubble || bubble.classList.contains('hidden')) return false;
  const r = bubble.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

window.addEventListener('mousemove', (e) => {
  if (getIsDragging()) return;
  const overPet = isOverPetBody(e.clientX, e.clientY, getIsAnimating());
  const overBubble = isOverBubble(e.clientX, e.clientY);
  setIgnore(!(overPet || overBubble));
});
window.addEventListener('mouseleave', () => {
  if (getIsDragging()) return;
  if (!isBubbleEditing()) setIgnore(true);
});

let voiceOn = false;

pet.addEventListener('click', (e) => {
  e.preventDefault();
  if (consumeWasDragging()) return;
  if (isBubbleEditing()) return;
  if (!voiceOn) showBubble(pick(clickLines), CLICK_BUBBLE_MS);
  playAnimation(pick(clickAnimations));
});

bubble.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (voiceOn) return;
  enterEditMode();
});

bubble.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
});

pet.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.petAPI.quit();
});

setInterval(() => {
  if (getIsAnimating()) return;
  if (Math.random() < RANDOM_BEHAVIOR_PROBABILITY) {
    playAnimation(pick(animations));
  }
}, RANDOM_BEHAVIOR_INTERVAL_MS);

setTimeout(() => showBubble("🐾", HELLO_BUBBLE_MS), HELLO_DELAY_MS);

attachDragHandlers(pet);
initPlacement();
window.petAPI.onScreenInfo(onScreenInfoUpdate);
startTickerLoop();

window.petAPI.onVoiceInputChanged((on) => {
  voiceOn = !!on;
  setVoiceEnabled(voiceOn);
});

(async () => {
  try {
    const state = await window.petAPI.settings.get();
    voiceOn = !!state.voiceInput;
    if (voiceOn) setVoiceEnabled(true);
  } catch (err) {
    console.warn('[voice] initial settings fetch failed:', err);
  }
})();
