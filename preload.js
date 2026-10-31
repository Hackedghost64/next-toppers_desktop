const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nextToppers', {
  // App & Session
  getAppSettings: () => ipcRenderer.invoke('api:get-settings'),
  getSession: () => ipcRenderer.invoke('api:get-session'),
  logout: () => ipcRenderer.invoke('api:logout'),

  // Authentication
  sendOtp: (mobile) => ipcRenderer.invoke('api:send-otp', mobile),
  verifyOtp: (mobile, otp) => ipcRenderer.invoke('api:verify-otp', { mobile, otp }),

  // Courses
  getMyCourses: (page, limit) => ipcRenderer.invoke('api:get-my-courses', { page, limit }),
  getAllCourses: (page, limit) => ipcRenderer.invoke('api:get-all-courses', { page, limit }),
  getCourseDetails: (courseId) => ipcRenderer.invoke('api:get-course-details', courseId),
  getCourseClasses: (courseId) => ipcRenderer.invoke('api:get-course-classes', courseId),
  getAllContent: (courseId, folderId, page, limit) => ipcRenderer.invoke('api:get-all-content', { courseId, folderId, page, limit }),
  getContentDetails: (contentId) => ipcRenderer.invoke('api:get-content-details', contentId),
  getContentResources: (contentId) => ipcRenderer.invoke('api:get-content-resources', contentId),
  getVideoDetailsDrm: (token) => ipcRenderer.invoke('api:get-video-details-drm', token),

  // Video Streaming & Heartbeat
  getProxyStreamUrl: (fileUrl, token) => ipcRenderer.invoke('api:get-proxy-stream-url', { fileUrl, token }),
  sendHeartbeat: (courseId, videoId, positionSec, durationSec) => ipcRenderer.invoke('api:send-heartbeat', { courseId, videoId, positionSec, durationSec }),
  updateWatchTime: (courseId, videoId, watchedSeconds) => ipcRenderer.invoke('api:update-watch-time', { courseId, videoId, watchedSeconds }),

  // Home & Explore
  getHomeContent: () => ipcRenderer.invoke('api:get-home-content'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  openExternalUrl: (url) => ipcRenderer.invoke('app:open-external-url', url)
});
