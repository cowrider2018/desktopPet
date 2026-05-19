export const clickLines = [
  "Go drink water!",
  "I'm watching you... 👀",
  "Take a break la bro!",
  "Wheeee!",
  "🎉",
];

const HIDE_TRANSITION_MS = 350;
const RESPONSE_BUBBLE_MS = 8000;
const ASPECT_RATIO_WRAP_THRESHOLD = 10;

let bubbleEl = null;
let bubbleTimer = null;
let isEditing = false;
let isAwaitingReply = false;
let isShowingResponse = false;

export function initBubble(el) {
  bubbleEl = el;
}

// Measure natural single-line size, then decide whether to wrap.
// Wrapping (vertical growth) is only allowed when width/height > threshold.
function applyLayout(text) {
  bubbleEl.style.whiteSpace = 'nowrap';
  bubbleEl.style.maxWidth = '';
  bubbleEl.textContent = text;
  void bubbleEl.offsetWidth;
  const { width, height } = bubbleEl.getBoundingClientRect();
  if (height > 0 && width / height > ASPECT_RATIO_WRAP_THRESHOLD) {
    bubbleEl.style.whiteSpace = 'pre-wrap';
    bubbleEl.style.maxWidth = Math.ceil(width) + 'px';
  }
}

function clearLayoutStyle() {
  if (!bubbleEl) return;
  bubbleEl.style.whiteSpace = '';
  bubbleEl.style.maxWidth = '';
}

function reportBubbleSize() {
  if (!bubbleEl || !window.petAPI?.setBubbleSize) return;
  const { width, height } = bubbleEl.getBoundingClientRect();
  window.petAPI.setBubbleSize(width, height);
}

function resetBubbleSize() {
  if (!window.petAPI?.setBubbleSize) return;
  window.petAPI.setBubbleSize(0, 0);
}

function clearHideTimer() {
  if (bubbleTimer) {
    clearTimeout(bubbleTimer);
    bubbleTimer = null;
  }
}

function hideBubble() {
  if (!bubbleEl) return;
  clearHideTimer();
  bubbleEl.classList.remove('visible');
  setTimeout(() => {
    if (!bubbleEl) return;
    bubbleEl.classList.add('hidden');
    bubbleEl.classList.remove('bubble--editing', 'bubble--chat-response');
    bubbleEl.textContent = '';
    clearLayoutStyle();
    resetBubbleSize();
  }, HIDE_TRANSITION_MS);
}

export function showBubble(text, duration = 4000) {
  if (!bubbleEl) return;
  clearHideTimer();
  bubbleEl.classList.remove('bubble--editing', 'bubble--chat-response');
  applyLayout(text);
  bubbleEl.classList.remove('hidden');
  void bubbleEl.offsetWidth;
  bubbleEl.classList.add('visible');
  requestAnimationFrame(reportBubbleSize);

  bubbleTimer = setTimeout(() => {
    bubbleEl.classList.remove('visible');
    setTimeout(() => {
      bubbleEl.classList.add('hidden');
      clearLayoutStyle();
      resetBubbleSize();
    }, HIDE_TRANSITION_MS);
    bubbleTimer = null;
  }, duration);
}

function showChatResponse(text) {
  if (!bubbleEl) return;
  clearHideTimer();
  bubbleEl.classList.add('bubble--chat-response');
  bubbleEl.classList.remove('bubble--editing');
  applyLayout(text);
  bubbleEl.classList.remove('hidden');
  void bubbleEl.offsetWidth;
  bubbleEl.classList.add('visible');
  isShowingResponse = true;
  requestAnimationFrame(reportBubbleSize);

  bubbleTimer = setTimeout(() => {
    bubbleEl.classList.remove('visible');
    setTimeout(() => {
      bubbleEl.classList.add('hidden');
      bubbleEl.classList.remove('bubble--chat-response');
      clearLayoutStyle();
      resetBubbleSize();
      isShowingResponse = false;
    }, HIDE_TRANSITION_MS);
    bubbleTimer = null;
  }, RESPONSE_BUBBLE_MS);
}

async function submitChat(text) {
  if (!bubbleEl) return;
  clearHideTimer();
  clearLayoutStyle();
  bubbleEl.classList.remove('bubble--editing', 'bubble--chat-response');
  bubbleEl.textContent = '…';
  bubbleEl.classList.remove('hidden');
  void bubbleEl.offsetWidth;
  bubbleEl.classList.add('visible');
  isAwaitingReply = true;
  requestAnimationFrame(reportBubbleSize);

  let res;
  try {
    res = await window.petAPI.chat(text);
  } catch (err) {
    res = { ok: false, error: err?.message || String(err) };
  }

  isEditing = false;
  isAwaitingReply = false;
  if (res && res.ok) {
    showChatResponse(res.text || '(empty reply)');
  } else {
    showChatResponse('⚠ ' + (res?.error || 'unknown error'));
  }
}

export function submitChatProgrammatic(text) {
  const value = String(text || '').trim();
  if (!value) return;
  submitChat(value);
}

export function isBubbleBusy() {
  return isEditing || isAwaitingReply || isShowingResponse;
}

function cancelEdit() {
  if (!isEditing) return;
  isEditing = false;
  hideBubble();
}

export function enterEditMode() {
  if (!bubbleEl || isEditing) return;
  isEditing = true;
  clearHideTimer();
  clearLayoutStyle();

  bubbleEl.classList.remove('bubble--chat-response');
  bubbleEl.classList.add('bubble--editing');
  bubbleEl.textContent = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'bubble-input';
  input.placeholder = 'Say something…';
  input.autocomplete = 'off';
  bubbleEl.appendChild(input);

  bubbleEl.classList.remove('hidden');
  void bubbleEl.offsetWidth;
  bubbleEl.classList.add('visible');
  requestAnimationFrame(() => {
    reportBubbleSize();
    input.focus();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = input.value.trim();
      if (!value) {
        cancelEdit();
        return;
      }
      submitChat(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (isEditing && bubbleEl && bubbleEl.contains(input) && document.activeElement !== input) {
        cancelEdit();
      }
    }, 120);
  });
}

export function isBubbleEditing() {
  return isEditing;
}
