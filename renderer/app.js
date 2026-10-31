// Next Toppers Desktop Client Engine
let currentUser = null;
let currentCourse = null;
let currentContent = null;
let hlsInstance = null;
let heartbeatTimer = null;
let watermarkTimer = null;
let cachedAllCourses = [];
let cachedMyCourses = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupAuth();
  setupPlayerControls();
  setupKeyboardShortcuts();

  // Load existing session
  const session = await window.nextToppers.getSession();
  if (session && session.accessToken) {
    onLoginSuccess(session);
  } else {
    updateAuthUI(null);
    switchView('view-login');
  }

  // Load App Settings
  try {
    const settings = await window.nextToppers.getAppSettings();
    if (settings && settings.data && settings.data.appSettings) {
      console.log('[App] Loaded Next Toppers settings:', settings.data.appSettings.app_name);
    }
  } catch (e) {
    console.warn('[App] Could not fetch settings:', e);
  }
});

// Navigation & View Switching
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view');
      switchView(targetView);
    });
  });

  document.getElementById('nav-brand').addEventListener('click', () => {
    if (currentUser) {
      switchView('view-my-courses');
    } else {
      switchView('view-all-courses');
    }
  });

  document.getElementById('btn-show-login').addEventListener('click', () => {
    switchView('view-login');
  });

  document.getElementById('btn-explore-as-guest').addEventListener('click', () => {
    switchView('view-all-courses');
  });

  document.getElementById('btn-back-to-courses').addEventListener('click', () => {
    if (currentUser) {
      switchView('view-my-courses');
    } else {
      switchView('view-all-courses');
    }
  });

  document.getElementById('btn-player-back').addEventListener('click', () => {
    closePlayer();
  });

  document.getElementById('btn-pdf-back').addEventListener('click', () => {
    if (currentCourse) {
      switchView('view-course-detail');
    } else {
      switchView('view-my-courses');
    }
  });

  document.getElementById('btn-refresh-my-courses').addEventListener('click', () => {
    loadMyCourses();
  });

  document.getElementById('btn-toggle-notes-panel').addEventListener('click', () => {
    const panel = document.getElementById('player-side-notes');
    panel.classList.toggle('hidden');
  });

  document.getElementById('btn-close-side-notes').addEventListener('click', () => {
    document.getElementById('player-side-notes').classList.add('hidden');
  });
}

function switchView(viewId) {
  const views = [
    'view-my-courses',
    'view-all-courses',
    'view-free-content',
    'view-course-detail',
    'view-player',
    'view-pdf-viewer',
    'view-pdf-library',
    'view-login'
  ];

  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === viewId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Update active sidebar nav button
  document.querySelectorAll('.nav-btn').forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Action on view
  if (viewId === 'view-my-courses') {
    if (!currentUser) {
      document.getElementById('my-courses-grid').innerHTML = '';
      document.getElementById('my-courses-empty').classList.remove('hidden');
    } else {
      loadMyCourses();
    }
  } else if (viewId === 'view-all-courses') {
    loadAllCourses();
  } else if (viewId === 'view-free-content') {
    loadFreeContent();
  }
}

