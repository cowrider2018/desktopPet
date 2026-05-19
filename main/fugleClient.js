const { RestClient } = require('@fugle/marketdata');
const settingsStore = require('./settingsStore');

let fugleClient = null;

function getFugleClient() {
  if (!fugleClient) {
    const apiKey = process.env.FUGLE_MARKETDATA_API_KEY;
    if (!apiKey) throw new Error('FUGLE_MARKETDATA_API_KEY is not set in .env');
    fugleClient = new RestClient({ apiKey });
  }
  return fugleClient;
}

async function fetchTicker(symbol) {
  const client = getFugleClient();
  const snapshot = await client.stock.intraday.quote({ symbol });
  return snapshot?.closePrice ?? null;
}

function getTickerSymbols() {
  return settingsStore.getTickers();
}

module.exports = { fetchTicker, getTickerSymbols };
