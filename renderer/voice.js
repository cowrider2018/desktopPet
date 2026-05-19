import { submitChatProgrammatic, isBubbleBusy } from './bubble.js';

const ONSET_RMS = 0.022;
const OFFSET_RMS = 0.012;
const TRAILING_SILENCE_MS = 1200;
const MIN_PHRASE_MS = 400;
const MAX_PHRASE_MS = 15000;
const ONSET_DEBOUNCE_MS = 80;

let enabled = false;
let starting = false;
let stream = null;
let audioContext = null;
let analyser = null;
let analyserData = null;
let rafId = null;
let recorder = null;
let recorderMime = '';
let recordedChunks = [];
let phraseStartedAt = 0;
let lastLoudAt = 0;
let onsetCandidateAt = 0;
let speaking = false;

function pickRecorderMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

function setBodyClass(name, on) {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle(name, !!on);
}

function rms(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

function startRecorder() {
  if (!stream) return;
  recordedChunks = [];
  try {
    recorder = recorderMime
      ? new MediaRecorder(stream, { mimeType: recorderMime })
      : new MediaRecorder(stream);
  } catch (err) {
    console.warn('[voice] MediaRecorder failed:', err);
    recorder = null;
    return;
  }
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };
  recorder.start();
  phraseStartedAt = performance.now();
  speaking = true;
  setBodyClass('voice-speaking', true);
}

async function finalizeRecorder(submit) {
  if (!recorder) return;
  const rec = recorder;
  recorder = null;
  speaking = false;
  setBodyClass('voice-speaking', false);

  const stopped = new Promise((resolve) => {
    rec.addEventListener('stop', resolve, { once: true });
  });
  try {
    if (rec.state !== 'inactive') rec.stop();
  } catch {}
  await stopped;

  if (!submit) {
    recordedChunks = [];
    return;
  }
  if (!enabled) {
    recordedChunks = [];
    return;
  }
  const chunks = recordedChunks;
  recordedChunks = [];
  if (!chunks.length) return;
  const mime = recorderMime || chunks[0].type || 'audio/webm';
  const blob = new Blob(chunks, { type: mime });
  if (blob.size < 1500) return;

  if (isBubbleBusy()) return;

  let buffer;
  try {
    buffer = await blob.arrayBuffer();
  } catch (err) {
    console.warn('[voice] arrayBuffer failed:', err);
    return;
  }

  let res;
  try {
    res = await window.petAPI.transcribeAudio(buffer, mime);
  } catch (err) {
    console.warn('[voice] transcribe error:', err);
    return;
  }

  if (!res || !res.ok) {
    console.warn('[voice] transcription failed:', res && res.error);
    return;
  }
  const text = (res.text || '').trim();
  if (!text) return;
  if (isBubbleBusy()) return;
  submitChatProgrammatic(text);
}

function vadTick() {
  rafId = requestAnimationFrame(vadTick);
  if (!analyser || !analyserData) return;
  analyser.getByteTimeDomainData(analyserData);
  const level = rms(analyserData);
  const now = performance.now();

  if (!speaking) {
    if (level > ONSET_RMS) {
      if (!onsetCandidateAt) onsetCandidateAt = now;
      if (now - onsetCandidateAt >= ONSET_DEBOUNCE_MS) {
        onsetCandidateAt = 0;
        lastLoudAt = now;
        startRecorder();
      }
    } else {
      onsetCandidateAt = 0;
    }
    return;
  }

  if (level > OFFSET_RMS) lastLoudAt = now;
  const phraseLen = now - phraseStartedAt;
  const silenceLen = now - lastLoudAt;

  if (phraseLen >= MAX_PHRASE_MS) {
    finalizeRecorder(true);
    return;
  }
  if (silenceLen >= TRAILING_SILENCE_MS && phraseLen >= MIN_PHRASE_MS) {
    finalizeRecorder(true);
    return;
  }
  if (silenceLen >= TRAILING_SILENCE_MS && phraseLen < MIN_PHRASE_MS) {
    finalizeRecorder(false);
    return;
  }
}

async function start() {
  if (starting || stream) return;
  starting = true;
  setBodyClass('voice-error', false);
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (err) {
    console.warn('[voice] getUserMedia failed:', err);
    setBodyClass('voice-error', true);
    starting = false;
    return;
  }

  recorderMime = pickRecorderMime();

  const Ctx = window.AudioContext || window.webkitAudioContext;
  audioContext = new Ctx();
  const source = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.4;
  analyserData = new Uint8Array(analyser.fftSize);
  source.connect(analyser);

  onsetCandidateAt = 0;
  speaking = false;
  setBodyClass('voice-active', true);
  rafId = requestAnimationFrame(vadTick);
  starting = false;
}

async function stop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (recorder) {
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch {}
    recorder = null;
  }
  speaking = false;
  recordedChunks = [];
  if (audioContext) {
    try { await audioContext.close(); } catch {}
    audioContext = null;
  }
  analyser = null;
  analyserData = null;
  if (stream) {
    for (const track of stream.getTracks()) {
      try { track.stop(); } catch {}
    }
    stream = null;
  }
  setBodyClass('voice-active', false);
  setBodyClass('voice-speaking', false);
}

export function setVoiceEnabled(on) {
  const next = !!on;
  if (next === enabled) return;
  enabled = next;
  if (enabled) start();
  else stop();
}

export function isVoiceEnabled() {
  return enabled;
}
