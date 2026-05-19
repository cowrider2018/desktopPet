const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { registerIpcHandlers, getWorkAreaInfo } = require('./main/ipcHandlers');
const { registerSettingsHandlers } = require('./main/settingsHandlers');
const settingsStore = require('./main/settingsStore');

const PET_WIDTH = 112;
const PET_HEIGHT = 112;
const BUBBLE_HEIGHT = 56;
const JUMP_HEADROOM = 60;
const PET_H_PADDING = 16;
const WIN_WIDTH = PET_WIDTH + PET_H_PADDING * 2;
const WIN_HEIGHT = PET_HEIGHT + BUBBLE_HEIGHT + JUMP_HEADROOM;

const SETTINGS_WIN_WIDTH = 320;
const SETTINGS_WIN_HEIGHT = 400;

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let isQuitting = false;

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const { x: workX, y: workY } = primaryDisplay.workArea;

  const winX = workX + width - PET_WIDTH - 10 - PET_H_PADDING;
  const winY = workY + height - WIN_HEIGHT;

  mainWindow = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: winX,
    y: winY,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    movable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  screen.on('display-metrics-changed', () => {
    if (!mainWindow) return;
    mainWindow.webContents.send('screen-info', getWorkAreaInfo());
  });
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: SETTINGS_WIN_WIDTH,
    height: SETTINGS_WIN_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.setAlwaysOnTop(true, 'screen-saver');
  settingsWindow.loadFile('setting.html');

  settingsWindow.on('blur', () => {
    if (settingsWindow && settingsWindow.isVisible()) settingsWindow.hide();
  });

  settingsWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
}

function positionSettingsWindow() {
  if (!tray || !settingsWindow) return;

  const trayBounds = tray.getBounds();
  const display = screen.getDisplayMatching(trayBounds);
  const work = display.workArea;
  const full = display.bounds;
  const [winW, winH] = settingsWindow.getSize();

  const taskbarOnTop = work.y > full.y;
  const taskbarOnLeft = work.x > full.x;
  const taskbarOnRight = work.x === full.x && work.width < full.width;
  const taskbarOnBottom = work.y === full.y && work.height < full.height;

  let x;
  let y;

  if (taskbarOnTop) {
    x = trayBounds.x + trayBounds.width / 2 - winW / 2;
    y = work.y;
  } else if (taskbarOnLeft) {
    x = work.x;
    y = trayBounds.y + trayBounds.height / 2 - winH / 2;
  } else if (taskbarOnRight) {
    x = work.x + work.width - winW;
    y = trayBounds.y + trayBounds.height / 2 - winH / 2;
  } else if (taskbarOnBottom) {
    x = trayBounds.x + trayBounds.width / 2 - winW / 2;
    y = work.y + work.height - winH;
  } else {
    x = trayBounds.x + trayBounds.width / 2 - winW / 2;
    y = trayBounds.y - winH;
  }

  x = Math.max(work.x, Math.min(x, work.x + work.width - winW));
  y = Math.max(work.y, Math.min(y, work.y + work.height - winH));

  settingsWindow.setPosition(Math.round(x), Math.round(y), false);
}

function toggleSettingsWindow() {
  if (!settingsWindow) return;
  if (settingsWindow.isVisible()) {
    settingsWindow.hide();
    return;
  }
  positionSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

function createTray() {
  const iconPath = path.join(__dirname, 'img', 'normal.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  tray.setToolTip('DesktopPet');

  tray.on('click', () => {
    toggleSettingsWindow();
  });

  tray.on('right-click', () => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Open Settings',
        click: () => {
          if (!settingsWindow) return;
          if (settingsWindow.isVisible()) return;
          positionSettingsWindow();
          settingsWindow.show();
          settingsWindow.focus();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Application',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.popUpContextMenu(menu);
  });
}

app.whenReady().then(() => {
  settingsStore.load();

  createMainWindow();
  createSettingsWindow();
  createTray();

  registerIpcHandlers(mainWindow, {
    petWidth: PET_WIDTH,
    petHeight: PET_HEIGHT,
    bubbleHeight: BUBBLE_HEIGHT,
    petHPadding: PET_H_PADDING,
    winWidth: WIN_WIDTH,
    winHeight: WIN_HEIGHT
  });

  registerSettingsHandlers({
    getMainWindow: () => mainWindow,
    getSettingsWindow: () => settingsWindow
  });

  if (!settingsStore.getState().petVisible) {
    mainWindow.hide();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