// Authentication Logic
function setupAuth() {
  const btnRequestOtp = document.getElementById('btn-request-otp');
  const btnVerifyOtp = document.getElementById('btn-verify-otp');
  const btnChangeMobile = document.getElementById('btn-change-mobile');
  const btnResendOtp = document.getElementById('btn-resend-otp');
  const btnLogout = document.getElementById('btn-logout');

  const inputMobile = document.getElementById('input-mobile');
  const inputOtp = document.getElementById('input-otp');

  inputMobile.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnRequestOtp.click();
    }
  });

  inputOtp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnVerifyOtp.click();
    }
  });

  btnRequestOtp.addEventListener('click', async () => {
    const mobile = document.getElementById('input-mobile').value.trim();
    if (!mobile || mobile.length < 10) {
      showToast('Please enter a valid 10-digit mobile number', '⚠️');
      return;
    }

    btnRequestOtp.disabled = true;
    btnRequestOtp.innerText = 'Sending OTP...';

    try {
      const res = await window.nextToppers.sendOtp(mobile);
      if (res && res.success && (res.responseCode === 2003 || res.responseCode === 2000 || res.responseCode === 2001)) {
        showToast(res.message || 'OTP sent successfully to your phone!', '✅');
        document.getElementById('otp-mobile-label').innerText = `+91 ${mobile}`;
        document.getElementById('login-step-phone').classList.add('hidden');
        document.getElementById('login-step-otp').classList.remove('hidden');
        document.getElementById('input-otp').value = '';
        document.getElementById('input-otp').focus();
      } else {
        const errorMsg = (res && res.message && res.message !== 'Default Message') ? res.message : 'Failed to send OTP. Please check your number.';
        showToast(errorMsg, '❌');
      }
    } catch (err) {
      showToast('Connection error: ' + err.message, '❌');
    } finally {
      btnRequestOtp.disabled = false;
      btnRequestOtp.innerText = 'Send OTP';
    }
  });

  btnVerifyOtp.addEventListener('click', async () => {
    const mobile = document.getElementById('input-mobile').value.trim();
    const otp = document.getElementById('input-otp').value.trim();

    if (!otp) {
      showToast('Please enter the OTP received on SMS', '⚠️');
      return;
    }

    btnVerifyOtp.disabled = true;
    btnVerifyOtp.innerText = 'Verifying...';

    try {
      const res = await window.nextToppers.verifyOtp(mobile, otp);
      if (res && res.success && res.data) {
        showToast('Login successful! Welcome back.', '🎉');
        onLoginSuccess(res.data);
      } else {
        const errorMsg = (res && res.message && res.message !== 'Default Message') ? res.message : 'Invalid OTP. Please check and try again.';
        showToast(errorMsg, '❌');
      }
    } catch (err) {
      showToast('Verification error: ' + err.message, '❌');
    } finally {
      btnVerifyOtp.disabled = false;
      btnVerifyOtp.innerText = 'Verify & Continue';
    }
  });

  btnChangeMobile.addEventListener('click', () => {
    document.getElementById('login-step-otp').classList.add('hidden');
    document.getElementById('login-step-phone').classList.remove('hidden');
  });

  btnResendOtp.addEventListener('click', () => {
    btnRequestOtp.click();
  });

  btnLogout.addEventListener('click', async () => {
    await window.nextToppers.logout();
    currentUser = null;
    updateAuthUI(null);
    showToast('Signed out', 'ℹ️');
    switchView('view-all-courses');
  });
}

function onLoginSuccess(userData) {
  currentUser = userData;
  updateAuthUI(userData);
  switchView('view-my-courses');
  loadMyCourses();
}

function updateAuthUI(user) {
  const loggedInDiv = document.getElementById('logged-in-profile');
  const loggedOutDiv = document.getElementById('logged-out-profile');

  if (user) {
    loggedInDiv.classList.remove('hidden');
    loggedOutDiv.classList.add('hidden');
    document.getElementById('user-display-name').innerText = user.name || 'Student';
    document.getElementById('user-display-phone').innerText = user.mobile ? `+91 ${user.mobile}` : '+91 Verified';
    document.getElementById('user-avatar').innerText = (user.name ? user.name[0] : 'S').toUpperCase();

    // Update watermark
    document.getElementById('student-watermark').innerText = `${user.mobile || user.id || 'NEXT TOPPERS'} • Next Toppers`;
  } else {
    loggedInDiv.classList.add('hidden');
    loggedOutDiv.classList.remove('hidden');
  }
}

function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.courses)) return data.courses;
  if (Array.isArray(data.course_list)) return data.course_list;
  if (Array.isArray(data.classes)) return data.classes;
  if (Array.isArray(data.subjects)) return data.subjects;
  if (Array.isArray(data.contents)) return data.contents;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.videos)) return data.videos;
  if (Array.isArray(data.resources)) return data.resources;
  return [];
}

