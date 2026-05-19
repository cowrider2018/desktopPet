const api = window.petAPI.settings;

const els = {
  petVisible: document.getElementById('toggle-pet-visible'),
  priceTracking: document.getElementById('toggle-price-tracking'),
  voiceInput: document.getElementById('toggle-voice-input'),
  list: document.getElementById('ticker-list'),
  form: document.getElementById('ticker-add'),
  input: document.getElementById('ticker-input'),
  systemPrompt: document.getElementById('system-prompt'),
  systemPromptSave: document.getElementById('system-prompt-save'),
  systemPromptStatus: document.getElementById('system-prompt-status')
};

let promptStatusTimer = null;
function flashPromptStatus(text) {
  if (!els.systemPromptStatus) return;
  els.systemPromptStatus.textContent = text;
  els.systemPromptStatus.classList.add('visible');
  if (promptStatusTimer) clearTimeout(promptStatusTimer);
  promptStatusTimer = setTimeout(() => {
    els.systemPromptStatus.classList.remove('visible');
  }, 1500);
}

function renderTickers(tickers) {
  els.list.innerHTML = '';
  if (!tickers.length) {
    const empty = document.createElement('li');
    empty.className = 'ticker-empty';
    empty.textContent = 'No symbols yet';
    els.list.appendChild(empty);
    return;
  }
  for (const symbol of tickers) {
    const row = document.createElement('li');
    row.className = 'ticker-row';

    const name = document.createElement('span');
    name.className = 'ticker-name';
    name.textContent = symbol;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ticker-remove';
    remove.setAttribute('aria-label', `Remove ${symbol}`);
    remove.textContent = '×';
    remove.addEventListener('click', async () => {
      const updated = await api.removeTicker(symbol);
      renderTickers(updated);
    });

    row.append(name, remove);
    els.list.appendChild(row);
  }
}

function bindToggle(input, setter) {
  input.addEventListener('change', () => {
    setter(input.checked);
  });
}

async function init() {
  const state = await api.get();
  els.petVisible.checked = Boolean(state.petVisible);
  els.priceTracking.checked = Boolean(state.priceTracking);
  els.voiceInput.checked = Boolean(state.voiceInput);
  if (els.systemPrompt) els.systemPrompt.value = state.systemPrompt || '';
  renderTickers(state.tickers || []);

  bindToggle(els.petVisible, (on) => api.setPetVisible(on));
  bindToggle(els.priceTracking, (on) => api.setPriceTracking(on));
  bindToggle(els.voiceInput, (on) => api.setVoiceInput(on));

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = els.input.value;
    if (!raw.trim()) return;
    const updated = await api.addTicker(raw);
    els.input.value = '';
    renderTickers(updated);
  });

  if (els.systemPromptSave) {
    els.systemPromptSave.addEventListener('click', async () => {
      const value = els.systemPrompt ? els.systemPrompt.value : '';
      await api.setSystemPrompt(value);
      flashPromptStatus('Saved ✓');
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
