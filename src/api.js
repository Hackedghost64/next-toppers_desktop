const https = require('https');
const http = require('http');
const { URL } = require('url');
const dns = require('dns');

// Linux IPv4 priority to prevent ETIMEDOUT on dual-stack hosts
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

class NextToppersApi {
  constructor(options = {}) {
    this.appId = '1770981347';
    this.version = 105;
    this.platform = '1'; // 1 = Android mobile client
    this.userId = options.userId || '0';
    this.accessToken = options.accessToken || null;
    this.userData = options.userData || null;
    this.deviceId = options.deviceId || 'nt_desktop_linux_001';

    this.baseAuth = 'https://auth.nexttoppers.com';
    this.baseCourse = 'https://course.nexttoppers.com';
    this.baseHome = 'https://home.nexttoppers.com';
    this.baseVideoCrypt = 'https://api.videocrypt.com';
  }

  setSession(userData) {
    if (!userData) {
      this.userId = '0';
      this.accessToken = null;
      this.userData = null;
      return;
    }
    this.userData = userData;
    this.userId = String(userData.id || userData.user_id || '0');
    this.accessToken = userData.accessToken || userData.token || userData.jwt_token || null;
  }

  getHeaders(customHeaders = {}) {
    const headers = {
      'app_id': this.appId,
      'user_id': this.userId || '0',
      'version': String(this.version),
      'platform': this.platform,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'okhttp/4.12.0',
      ...customHeaders
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  request(urlStr, options = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const headers = this.getHeaders(options.headers || {});
      const method = options.method || 'GET';
      const body = options.body ? JSON.stringify(options.body) : null;

      if (body) {
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: headers,
        timeout: 15000
      };

      const req = client.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            resolve({ raw: data, status: res.statusCode });
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out to ${urlStr}`));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  // 1. App Configuration & Settings
  async getAppSettings() {
    return this.request(`${this.baseAuth}/auth/app-setting`, { method: 'GET' });
  }

  // 2. Authentication: Request OTP (calls /auth/check-user to trigger SMS OTP)
  async sendOtp(mobile) {
    const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
    return this.request(`${this.baseAuth}/auth/check-user`, {
      method: 'POST',
      body: {
        mobile: cleanMobile,
        c_code: '+91',
        mobile_otp_login: 1,
        email_otp_login: 0,
        email_password_login: 0,
        mobile_password_login: 0,
        is_sms: '1'
      }
    });
  }

  // 3. Authentication: Verify OTP & Sign In (calls /auth/login)
  async verifyOtp(mobile, otp) {
    const cleanMobile = mobile.replace(/[^0-9]/g, '').slice(-10);
    const cleanOtp = otp.trim();
    const res = await this.request(`${this.baseAuth}/auth/login`, {
      method: 'POST',
      body: {
        mobile: cleanMobile,
        c_code: '+91',
        otp: cleanOtp,
        is_sms: '1',
        device_id: this.deviceId,
        device_name: 'Linux Desktop',
        device_version: '1.0.0',
        mobile_otp_login: 1
      }
    });

    if (res && res.success && res.data) {
      this.setSession(res.data);
    }
    return res;
  }

  // 4. User Profile
  async getMyProfile() {
    return this.request(`${this.baseAuth}/user/my-profile`, { method: 'GET' });
  }

  // 5. Enrolled Courses (My Courses)
  async getMyCourses(page = 1, limit = 50) {
    return this.request(`${this.baseCourse}/course/mycourses?type=COURSE&page=${page}&limit=${limit}`, {
      method: 'GET'
    });
  }

  // 6. Explore / All Courses Catalog
  async getAllCourses(page = 1, limit = 50) {
    return this.request(`${this.baseCourse}/course/all-course`, {
      method: 'POST',
      body: { page: String(page), limit: String(limit) }
    });
  }

  // 7. Course Details (overview, description, teachers, pricing)
  async getCourseDetails(courseId) {
    return this.request(`${this.baseCourse}/course/course-details`, {
      method: 'POST',
      body: { course_id: String(courseId) }
    });
  }

  // 8. Course Classes / Subjects / Folders
  async getCourseClasses(courseId) {
    return this.request(`${this.baseCourse}/course/classes`, {
      method: 'POST',
      body: { course_id: String(courseId), type: '2', page: '1' }
    });
  }

  // 9. All Content (Lectures, PDFs, DPPs within a course/subject folder)
  async getAllContent(courseId, folderId = '0', page = 1, limit = 100) {
    return this.request(`${this.baseCourse}/course/all-content`, {
      method: 'POST',
      body: {
        parent_course_id: String(courseId),
        course_id: String(courseId),
        folder_id: String(folderId || '0'),
        page: String(page || 1),
        limit: String(limit || 100)
      }
    });
  }

  // 10. Content Details (specific video or material metadata)
  async getContentDetails(contentId) {
    return this.request(`${this.baseCourse}/course/content-details`, {
      method: 'POST',
      body: { content_id: String(contentId) }
    });
  }

  // 11. Content Resources (PDF links, attachments, notes)
  async getContentResources(contentId) {
    return this.request(`${this.baseCourse}/course/content-resources`, {
      method: 'POST',
      body: { content_id: String(contentId) }
    });
  }

  // 12. VideoCrypt DRM Token & Manifest Fetch
  async getVideoDetailsDrm(token) {
    return this.request(`${this.baseVideoCrypt}/getVideoDetailsDrm`, {
      method: 'POST',
      body: { token: token }
    });
  }

  // 13. Watch Progress Heartbeat (Anti-tamper & watch time tracking)
  async sendVodHeartbeat(courseId, videoId, positionSec, durationSec) {
    return this.request(`${this.baseCourse}/v1/watch/vod/heartbeat`, {
      method: 'POST',
      body: {
        course_id: String(courseId),
        video_id: String(videoId),
        positionSec: String(Math.floor(positionSec)),
        durationSec: String(Math.floor(durationSec))
      }
    });
  }

  // 14. Update Watch Time
  async updateWatchTime(courseId, videoId, watchedSeconds) {
    return this.request(`${this.baseCourse}/course/update-watch-time`, {
      method: 'POST',
      body: {
        course_id: String(courseId),
        video_id: String(videoId),
        last_watched_seconds: String(Math.floor(watchedSeconds))
      }
    });
  }

  // 15. Home Feeds / Featured Content
  async getHomeContent() {
    return this.request(`${this.baseHome}/home/content`, {
      method: 'POST',
      body: {}
    });
  }
}

module.exports = NextToppersApi;