// Course Loading
async function loadMyCourses() {
  const grid = document.getElementById('my-courses-grid');
  const empty = document.getElementById('my-courses-empty');
  grid.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400">Loading your courses...</div>';

  try {
    const res = await window.nextToppers.getMyCourses(1, 50);
    grid.innerHTML = '';

    const list = extractList(res ? res.data : null);
    if (res && res.success && list.length > 0) {
      empty.classList.add('hidden');
      cachedMyCourses = list;
      list.forEach(course => {
        grid.appendChild(createCourseCard(course, true));
      });
    } else {
      empty.classList.remove('hidden');
    }
  } catch (err) {
    grid.innerHTML = `<div class="col-span-3 text-center py-12 text-rose-400">Failed to load courses: ${err.message}</div>`;
  }
}

async function loadAllCourses() {
  const grid = document.getElementById('all-courses-grid');
  grid.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400">Fetching batches catalog...</div>';

  try {
    const res = await window.nextToppers.getAllCourses(1, 50);
    grid.innerHTML = '';

    const list = extractList(res ? res.data : null);
    if (res && res.success && list.length > 0) {
      cachedAllCourses = list;
      list.forEach(course => {
        grid.appendChild(createCourseCard(course, false));
      });
    } else if (res && res.message && res.message.toLowerCase().includes('token')) {
      grid.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400">Please <button class="text-teal-400 underline font-medium hover:text-teal-300" onclick="document.getElementById(\'nav-login\').click()">login with your phone number</button> to view all available batches.</div>';
    } else {
      grid.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400">No batches available at this time.</div>';
    }
  } catch (err) {
    grid.innerHTML = `<div class="col-span-3 text-center py-12 text-rose-400">Failed to load batches: ${err.message}</div>`;
  }
}

async function loadFreeContent() {
  const grid = document.getElementById('free-content-grid');
  grid.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400">Loading demo classes...</div>';

  try {
    const res = await window.nextToppers.getHomeContent();
    grid.innerHTML = '';

    if (res && res.success && res.data) {
      const items = res.data.free_videos || res.data.trending_courses || res.data.banners || [];
      if (items.length > 0) {
        items.forEach(item => {
          grid.appendChild(createCourseCard(item, false));
        });
      } else {
        grid.innerHTML = '<div class="col-span-3 text-center py-12 text-slate-400">Free demo lectures will be updated shortly.</div>';
      }
    }
  } catch (err) {
    grid.innerHTML = `<div class="col-span-3 text-center py-12 text-rose-400">Error: ${err.message}</div>`;
  }
}

function createCourseCard(course, isEnrolled) {
  const card = document.createElement('div');
  card.className = 'course-card';

  const title = course.title || course.item_name || course.course_name || course.name || 'Batch';
  const thumb = course.thumbnail || course.course_image || course.image || '../assets/icons/splash_logo.png';
  let rawDesc = course.description || course.short_description || 'Comprehensive online batch with live lectures, DPPs, and structured tests.';
  const desc = rawDesc ? rawDesc.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim() : 'Comprehensive batch';
  const validity = course.validity || (course.remaining_days ? `${course.remaining_days} Days Remaining` : 'Academic Year');
  const tag = course.tag || (isEnrolled ? 'Enrolled' : (course.course_price ? `₹${course.course_price}` : 'Batch'));

  card.innerHTML = `
    <img src="${thumb}" alt="${title}" class="course-card-thumb" onerror="this.src='../assets/icons/splash_logo.png'">
    <div class="course-card-body">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          ${tag}
        </span>
        <span class="text-xs text-slate-400">${validity}</span>
      </div>
      <h3 class="font-bold text-base text-white line-clamp-2">${title}</h3>
      <p class="text-xs text-slate-400 line-clamp-2">${desc}</p>
      <div class="mt-auto pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span class="text-xs font-semibold text-emerald-400 flex items-center space-x-1">
          <span>${isEnrolled ? 'Open Batch' : 'View Syllabus'}</span>
          <span>→</span>
        </span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    openCourseDetails(course.id || course.item_id || course.course_id, course);
  });

  return card;
}

let folderNavStack = [];

// Course Details & Syllabus
async function openCourseDetails(courseId, courseData) {
  currentCourse = courseData;
  switchView('view-course-detail');

  const title = courseData.title || courseData.item_name || courseData.course_name || 'Batch Details';
  const desc = courseData.description ? courseData.description.replace(/<[^>]*>?/gm, '').trim() : 'Comprehensive syllabus & lectures.';
  const thumb = courseData.thumbnail || courseData.course_image || '../assets/icons/splash_logo.png';
  const validity = courseData.validity || (courseData.remaining_days ? `${courseData.remaining_days} Days Remaining` : 'Academic Year');
  const tag = courseData.tag || 'Enrolled';

  document.getElementById('course-hero-title').innerText = title;
  document.getElementById('course-hero-desc').innerText = desc || 'Comprehensive syllabus & lectures.';
  document.getElementById('course-hero-thumbnail').src = thumb;
  document.getElementById('course-hero-validity').innerText = validity;
  document.getElementById('course-hero-price').innerText = tag;

  folderNavStack = [{ id: '0', title: 'All Subjects' }];
  loadSubjectContent(courseId, '0');
}

async function loadSubjectContent(courseId, folderId) {
  const tabsContainer = document.getElementById('course-subject-tabs');
  const accordion = document.getElementById('course-content-accordion');

  // Render breadcrumb navigation path
  tabsContainer.innerHTML = '';
  folderNavStack.forEach((entry, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'text-slate-600 text-xs px-1 select-none flex items-center';
      sep.innerText = '›';
      tabsContainer.appendChild(sep);
    }
    const btn = document.createElement('button');
    const isCurrent = idx === folderNavStack.length - 1;
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${isCurrent ? 'bg-[#30cfaa]/15 text-[#30cfaa] border border-[#30cfaa]/30' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'}`;
    btn.innerText = entry.title;
    btn.addEventListener('click', () => {
      folderNavStack = folderNavStack.slice(0, idx + 1);
      loadSubjectContent(courseId, entry.id);
    });
    tabsContainer.appendChild(btn);
  });

  accordion.innerHTML = '<div class="text-center py-10 text-slate-400 text-xs flex items-center justify-center space-x-2"><div class="animate-spin w-4 h-4 border-2 border-[#30cfaa] border-t-transparent rounded-full"></div><span>Loading contents...</span></div>';

  try {
    const res = await window.nextToppers.getAllContent(courseId, folderId, 1, 100);
    accordion.innerHTML = '';

    const items = extractList(res ? res.data : null);
    if (items.length > 0) {
      const folders = items.filter(it => it.type === 'folder');
      const files = items.filter(it => it.type === 'file' || it.type !== 'folder');

      if (folders.length > 0) {
        const foldersSection = document.createElement('div');
        foldersSection.className = 'space-y-2 mb-4';
        
        const folderGrid = document.createElement('div');
        folderGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

        folders.forEach(folder => {
          folderGrid.appendChild(createFolderCard(folder, courseId));
        });
        foldersSection.appendChild(folderGrid);
        accordion.appendChild(foldersSection);
      }

      if (files.length > 0) {
        const filesSection = document.createElement('div');
        filesSection.className = 'space-y-2';

        files.forEach(file => {
          filesSection.appendChild(createFileItem(file));
        });
        accordion.appendChild(filesSection);
      }
    } else {
      accordion.innerHTML = '<div class="text-center py-12 text-slate-400 text-xs">No lectures or materials in this folder yet.</div>';
    }
  } catch (err) {
    accordion.innerHTML = `<div class="text-center py-12 text-rose-400 text-xs">Error loading folder: ${err.message}</div>`;
  }
}

