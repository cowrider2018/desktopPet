const SPRITES = {
  normal: './img/normal.png',
  squat:  './img/squat.png',
  roar:   './img/roar.png'
};

const ALPHA_THRESHOLD = 32;

let spriteEl = null;
let currentSprite = 'normal';
const alphaCanvas = document.createElement('canvas');
const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true });
let alphaReady = false;

function rebuildAlphaMap() {
  alphaReady = false;
  const img = new Image();
  img.onload = () => {
    alphaCanvas.width = img.naturalWidth;
    alphaCanvas.height = img.naturalHeight;
    alphaCtx.clearRect(0, 0, img.naturalWidth, img.naturalHeight);
    try {
      alphaCtx.drawImage(img, 0, 0);
      alphaReady = true;
    } catch (e) {
      console.error('alpha map draw failed', e);
    }
  };
  img.src = SPRITES[currentSprite];
}

export function initSprite(el) {
  spriteEl = el;
  rebuildAlphaMap();
}

export function setSprite(name) {
  if (currentSprite === name) return;
  currentSprite = name;
  spriteEl.src = SPRITES[name];
  rebuildAlphaMap();
}

export function isOverPetBody(clientX, clientY, isAnimating) {
  if (!alphaReady || !spriteEl) return false;
  const rect = spriteEl.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right ||
      clientY < rect.top  || clientY > rect.bottom) return false;
  if (isAnimating) return true;
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top)  / rect.height;
  const sampleU = document.body.classList.contains('face-left') ? (1 - u) : u;
  const px = Math.floor(sampleU * alphaCanvas.width);
  const py = Math.floor(v * alphaCanvas.height);
  try {
    const alpha = alphaCtx.getImageData(px, py, 1, 1).data[3];
    return alpha > ALPHA_THRESHOLD;
  } catch (e) {
    return true;
  }
}
