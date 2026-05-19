import { setSprite } from './sprite.js';
import { getIsAnimating } from './animations.js';

const DRAG_THRESHOLD_PX = 4;
const GRAVITY = 2200;          // px/s^2
const MAX_FALL_DT = 0.05;      // clamp dt so a stalled frame doesn't teleport

let petEl = null;

let screenInfo = null;         // { workX, workY, width, height }
let screenCenterX = null;
let lastWinX = 0;
let lastWinY = 0;
let currentlyIgnoring = true;
let isDragging = false;
let dragPointerId = null;
let dragStartScreenX = 0;
let dragStartScreenY = 0;
let dragWinStartX = 0;
let dragWinStartY = 0;
let dragMaxDelta = 0;
let wasDragging = false;
let fallRAF = null;
let fallVelocity = 0;
let lastFallTs = 0;

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

function floorY() {
  if (!screenInfo) return null;
  return screenInfo.workY + screenInfo.height - window.innerHeight;
}

function setFacingFromWinX(winX) {
  if (screenCenterX == null) return;
  const petCenterX = winX + window.innerWidth / 2;
  const faceLeft = petCenterX > screenCenterX;
  document.body.classList.toggle('face-left', faceLeft);
}

function moveTo(x, y) {
  lastWinX = x;
  lastWinY = y;
  window.petAPI.moveWindow(x, y);
  setFacingFromWinX(x);
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

function startFall() {
  const floor = floorY();
  if (floor == null) return;
  if (lastWinY >= floor) return;
  cancelFall();
  lastFallTs = performance.now();
  fallRAF = requestAnimationFrame(stepFall);
}

export async function initPlacement() {
  const layout = await window.petAPI.getLayout();
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--pet-width', `${layout.petWidth}px`);
  rootStyle.setProperty('--pet-height', `${layout.petHeight}px`);
  rootStyle.setProperty('--bubble-height', `${layout.bubbleHeight}px`);

  screenInfo = await window.petAPI.getScreenInfo();
  screenCenterX = screenInfo.workX + screenInfo.width / 2;
  const [winX, winY] = await window.petAPI.getWindowPosition();
  lastWinX = winX;
  lastWinY = winY;
  setFacingFromWinX(winX);
}

export function onScreenInfoUpdate(info) {
  screenInfo = info;
  screenCenterX = info.workX + info.width / 2;
  setFacingFromWinX(lastWinX);
  if (!isDragging) startFall();
}

export function attachDragHandlers(el) {
  petEl = el;

  petEl.addEventListener('pointerdown', async (e) => {
    if (e.button !== 0) return;
    cancelFall();
    dragPointerId = e.pointerId;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    dragMaxDelta = 0;
    const [wx, wy] = await window.petAPI.getWindowPosition();
    dragWinStartX = wx;
    dragWinStartY = wy;
    lastWinX = wx;
    lastWinY = wy;
    isDragging = true;
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
    setSprite('squat');
    moveTo(dragWinStartX + dx, dragWinStartY + dy);
  });

  const endDrag = (e) => {
    if (!isDragging || e.pointerId !== dragPointerId) return;
    isDragging = false;
    try { petEl.releasePointerCapture(dragPointerId); } catch {}
    document.body.classList.remove('dragging');
    wasDragging = dragMaxDelta >= DRAG_THRESHOLD_PX;
    dragPointerId = null;
    if (!getIsAnimating()) setSprite('normal');
    startFall();
  };
  petEl.addEventListener('pointerup', endDrag);
  petEl.addEventListener('pointercancel', endDrag);
}