function createFolderCard(folder, courseId) {
  const card = document.createElement('div');
  card.className = 'p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#30cfaa]/50 transition cursor-pointer flex items-center justify-between group shadow-sm';

  const data = folder.data || folder;
  const counts = data.content_counts || {};
  const vCount = (counts.video ? (counts.video.paid || 0) + (counts.video.free || 0) : 0) || 0;
  const pCount = (counts.pdf ? (counts.pdf.paid || 0) + (counts.pdf.free || 0) : 0) || 0;
  const fCount = (counts.folders ? (counts.folders.total || 0) : 0) || 0;

  let countStr = [];
  if (vCount > 0) countStr.push(`${vCount} Videos`);
  if (pCount > 0) countStr.push(`${pCount} Notes`);
  if (fCount > 0) countStr.push(`${fCount} Subfolders`);
  if (countStr.length === 0) countStr.push('Folder');

  card.innerHTML = `
    <div class="flex items-center space-x-3 truncate flex-1 min-w-0 pr-2">
      <div class="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-lg shrink-0">
        📁
      </div>
      <div class="truncate flex-1">
        <h4 class="text-xs font-bold text-white group-hover:text-[#30cfaa] transition truncate">${folder.title || data.title}</h4>
        <span class="text-[11px] text-slate-400 block truncate">${countStr.join(' • ')}</span>
      </div>
    </div>
    <div class="text-slate-400 group-hover:text-[#30cfaa] text-xs font-semibold flex items-center space-x-1 shrink-0">
      <span>Open</span>
      <span>→</span>
    </div>
  `;

  card.addEventListener('click', () => {
    const targetFolderId = String(folder.entity_id || data.id || folder.id);
    folderNavStack.push({ id: targetFolderId, title: folder.title || data.title });
    loadSubjectContent(courseId, targetFolderId);
  });

  return card;
}

