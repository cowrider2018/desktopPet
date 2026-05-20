import { showBubble, isBubbleBusy } from './bubble.js';

const POLL_INTERVAL_MS = 5000;
const TICKER_DISPLAY_MS = 4000;

let intervalId = null;
let symbols = [];
let tickerShowing = false;
let tickerShowTimer = null;

export function isTickerActive() {
  return tickerShowing;
}

async function pollAllTickers() {
  if (symbols.length === 0) return;
  if (isBubbleBusy()) return;
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
  showBubble(results.join('\n'), TICKER_DISPLAY_MS);
  tickerShowing = true;
  if (tickerShowTimer) clearTimeout(tickerShowTimer);
  tickerShowTimer = setTimeout(() => {
    tickerShowing = false;
    tickerShowTimer = null;
  }, TICKER_DISPLAY_MS);
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
  if (tickerShowTimer) {
    clearTimeout(tickerShowTimer);
    tickerShowTimer = null;
  }
  tickerShowing = false;
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
