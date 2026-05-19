const { ipcMain } = require('electron');
const settingsStore = require('./settingsStore');

function registerSettingsHandlers({ getMainWindow, getSettingsWindow }) {
  ipcMain.handle('settings:get', () => settingsStore.getState());

  ipcMain.handle('settings:add-ticker', (_event, symbol) => settingsStore.addTicker(symbol));

  ipcMain.handle('settings:remove-ticker', (_event, symbol) => settingsStore.removeTicker(symbol));

  ipcMain.handle('settings:set-price-tracking', (_event, on) => {
    const value = settingsStore.setPriceTracking(on);
    const win = getMainWindow && getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('price-tracking-changed', value);
    }
    return value;
  });

  ipcMain.handle('settings:set-pet-visible', (_event, on) => {
    const value = settingsStore.setPetVisible(on);
    const win = getMainWindow && getMainWindow();
    if (win) {
      if (value) win.show();
      else win.hide();
    }
    return value;
  });

  ipcMain.handle('settings:set-voice-input', (_event, on) => settingsStore.setVoiceInput(on));

  ipcMain.handle('settings:set-system-prompt', (_event, value) => settingsStore.setSystemPrompt(value));

  ipcMain.on('settings:hide', () => {
    const win = getSettingsWindow && getSettingsWindow();
    if (win) win.hide();
  });
}

module.exports = { registerSettingsHandlers };