function createFileItem(item) {
  const div = document.createElement('div');
  div.className = 'content-item p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between';

  const data = item.data || item;
  const isVideo = data.file_type === 2 || (data.file_url && (data.file_url.includes('.m3u8') || data.file_url.includes('.mp4'))) || data.video_type;
  const isPdf = data.file_type === 1 || (data.file_url && data.file_url.includes('.pdf')) || data.pdf_url;
  const title = item.title || data.title || data.name || 'Lesson';
  const duration = data.duration ? formatTime(parseInt(data.duration, 10)) : '';

  let downloadUrls = [];
  try {
    if (data.download_urls && typeof data.download_urls === 'string' && data.download_urls.startsWith('[')) {
      downloadUrls = JSON.parse(data.download_urls);
    } else if (Array.isArray(data.download_urls)) {
      downloadUrls = data.download_urls;
    }
  } catch (e) {}

  div.innerHTML = `
    <div class="flex items-center space-x-3.5 flex-1 min-w-0 pr-3">
      <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isVideo ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'}">
        ${isVideo ? '▶' : '📄'}
      </div>
      <div class="truncate flex-1">
        <h4 class="text-xs font-semibold text-white truncate">${title}</h4>
        <div class="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
          <span>${isVideo ? (duration ? `Video • ${duration}` : 'Video Lecture') : 'PDF Study Notes'}</span>
          ${data.tag ? `<span class="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 font-medium">${data.tag}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="flex items-center space-x-2 shrink-0">
      <button class="btn-primary-action px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${isVideo ? 'bg-[#30cfaa] hover:bg-[#26b694] text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}">
        ${isVideo ? 'Watch Now' : 'View PDF'}
      </button>
      ${(downloadUrls.length > 0 || (isPdf && data.file_url)) ? `
        <button class="btn-download-action px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer" title="Download to PC">
          ⬇
        </button>
      ` : ''}
    </div>
  `;

  const btnPrimary = div.querySelector('.btn-primary-action');
  btnPrimary.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isVideo) {
      startVideoPlayback(item);
    } else {
      openPdfDocument(item);
    }
  });

  const btnDl = div.querySelector('.btn-download-action');
  if (btnDl) {
    btnDl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (downloadUrls.length > 0) {
        const best = downloadUrls[downloadUrls.length - 1];
        if (best && best.url) {
          window.nextToppers.openExternalUrl(best.url);
          showToast(`Opening download for ${best.title || 'video'}...`, '⬇️');
        }
      } else if (isPdf && data.file_url) {
        window.nextToppers.openExternalUrl(data.file_url);
        showToast('Saving PDF to PC...', '📥');
      }
    });
  }

  div.addEventListener('click', () => {
    if (isVideo) {
      startVideoPlayback(item);
    } else {
      openPdfDocument(item);
    }
  });

  return div;
}

// Video Player Engine & Decryption
async function startVideoPlayback(content) {
  currentContent = content;
  switchView('view-player');

  const payload = content.data || content;
  const videoTitle = content.title || payload.title || payload.name || 'Lecture';
  document.getElementById('player-lecture-title').innerText = videoTitle;
  document.getElementById('player-course-name').innerText = currentCourse ? (currentCourse.title || currentCourse.item_name || currentCourse.name || '') : 'Next Toppers';

  const video = document.getElementById('main-video');
  const ytContainer = document.getElementById('youtube-container');

  // Reset existing player
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  video.pause();
  video.src = '';
  video.classList.remove('hidden');
  ytContainer.classList.add('hidden');
  ytContainer.innerHTML = '';

  // Check if content is YouTube embed
  if (payload.video_type === 'youtube' || (payload.file_url && payload.file_url.includes('youtube.com'))) {
    const videoId = extractYouTubeId(payload.file_url);
    if (videoId) {
      video.classList.add('hidden');
      ytContainer.classList.remove('hidden');
      ytContainer.innerHTML = `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      return;
    }
  }

  // Fetch Stream URL & Decryption Token
  let streamUrl = payload.file_url || payload.video_url || payload.url || '';
  let drmToken = payload.token || content.token || '';
  let vdcId = payload.vdc_id || content.vdc_id || '';

  // If streamUrl is missing or has token/vdc_id, resolve from DRM details or content-details
  if ((!streamUrl || drmToken) && (drmToken || vdcId)) {
    try {
      const drmRes = await window.nextToppers.getVideoDetailsDrm(drmToken || vdcId);
      if (drmRes && drmRes.data && drmRes.data.link) {
        streamUrl = drmRes.data.link.file_url || streamUrl;
        if (drmRes.data.link.token) {
          drmToken = drmRes.data.link.token;
        }
      }
    } catch (e) {
      console.warn('[Player] DRM token lookup warning:', e);
    }
  }

  // If still no streamUrl, query content-details endpoint
  if (!streamUrl && (payload.id || payload.content_id || content.id)) {
    try {
      const detailsRes = await window.nextToppers.getContentDetails(payload.id || payload.content_id || content.id);
      if (detailsRes && detailsRes.data) {
        const d = detailsRes.data;
        content = { ...content, ...d };
        streamUrl = d.file_url || d.video_url || d.url || streamUrl;
        drmToken = d.token || drmToken;
        if ((!streamUrl || d.token) && (d.token || d.vdc_id)) {
          const drmRes = await window.nextToppers.getVideoDetailsDrm(d.token || d.vdc_id);
          if (drmRes && drmRes.data && drmRes.data.link) {
            streamUrl = drmRes.data.link.file_url || streamUrl;
            if (drmRes.data.link.token) drmToken = drmRes.data.link.token;
          }
        }
      }
    } catch (e) {
      console.warn('[Player] getContentDetails warning:', e);
    }
  }

  // Get stream through local decryptor proxy
  let playUrl = streamUrl;
  if (streamUrl && streamUrl.includes('.m3u8')) {
    playUrl = await window.nextToppers.getProxyStreamUrl(streamUrl, drmToken);
  }

  console.log('[Player] Playing stream via:', playUrl);

  if (Hls.isSupported() && playUrl && playUrl.includes('.m3u8')) {
    hlsInstance = new Hls({
      enableWorker: true,
      lowLatencyMode: true
    });

    hlsInstance.loadSource(playUrl);
    hlsInstance.attachMedia(video);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      // Populate quality levels
      const qualitySelect = document.getElementById('select-quality');
      qualitySelect.innerHTML = '<option value="-1">Auto (Best)</option>';
      data.levels.forEach((level, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.innerText = `${level.height}p`;
        qualitySelect.appendChild(opt);
      });

      video.play().catch(e => console.log('Autoplay deferred:', e));
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      console.warn('[HLS Error]:', data);
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError();
            break;
          default:
            hlsInstance.destroy();
            break;
        }
      }
    });
  } else if (playUrl) {
    video.src = playUrl;
    video.play().catch(e => console.log('Autoplay deferred:', e));
  }

  // Start Watermark Float
  startWatermarkFloat();

  // Start Heartbeat & Watch Progress Sync
  startHeartbeatTimer();

  // Load accompanying notes
  loadPlayerAccompanyingNotes(content);
}

