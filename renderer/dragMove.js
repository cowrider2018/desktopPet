import { setSprite } from './sprite.js';
import { getIsAnimating } from './animations.js';

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

function setFacingFromWinX(winX) {
  if (screenCenterX == null || !layoutInfo) return;
  const petCenterX = winX + layoutInfo.winWidth / 2;
  const faceLeft = petCenterX > screenCenterX;
  document.body.classList.toggle('face-left', faceLeft);
}

function setFacingFromPetScreenX(px) {
  if (screenCenterX == null || !layoutInfo) return;
  const petCenterX = px + layoutInfo.petWidth / 2;
  const faceLeft = petCenterX > screenCenterX;
  document.body.classList.toggle('face-left', faceLeft);
}

function moveTo(x, y) {
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
  petEl.style.left = `${petScreenX - screenInfo.workX}px`;
  petEl.style.top = `${petScreenY - screenInfo.workY}px`;
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
      petEl.style.left = `${petScreenX - screenInfo.workX}px`;
      petEl.style.top = `${petScreenY - screenInfo.workY}px`;
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
