# Desktop Pet

An always-on-top desktop pet built with Electron. The sprite animates, can be dragged around the screen, falls back to the work-area floor under gravity, faces the screen center, and periodically displays Taiwan stock quotes pulled from the Fugle MarketData API.

## Setup

```sh
npm install
```

Create a `.env` file in the project root with the following keys:

```
FUGLE_MARKETDATA_API_KEY=your_fugle_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
GROQ_API_KEY=your_groq_api_key
TICKER_SYMBOL=1234,5678
```

- `FUGLE_MARKETDATA_API_KEY` — required to fetch quotes. Obtain one from [Fugle MarketData](https://developer.fugle.tw/).
- `TICKER_SYMBOL` — comma-separated list of Taiwan stock symbols to cycle through (one per second). Leave empty to disable the ticker.

## Run

```sh
npm start
```

## Package

```sh
npm run dist
```

Builds a Windows NSIS installer and zip via `electron-builder`.

## Controls

- **Left-click** the pet to trigger a random animation and dialogue line.
- **Drag** the pet to reposition it; releasing in mid-air drops it under gravity to the work-area floor.
- **Right-click** the pet to quit.