function closePlayer() {
  const video = document.getElementById('main-video');
  video.pause();

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (watermarkTimer) {
    clearInterval(watermarkTimer);
    watermarkTimer = null;
  }

  if (currentCourse) {
    switchView('view-course-detail');
  } else {
    switchView('view-my-courses');
  }
}

function setupPlayerControls() {
  const video = document.getElementById('main-video');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const timelineBar = document.getElementById('timeline-bar');
  const timelineProgress = document.getElementById('timeline-progress');
  const timelineBuffer = document.getElementById('timeline-buffer');
  const timeCurrent = document.getElementById('time-current');
  const timeDuration = document.getElementById('time-duration');
  const volumeSlider = document.getElementById('volume-slider');
  const btnMute = document.getElementById('btn-mute');
  const selectSpeed = document.getElementById('select-speed');
  const selectQuality = document.getElementById('select-quality');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnRewind = document.getElementById('btn-rewind');
  const btnForward = document.getElementById('btn-forward');

  function togglePlay() {
    if (video.paused || video.ended) {
      video.play();
    } else {
      video.pause();
    }
  }

  btnPlayPause.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);

  video.addEventListener('play', () => {
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
  });

  video.addEventListener('pause', () => {
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
  });

  video.addEventListener('timeupdate', () => {
    if (video.duration) {
      const progress = (video.currentTime / video.duration) * 100;
      timelineProgress.style.width = `${progress}%`;
      timeCurrent.innerText = formatTime(video.currentTime);
      timeDuration.innerText = formatTime(video.duration);
    }
  });

  video.addEventListener('progress', () => {
    if (video.buffered.length > 0 && video.duration) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const bufferProgress = (bufferedEnd / video.duration) * 100;
      timelineBuffer.style.width = `${bufferProgress}%`;
    }
  });

  timelineBar.addEventListener('click', (e) => {
    const rect = timelineBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (video.duration) {
      video.currentTime = pos * video.duration;
    }
  });

  btnRewind.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
  });

  btnForward.addEventListener('click', () => {
    if (video.duration) {
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
    }
  });

  volumeSlider.addEventListener('input', (e) => {
    video.volume = parseFloat(e.target.value);
    video.muted = false;
  });

  btnMute.addEventListener('click', () => {
    video.muted = !video.muted;
  });

  selectSpeed.addEventListener('change', (e) => {
    video.playbackRate = parseFloat(e.target.value);
  });

  selectQuality.addEventListener('change', (e) => {
    if (hlsInstance) {
      hlsInstance.currentLevel = parseInt(e.target.value, 10);
    }
  });

  btnFullscreen.addEventListener('click', () => {
    const wrapper = document.getElementById('video-wrapper');
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen().catch(err => console.log(err));
    }
  });
}

