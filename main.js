const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const NextToppersApi = require('./src/api');
const VideoStreamProxy = require('./src/proxy');
const storage = require('./src/storage');

// Linux graphics compatibility switches
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-sandbox');
}

let mainWindow = null;
let api = null;
let proxy = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'assets', 'icons', 'ic_launcher.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow local stream proxy and media resource loading
    },
    autoHideMenuBar: true,
    title: 'Next Toppers'
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function init() {
  const deviceId = storage.getDeviceId();
  api = new NextToppersApi({ deviceId });
  proxy = new VideoStreamProxy(0);
  await proxy.start();

  // Load existing session if present
  const savedSession = storage.getSession();
  if (savedSession && savedSession.accessToken) {
    console.log('[Main] Restored existing session for user:', savedSession.name || savedSession.mobile);
    api.setSession(savedSession);
  }

  setupIpcHandlers();
  await createWindow();
}

function setupIpcHandlers() {
  // App Settings
  ipcMain.handle('api:get-settings', async () => {
    try {
      return await api.getAppSettings();
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // Session
  ipcMain.handle('api:get-session', () => {
    return storage.getSession();
  });

  ipcMain.handle('api:logout', () => {
    storage.clearSession();
    api.setSession(null);
    return { success: true };
  });

  // OTP Login
  ipcMain.handle('api:send-otp', async (event, mobile) => {
    try {
      return await api.sendOtp(mobile);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:verify-otp', async (event, { mobile, otp }) => {
    try {
      const res = await api.verifyOtp(mobile, otp);
      if (res && res.success && res.data) {
        storage.saveSession(res.data);
      }
      return res;
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // Courses
  ipcMain.handle('api:get-my-courses', async (event, { page, limit }) => {
    try {
      return await api.getMyCourses(page, limit);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-all-courses', async (event, { page, limit }) => {
    try {
      return await api.getAllCourses(page, limit);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-course-details', async (event, courseId) => {
    try {
      return await api.getCourseDetails(courseId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-course-classes', async (event, courseId) => {
    try {
      return await api.getCourseClasses(courseId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-all-content', async (event, { courseId, folderId, page, limit }) => {
    try {
      return await api.getAllContent(courseId, folderId, page, limit);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-content-details', async (event, contentId) => {
    try {
      return await api.getContentDetails(contentId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-content-resources', async (event, contentId) => {
    try {
      return await api.getContentResources(contentId);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-video-details-drm', async (event, token) => {
    try {
      return await api.getVideoDetailsDrm(token);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // Streaming & Decryption
  ipcMain.handle('api:get-proxy-stream-url', (event, { fileUrl, token }) => {
    if (!fileUrl) return null;
    if (fileUrl.includes('.m3u8')) {
      return proxy.getUrlForManifest(fileUrl, token);
    }
    // Return direct link or proxied stream
    return fileUrl;
  });

  ipcMain.handle('api:send-heartbeat', async (event, { courseId, videoId, positionSec, durationSec }) => {
    try {
      return await api.sendVodHeartbeat(courseId, videoId, positionSec, durationSec);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:update-watch-time', async (event, { courseId, videoId, watchedSeconds }) => {
    try {
      return await api.updateWatchTime(courseId, videoId, watchedSeconds);
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('api:get-home-content', async () => {
    try {
      return await api.getHomeContent();
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  // Window Controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });
  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });
  ipcMain.handle('app:open-external-url', (event, url) => {
    shell.openExternal(url);
  });
}

app.whenReady().then(init);

app.on('window-all-closed', () => {
  if (proxy) proxy.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
