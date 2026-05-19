import { showBubble } from './bubble.js';

const POLL_INTERVAL_MS = 3000;

let intervalId = null;
let symbols = [];

async function pollAllTickers() {
  if (symbols.length === 0) return;
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const price = await window.petAPI.fetchTicker(symbol);
        return `${symbol}: ${price ?? '?'}`;
      } catch {
        return `${symbol}: err`;
      }
    })
  );
  showBubble(results.join('\n'), POLL_INTERVAL_MS);
}

async function start() {
  if (intervalId) return;
  symbols = await window.petAPI.getTickerSymbols();
  if (symbols.length === 0) return;
  await pollAllTickers();
  intervalId = setInterval(pollAllTickers, POLL_INTERVAL_MS);
}

function stop() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
}

export async function startTickerLoop() {
  const settings = await window.petAPI.settings.get();
  if (settings.priceTracking) {
    await start();
  }
  window.petAPI.onPriceTrackingChanged(async (on) => {
    if (on) await start();
    else stop();
  });
}