function startWatermarkFloat() {
  if (watermarkTimer) clearInterval(watermarkTimer);
  const wm = document.getElementById('student-watermark');
  const wrapper = document.getElementById('video-wrapper');

  function move() {
    if (!wrapper || !wm) return;
    const maxTop = wrapper.clientHeight - 60;
    const maxLeft = wrapper.clientWidth - 200;
    const randTop = Math.max(20, Math.floor(Math.random() * maxTop));
    const randLeft = Math.max(20, Math.floor(Math.random() * maxLeft));
    wm.style.top = `${randTop}px`;
    wm.style.left = `${randLeft}px`;
  }

  move();
  watermarkTimer = setInterval(move, 6000);
}

function startHeartbeatTimer() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    const video = document.getElementById('main-video');
    if (video && !video.paused && currentContent && currentCourse) {
      try {
        await window.nextToppers.sendHeartbeat(
          currentCourse.id || currentCourse.course_id,
          currentContent.id || currentContent.video_id,
          video.currentTime,
          video.duration || 0
        );
      } catch (e) {
        // quiet error
      }
    }
  }, 30000); // sync every 30s
}

async function loadPlayerAccompanyingNotes(content) {
  const list = document.getElementById('player-notes-list');
  list.innerHTML = '<span class="text-xs text-slate-500">Checking for notes...</span>';

  try {
    const res = await window.nextToppers.getContentResources(content.id || content.content_id);
    list.innerHTML = '';
    const noteItems = extractList(res ? res.data : null);
    if (res && res.success && noteItems.length > 0) {
      noteItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-3 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition';
        itemDiv.innerHTML = `
          <div class="truncate flex-1 pr-2">
            <div class="text-xs font-semibold text-white truncate">${item.title || 'Attached Notes'}</div>
            <div class="text-[10px] text-slate-400">PDF Document</div>
          </div>
          <span class="text-xs font-bold text-emerald-400">Open</span>
        `;
        itemDiv.addEventListener('click', () => {
          openPdfDocument(item);
        });
        list.appendChild(itemDiv);
      });
    } else {
      list.innerHTML = '<span class="text-xs text-slate-500">No notes attached to this lecture.</span>';
    }
  } catch (err) {
    list.innerHTML = '<span class="text-xs text-slate-500">No notes available.</span>';
  }
}

