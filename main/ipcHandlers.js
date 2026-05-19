const { ipcMain, screen } = require('electron');
const { fetchTicker, getTickerSymbols } = require('./fugleClient');
const { chat } = require('./openrouterClient');
const settingsStore = require('./settingsStore');

function getWorkAreaInfo() {
  const { workArea } = screen.getPrimaryDisplay();
  return { workX: workArea.x, workY: workArea.y, width: workArea.width, height: workArea.height };
}

function registerIpcHandlers(mainWindow, layout) {
  let bubbleExtraW = 0;
  let bubbleExtraH = 0;
  let currentExtraW = 0;
  let currentExtraH = 0;

  function applyExtras() {
    if (!mainWindow) return;
    const desiredExtraW = bubbleExtraW;
    const desiredExtraH = bubbleExtraH;
    if (desiredExtraW === currentExtraW && desiredExtraH === currentExtraH) return;

    const deltaW = desiredExtraW - currentExtraW;
    const deltaH = desiredExtraH - currentExtraH;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setBounds({
      x: Math.round(x - deltaW / 2),
      y: Math.round(y - deltaH),
      width: layout.winWidth + desiredExtraW,
      height: layout.winHeight + desiredExtraH
    });

    currentExtraW = desiredExtraW;
    currentExtraH = desiredExtraH;
  }

  ipcMain.on('set-bubble-width', (_event, bubbleWidth) => {
    bubbleExtraW = Math.max(0, Math.ceil(bubbleWidth) + layout.petHPadding * 2 - layout.winWidth);
    applyExtras();
  });

  ipcMain.on('set-bubble-size', (_event, bubbleWidth, bubbleHeight) => {
    bubbleExtraW = Math.max(0, Math.ceil(bubbleWidth) + layout.petHPadding * 2 - layout.winWidth);
    bubbleExtraH = Math.max(0, Math.ceil(bubbleHeight) - layout.bubbleHeight);
    applyExtras();
  });

  ipcMain.on('set-ignore-mouse', (_event, ignore) => {
    if (!mainWindow) return;
    if (ignore) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      mainWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('quit-app', () => {
    if (!mainWindow) return;
    mainWindow.hide();
    settingsStore.setPetVisible(false);
  });

  ipcMain.handle('get-layout', () => layout);

  ipcMain.handle('get-screen-info', () => getWorkAreaInfo());

  ipcMain.handle('get-window-position', () => {
    if (!mainWindow) return [0, 0];
    return mainWindow.getPosition();
  });

  ipcMain.on('move-window', (_event, x, y) => {
    if (!mainWindow) return;
    mainWindow.setPosition(Math.round(x), Math.round(y));
  });

  ipcMain.on('set-window-bounds', (_event, x, y, width, height) => {
    if (!mainWindow) return;
    mainWindow.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    });
  });

  ipcMain.handle('fetch-ticker', async (_event, symbol) => fetchTicker(symbol));

  ipcMain.handle('get-ticker-symbols', () => getTickerSymbols());

  ipcMain.handle('openrouter:chat', async (_event, userMessage) => {
    const systemPrompt = settingsStore.getSystemPrompt();
    return chat(userMessage, systemPrompt);
  });
}

module.exports = { registerIpcHandlers, getWorkAreaInfo };
