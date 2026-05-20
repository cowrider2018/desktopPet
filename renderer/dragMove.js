import { setSprite } from './sprite.js';
import { getIsAnimating, cancelWalk } from './animations.js';

const DRAG_THRESHOLD_PX = 4;
const GRAVITY = 2200;          // px/s^2
const MAX_FALL_DT = 0.05;      // clamp dt so a stalled frame doesn't teleport

let petEl = null;

let screenInfo = null;         // { workX, workY, width, height }
let screenCenterX = null;
let layoutInfo = null;         // { petWidth, petHeight, petHPadding, bubbleHeight, jumpHeadroom, winWidth, winHeight }
let lastWinX = 0;
let lastWinY = 0;
let currentlyIgnoring = true;
let isDragging = false;
let dragExpanded = false;
let dragPointerId = null;
let dragStartScreenX = 0;
let dragStartScreenY = 0;
let petScreenStartX = 0;
let petScreenStartY = 0;
let petScreenX = 0;
let petScreenY = 0;
let dragMaxDelta = 0;
let wasDragging = false;
let fallRAF = null;
let fallVelocity = 0;
let lastFallTs = 0;
let slideRAF = null;
let slideResolve = null;

export function setIgnore(ignore) {
  if (ignore === currentlyIgnoring) return;
  currentlyIgnoring = ignore;
  window.petAPI.setIgnoreMouse(ignore);
}

export function getWasDragging() {
  return wasDragging;
}

export function consumeWasDragging() {
  const v = wasDragging;
  wasDragging = false;
  return v;
}

export function getIsDragging() {
  return isDragging;
}

function floorY() {
  if (!screenInfo || !layoutInfo) return null;
  return screenInfo.workY + screenInfo.height - layoutInfo.winHeight;
}

export function setFacing(faceLeft, source) {
  const prev = document.body.classList.contains('face-left');
  document.body.classList.toggle('face-left', !!faceLeft);
  if (!!faceLeft !== prev) {
    console.log('[debug] facing changed:', faceLeft ? 'left' : 'right', `(${source || 'unknown'})`);
  }
}

function setFacingFromWinX(winX) {
  if (screenCenterX == null || !layoutInfo) return;
  const petCenterX = winX + layoutInfo.winWidth / 2;
  setFacing(petCenterX > screenCenterX, 'winX');
}

function setFacingFromPetScreenX(px) {
  if (screenCenterX == null || !layoutInfo) return;
  const petCenterX = px + layoutInfo.petWidth / 2;
  setFacing(petCenterX > screenCenterX, 'petScreenX');
}

let lastDragMoveX = null;
let lastDragMoveY = null;
function logDragMove(x, y, source) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (rx === lastDragMoveX && ry === lastDragMoveY) return;
  lastDragMoveX = rx;
  lastDragMoveY = ry;
  console.log('[debug] drag-move:', rx, ry, `(${source})`);
}

function logBounds(x, y, w, h, source) {
  console.log('[debug] bounds:', Math.round(x), Math.round(y), Math.round(w), Math.round(h), `(${source})`);
}

function moveTo(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    console.warn('[dragMove] moveTo skipped: non-finite coords', { x, y });
    return;
  }
  console.log('[debug] move:', Math.round(x), Math.round(y));
  lastWinX = x;
  lastWinY = y;
  window.petAPI.moveWindow(x, y);
}

function cancelFall() {
  if (fallRAF != null) {
    cancelAnimationFrame(fallRAF);
    fallRAF = null;
  }
  fallVelocity = 0;
}

function stepFall(ts) {
  const dt = Math.min((ts - lastFallTs) / 1000, MAX_FALL_DT);
  lastFallTs = ts;
  fallVelocity += GRAVITY * dt;
  const floor = floorY();
  if (floor == null) { fallRAF = null; return; }
  let nextY = lastWinY + fallVelocity * dt;
  if (nextY >= floor) {
    moveTo(lastWinX, floor);
    fallRAF = null;
    fallVelocity = 0;
    return;
  }
  moveTo(lastWinX, nextY);
  fallRAF = requestAnimationFrame(stepFall);
}

export function getWinPosition() {
  return { x: lastWinX, y: lastWinY };
}

export function getHorizontalBounds() {
  if (!screenInfo || !layoutInfo) return null;
  const minX = screenInfo.workX - layoutInfo.petHPadding;
  const maxX = screenInfo.workX + screenInfo.width - layoutInfo.winWidth + layoutInfo.petHPadding;
  return { minX, maxX };
}

export function cancelSlide() {
  if (slideRAF != null) {
    cancelAnimationFrame(slideRAF);
    slideRAF = null;
  }
  if (slideResolve) {
    const r = slideResolve;
    slideResolve = null;
    r({ cancelled: true });
  }
}

export function slideTo(targetX, durationMs) {
  cancelSlide();
  return new Promise((resolve) => {
    if (!layoutInfo || !screenInfo) { resolve({ cancelled: true }); return; }
    const startX = lastWinX;
    const startY = lastWinY;
    const startTs = performance.now();
    const dur = Math.max(1, durationMs);
    slideResolve = resolve;
    const step = (ts) => {
      const t = Math.min(1, (ts - startTs) / dur);
      const x = Math.round(startX + (targetX - startX) * t);
      moveTo(x, startY);
      if (t >= 1) {
        slideRAF = null;
        const r = slideResolve;
        slideResolve = null;
        if (r) r({ cancelled: false });
        return;
      }
      slideRAF = requestAnimationFrame(step);
    };
    slideRAF = requestAnimationFrame(step);
  });
}

