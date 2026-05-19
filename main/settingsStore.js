const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_SYSTEM_PROMPT = 'You are a friendly desktop pet companion. Keep replies short (1-2 sentences) and playful.';

const DEFAULT_STATE = {
  tickers: [],
  priceTracking: true,
  petVisible: true,
  voiceInput: false,
  systemPrompt: DEFAULT_SYSTEM_PROMPT
};

function normalizeSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

let state = null;
let filePath = null;

function getFilePath() {
  if (!filePath) filePath = path.join(app.getPath('userData'), 'settings.json');
  return filePath;
}

function readEnvSeed() {
  const raw = process.env.TICKER_SYMBOL;
  if (!raw) return [];
  return Array.from(new Set(raw.split(',').map(normalizeSymbol).filter(Boolean)));
}

function persist() {
  const target = getFilePath();
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, target);
}

function load() {
  const target = getFilePath();
  try {
    const raw = fs.readFileSync(target, 'utf8');
    const parsed = JSON.parse(raw);
    state = {
      ...DEFAULT_STATE,
      ...parsed,
      tickers: Array.isArray(parsed.tickers) ? parsed.tickers : []
    };
    let changed = false;
    for (const sym of readEnvSeed()) {
      if (!state.tickers.includes(sym)) {
        state.tickers.push(sym);
        changed = true;
      }
    }
    if (changed) persist();
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[settingsStore] failed to read settings.json, reseeding:', err.message);
    }
    state = { ...DEFAULT_STATE, tickers: readEnvSeed() };
    persist();
  }
  return state;
}

function ensureLoaded() {
  if (!state) load();
}

function getState() {
  ensureLoaded();
  return { ...state, tickers: [...state.tickers] };
}

function getTickers() {
  ensureLoaded();
  return [...state.tickers];
}

function addTicker(symbol) {
  ensureLoaded();
  const normalized = normalizeSymbol(symbol);
  if (normalized && !state.tickers.includes(normalized)) {
    state.tickers.push(normalized);
    persist();
  }
  return [...state.tickers];
}

function removeTicker(symbol) {
  ensureLoaded();
  const normalized = normalizeSymbol(symbol);
  const idx = state.tickers.indexOf(normalized);
  if (idx >= 0) {
    state.tickers.splice(idx, 1);
    persist();
  }
  return [...state.tickers];
}

function setPriceTracking(on) {
  ensureLoaded();
  state.priceTracking = Boolean(on);
  persist();
  return state.priceTracking;
}

function setPetVisible(on) {
  ensureLoaded();
  state.petVisible = Boolean(on);
  persist();
  return state.petVisible;
}

function setVoiceInput(on) {
  ensureLoaded();
  state.voiceInput = Boolean(on);
  persist();
  return state.voiceInput;
}

function getSystemPrompt() {
  ensureLoaded();
  return state.systemPrompt ?? '';
}

function setSystemPrompt(value) {
  ensureLoaded();
  state.systemPrompt = String(value ?? '');
  persist();
  return state.systemPrompt;
}

module.exports = {
  load,
  getState,
  getTickers,
  addTicker,
  removeTicker,
  setPriceTracking,
  setPetVisible,
  setVoiceInput,
  getSystemPrompt,
  setSystemPrompt
};
