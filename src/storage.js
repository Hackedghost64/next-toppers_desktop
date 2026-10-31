const fs = require('fs');
const path = require('path');
const os = require('os');

class StorageManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.config', 'next-toppers');
    this.sessionFile = path.join(this.configDir, 'session.json');
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }
    } catch (e) {
      console.error('[StorageManager] Error creating config dir:', e);
    }
  }

  getSession() {
    try {
      if (fs.existsSync(this.sessionFile)) {
        const raw = fs.readFileSync(this.sessionFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('[StorageManager] Error reading session:', e);
    }
    return null;
  }

  saveSession(sessionData) {
    try {
      this.ensureConfigDir();
      fs.writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[StorageManager] Error saving session:', e);
      return false;
    }
  }

  clearSession() {
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
      }
      return true;
    } catch (e) {
      console.error('[StorageManager] Error clearing session:', e);
      return false;
    }
  }

  getDeviceId() {
    try {
      const deviceFile = path.join(this.configDir, 'device_id.txt');
      if (fs.existsSync(deviceFile)) {
        return fs.readFileSync(deviceFile, 'utf8').trim();
      }
      this.ensureConfigDir();
      const crypto = require('crypto');
      const newId = 'nt_desktop_' + crypto.randomBytes(8).toString('hex');
      fs.writeFileSync(deviceFile, newId, 'utf8');
      return newId;
    } catch (e) {
      return 'nt_desktop_linux_001';
    }
  }
}

module.exports = new StorageManager();
