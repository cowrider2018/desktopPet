const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  quit: () => ipcRenderer.send('quit-app'),
  hidePet: () => ipcRenderer.send('quit-app'),
  fetchTicker: (symbol) => ipcRenderer.invoke('fetch-ticker', symbol),
  getTickerSymbols: () => ipcRenderer.invoke('get-ticker-symbols'),
  getLayout: () => ipcRenderer.invoke('get-layout'),
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info'),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  moveWindow: (x, y) => ipcRenderer.send('move-window', x, y),
  setWindowBounds: (x, y, width, height) => ipcRenderer.send('set-window-bounds', x, y, width, height),
  setBubbleWidth: (width) => ipcRenderer.send('set-bubble-width', width),
  setBubbleSize: (width, height) => ipcRenderer.send('set-bubble-size', width, height),
  onScreenInfo: (cb) => ipcRenderer.on('screen-info', (_e, info) => cb(info)),
  onPriceTrackingChanged: (cb) => ipcRenderer.on('price-tracking-changed', (_e, on) => cb(on)),
  chat: (message) => ipcRenderer.invoke('openrouter:chat', message),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    addTicker: (symbol) => ipcRenderer.invoke('settings:add-ticker', symbol),
    removeTicker: (symbol) => ipcRenderer.invoke('settings:remove-ticker', symbol),
    setPriceTracking: (on) => ipcRenderer.invoke('settings:set-price-tracking', on),
    setPetVisible: (on) => ipcRenderer.invoke('settings:set-pet-visible', on),
    setVoiceInput: (on) => ipcRenderer.invoke('settings:set-voice-input', on),
    setSystemPrompt: (value) => ipcRenderer.invoke('settings:set-system-prompt', value),
    hide: () => ipcRenderer.send('settings:hide')
  }
});