// PDF Document Viewer
async function openPdfDocument(item) {
  switchView('view-pdf-viewer');
  const payload = item.data || item;
  const title = item.title || payload.title || payload.name || 'Lecture Notes';
  let pdfUrl = payload.file_url || payload.pdf_url || payload.url || '';

  document.getElementById('pdf-viewer-title').innerText = title;

  if (!pdfUrl && (payload.id || payload.content_id || item.id)) {
    try {
      const res = await window.nextToppers.getContentDetails(payload.id || payload.content_id || item.id);
      if (res && res.data) {
        pdfUrl = res.data.file_url || res.data.pdf_url || res.data.url || '';
      }
    } catch (e) {
      console.warn('PDF details fetch failed:', e);
    }
  }

  const iframe = document.getElementById('pdf-iframe');
  iframe.src = pdfUrl || 'about:blank';

  const btnDownload = document.getElementById('btn-pdf-download');
  btnDownload.onclick = () => {
    if (pdfUrl) {
      window.nextToppers.openExternalUrl(pdfUrl);
    } else {
      showToast('Document link not available', '⚠️');
    }
  };
}

// Helpers
function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n) => String(n).padStart(2, '0');

  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function showToast(text, icon = '✨') {
  const toast = document.getElementById('status-toast');
  const toastText = document.getElementById('status-toast-text');
  const toastIcon = document.getElementById('status-toast-icon');

  toastText.innerText = text;
  toastIcon.innerText = icon;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Never intercept typing in form fields
    if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      return;
    }

    // Only handle if video player is active
    const playerView = document.getElementById('view-player');
    if (playerView && !playerView.classList.contains('hidden')) {
      const video = document.getElementById('main-video');
      if (e.code === 'Space') {
        e.preventDefault();
        if (video.paused) video.play();
        else video.pause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (video.duration) video.currentTime = Math.min(video.duration, video.currentTime + 10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        document.getElementById('btn-fullscreen').click();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        video.muted = !video.muted;
      }
    }
  });
}