function startFall() {
  const floor = floorY();
  if (floor == null) return;
  if (lastWinY >= floor) return;
  cancelFall();
  lastFallTs = performance.now();
  fallRAF = requestAnimationFrame(stepFall);
}

export async function initPlacement() {
  layoutInfo = await window.petAPI.getLayout();
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--pet-width', `${layoutInfo.petWidth}px`);
  rootStyle.setProperty('--pet-height', `${layoutInfo.petHeight}px`);
  rootStyle.setProperty('--bubble-height', `${layoutInfo.bubbleHeight}px`);

  screenInfo = await window.petAPI.getScreenInfo();
  screenCenterX = screenInfo.workX + screenInfo.width / 2;
  const [winX, winY] = await window.petAPI.getWindowPosition();
  lastWinX = winX;
  lastWinY = winY;
}

export function onScreenInfoUpdate(info) {
  screenInfo = info;
  screenCenterX = info.workX + info.width / 2;
  if (!isDragging) startFall();
}

function expandForDrag() {
  if (dragExpanded || !screenInfo || !layoutInfo) return;
  dragExpanded = true;
  document.body.classList.add('dragging-expanded');
  const localX = petScreenX - screenInfo.workX;
  const localY = petScreenY - screenInfo.workY;
  petEl.style.left = `${localX}px`;
  petEl.style.top = `${localY}px`;
  logDragMove(localX, localY, 'expandForDrag');
  logBounds(screenInfo.workX, screenInfo.workY, screenInfo.width, screenInfo.height, 'expandForDrag');
  window.petAPI.setWindowBounds(
    screenInfo.workX,
    screenInfo.workY,
    screenInfo.width,
    screenInfo.height
  );
}

function collapseAfterDrag() {
  if (!dragExpanded || !layoutInfo) return;
  dragExpanded = false;
  const newWinX = Math.round(petScreenX - layoutInfo.petHPadding);
  const newWinY = Math.round(petScreenY - layoutInfo.bubbleHeight - layoutInfo.jumpHeadroom);
  document.body.classList.remove('dragging-expanded');
  petEl.style.left = '';
  petEl.style.top = '';
  logDragMove(0, 0, 'collapseAfterDrag-clear');
  logBounds(newWinX, newWinY, layoutInfo.winWidth, layoutInfo.winHeight, 'collapseAfterDrag');
  window.petAPI.setWindowBounds(newWinX, newWinY, layoutInfo.winWidth, layoutInfo.winHeight);
  lastWinX = newWinX;
  lastWinY = newWinY;
}

export function attachDragHandlers(el) {
  petEl = el;

  petEl.addEventListener('pointerdown', async (e) => {
    if (e.button !== 0) return;
    if (!layoutInfo) return;
    cancelFall();
    cancelSlide();
    cancelWalk();
    dragPointerId = e.pointerId;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    dragMaxDelta = 0;
    const [wx, wy] = await window.petAPI.getWindowPosition();
    lastWinX = wx;
    lastWinY = wy;
    petScreenStartX = wx + layoutInfo.petHPadding;
    petScreenStartY = wy + layoutInfo.bubbleHeight + layoutInfo.jumpHeadroom;
    petScreenX = petScreenStartX;
    petScreenY = petScreenStartY;
    isDragging = true;
    dragExpanded = false;
    setIgnore(false);
    try { petEl.setPointerCapture(e.pointerId); } catch {}
    document.body.classList.add('dragging');
  });

  petEl.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== dragPointerId) return;
    const dx = e.screenX - dragStartScreenX;
    const dy = e.screenY - dragStartScreenY;
    const dist = Math.hypot(dx, dy);
    if (dist > dragMaxDelta) dragMaxDelta = dist;
    if (dragMaxDelta < DRAG_THRESHOLD_PX) return;
    petScreenX = petScreenStartX + dx;
    petScreenY = petScreenStartY + dy;
    if (!dragExpanded) {
      setSprite('squat');
      expandForDrag();
    } else {
      const localX = petScreenX - screenInfo.workX;
      const localY = petScreenY - screenInfo.workY;
      petEl.style.left = `${localX}px`;
      petEl.style.top = `${localY}px`;
      logDragMove(localX, localY, 'pointermove');
      setFacingFromPetScreenX(petScreenX);
    }
  });

  const endDrag = (e) => {
    if (!isDragging || e.pointerId !== dragPointerId) return;
    isDragging = false;
    try { petEl.releasePointerCapture(dragPointerId); } catch {}
    document.body.classList.remove('dragging');
    wasDragging = dragMaxDelta >= DRAG_THRESHOLD_PX;
    dragPointerId = null;
    if (dragExpanded) collapseAfterDrag();
    if (!getIsAnimating()) setSprite('normal');
    startFall();
  };
  petEl.addEventListener('pointerup', endDrag);
  petEl.addEventListener('pointercancel', endDrag);
}
