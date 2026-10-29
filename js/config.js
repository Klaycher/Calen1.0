// ============================================================================
// МОДУЛЬ 1: КОНФИГУРАЦИЯ, ГЛОБАЛЬНОЕ СОСТОЯНИЕ И УТИЛИТЫ (js/config.js)
// ============================================================================
const APP_VERSION = '0.8';

const STORAGE_KEY_CLASSES        = 'raspisanie_1b_classes_v2';
const STORAGE_KEY_EXAMS          = 'raspisanie_1b_exams_v2';
const STORAGE_KEY_SHIFTS         = 'raspisanie_1b_shifts_v2';
const STORAGE_KEY_NOTES          = 'raspisanie_1b_notes_v2';
const STORAGE_KEY_STAMP          = 'raspisanie_1b_updated_stamp';
const STORAGE_KEY_API            = 'raspisanie_1b_gemini_key';
const STORAGE_KEY_ADMIN_SESSION  = 'raspisanie_1b_admin_active_v06';
const STORAGE_KEY_GH_CONFIG      = 'raspisanie_1b_github_config_v06';
const STORAGE_KEY_CHANGELOG      = 'raspisanie_1b_changelog_v1';
const STORAGE_KEY_APP_RELEASES   = 'raspisanie_1b_app_releases_v3';
const STORAGE_KEY_TEACHER_NOTES  = 'raspisanie_1b_teacher_notes_v1';
const STORAGE_KEY_TEACHER_PHOTOS = 'raspisanie_1b_teacher_photos_v2';
const STORAGE_KEY_BSU_LAST_HASH  = 'raspisanie_1b_bsu_last_hash_v1';

const ADMIN_PASSWORD_CODE = '4778';
const BSU_SCHEDULE_PAGE_URL = 'https://law.bsu.by/student/rasklad-zanyatkau/pervoe-vysshee-i-parallelnoe-obrazovanie.html';

const SESSION_DATES = [
  '2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01',
  '2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08',
  '2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15'
];

const DAYS_FULL  = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const DAYS_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

// Все данные расписания хранятся исключительно в файле schedule.json на GitHub (в коде нет бэкапа расписания)
const DEFAULT_WORK_SHIFTS_24H = [];
const DEFAULT_PERSONAL_NOTES  = {};
const DEFAULT_EXAMS           = [];
const DEFAULT_CLASSES         = {};
let BSU_TEACHERS_DB           = [];
let DEFAULT_APP_RELEASES      = [];

function loadParsedStorage(key, fallbackObj) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw);
  } catch (e) {}
  return JSON.parse(JSON.stringify(fallbackObj));
}

function normSubj(s) {
  return String(s || '').toLowerCase().replace(/\((зач|экз|лек|прак|сем)\)/gi, '').replace(/[^a-zа-яё0-9]/gi, '');
}

function subjectsMatch(a, b) {
  const na = normSubj(a);
  const nb = normSubj(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const keys = [
    'хозяйствен', 'семейн', 'финансов', 'коммуникац', 'избирательн',
    'государственнаяслуж', 'госслуж', 'теорияполит', 'этнополит',
    'уголовноеправ', 'цифровойтрансф', 'социальногообесп',
    'земельное', 'аграрн', 'уголовныйпроцесс', 'геополитич', 'глобалист'
  ];
  for (const k of keys) {
    if (na.includes(k) && nb.includes(k)) return true;
  }
  return false;
}

function cleanRoomString(r) {
  if (r === null || r === undefined) return 'уточняется';
  const cleaned = String(r)
    .replace(/^(каб\.?|ауд\.?|кабинет|аудитория|room)\s*/i, '')
    .replace(/\s*(каб\.?|ауд\.?)$/i, '')
    .trim();
  if (!cleaned || cleaned === '?' || cleaned === '-' || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'undefined') {
    return 'уточняется';
  }
  return cleaned;
}

function isValidRoomValue(r) {
  const c = cleanRoomString(r).toLowerCase();
  return c.length > 0 && c !== 'уточняется' && c !== '?' && c !== 'нет' && c !== '-';
}

function normalizeTimeToken(t) {
  if (!t) return '';
  const m = String(t).trim().replace('.', ':').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  return String(m[1]).padStart(2, '0') + ':' + m[2];
}

function sanitizeClassesData(classesObj) {
  if (!classesObj || typeof classesObj !== 'object') return {};
  for (const d in classesObj) {
    if (Array.isArray(classesObj[d])) {
      classesObj[d].forEach(c => {
        if (!c) return;
        c.start = normalizeTimeToken(c.start || c.time) || '14:10';
        c.end = normalizeTimeToken(c.end) || '';
        if (c.start === '14:10' && (c.end === '15:50' || !c.end)) c.end = '15:30';
        if (c.start === '15:50' && (c.end === '17:20' || !c.end)) c.end = '17:10';
        if (c.start === '17:20' && !c.end) c.end = '18:40';
        if (c.start === '18:50' && !c.end) c.end = '20:10';
        c.room = cleanRoomString(c.room);
      });
    }
  }
  return classesObj;
}

let CLASSES             = {};
let EXAMS               = [];
let WORK_SHIFTS_24H     = loadParsedStorage(STORAGE_KEY_SHIFTS, DEFAULT_WORK_SHIFTS_24H);
let PERSONAL_NOTES      = loadParsedStorage(STORAGE_KEY_NOTES, DEFAULT_PERSONAL_NOTES);
let CALENDAR_CHANGELOG  = loadParsedStorage(STORAGE_KEY_CHANGELOG, []);
let APP_RELEASES_LOG    = [];
let TEACHER_USER_NOTES  = loadParsedStorage(STORAGE_KEY_TEACHER_NOTES, {});
let TEACHER_USER_PHOTOS = loadParsedStorage(STORAGE_KEY_TEACHER_PHOTOS, {});

let simDateObj = null;
let selectedIso = '2026-10-26';
let plainReportForCopy = '';
let pushEnabled = false;
let firedNotifications = new Set();
let currentEventTab = 'class';
let editingState = null;
let activeChangelogTab = 'schedule';
let activeTeacherFilter = 'all';
let pendingScheduleUpdate = null;

let isAdminMode = false;
try {
  isAdminMode = sessionStorage.getItem(STORAGE_KEY_ADMIN_SESSION) === '1' ||
                localStorage.getItem(STORAGE_KEY_ADMIN_SESSION) === '1';
} catch (e) {}

let GITHUB_CONFIG = loadParsedStorage(STORAGE_KEY_GH_CONFIG, {
  repo: '',
  branch: 'main',
  path: 'data/schedule.json',
  token: ''
});

function formatExamNoteForView(noteStr) {
  if (isAdminMode) return noteStr || '';
  if (!noteStr) return '';
  if (noteStr.includes('смен') || noteStr.includes('КОНКУРС')) {
    return 'По расписанию экзаменационной сессии группы 1Б';
  }
  return noteStr;
}

function saveAllToStorage(label = 'Изменено') {
  try {
    localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(CLASSES));
    localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(EXAMS));
    localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(WORK_SHIFTS_24H));
    localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(PERSONAL_NOTES));
    const stamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem(STORAGE_KEY_STAMP, `${label} ${stamp}`);
  } catch (e) {}
  updateStorageBadge();
  if (GITHUB_CONFIG && GITHUB_CONFIG.repo && GITHUB_CONFIG.token) {
    pushScheduleToGithub(label, false);
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toastNotification');
  toast.textContent = message;
  toast.className = `fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-semibold transition-all duration-200 max-w-[92vw] text-center ${
    isError
      ? 'bg-rose-950/95 text-rose-200 border-rose-500/50'
      : 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50'
  }`;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2800);
}

function parseIsoLocal(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toRuShortDate(isoStr) {
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}.${y}`;
}

function timeToMin(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function formatMinDiff(mins) {
  if (mins <= 0) return 'меньше минуты';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} ч ${m} мин`;
  if (h > 0) return `${h} ч`;
  return `${m} мин`;
}

function getMinskNow() {
  if (simDateObj) return new Date(simDateObj.getTime());
  const now = new Date();
  const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utcMs + 3 * 3600000);
}

function getShiftStatus(isoStr) {
  const idx = SESSION_DATES.indexOf(isoStr);
  const prevIso = idx > 0 ? SESSION_DATES[idx - 1] : null;
  return {
    startsAt9: WORK_SHIFTS_24H.includes(isoStr),
    endsAt9: prevIso ? WORK_SHIFTS_24H.includes(prevIso) : false
  };
}


function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function encodeUtf8Base64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeUtf8Base64(b64) {
  const binary = atob((b64 || '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function copyTextFallback(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (e) {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  }
}

function updateStorageBadge() {
  const stamp = localStorage.getItem(STORAGE_KEY_STAMP);
  const badge = document.getElementById('storageStatusBadge');
  if (!badge) return;
  if (stamp) {
    badge.textContent = stamp;
  } else if (Object.keys(CLASSES).length > 0) {
    badge.textContent = 'data/schedule.json';
  } else {
    badge.textContent = 'Загрузка...';
  }
}

// Загрузка внешних JSON-файлов (data/teachers.json, data/releases.json, data/schedule.json)
async function fetchRepoJsonFile(relPath) {
  try {
    const url = new URL(relPath, window.location.href);
    url.searchParams.set('t', String(Date.now()));
    const resp = await fetch(url.href, { cache: 'no-store' });
    if (resp.ok) return await resp.json();
  } catch (e) {}
  return null;
}

async function loadModularDataFiles() {
  const inlineFallback = window.__INLINE_MODULAR_DATA__ || null;

  // 1. Загружаем справочник преподавателей (data/teachers.json)
  const loadedTeachers = inlineFallback ? null : await fetchRepoJsonFile('data/teachers.json');
  if (Array.isArray(loadedTeachers) && loadedTeachers.length > 0) {
    BSU_TEACHERS_DB = loadedTeachers;
  } else if (inlineFallback && Array.isArray(inlineFallback.teachers)) {
    BSU_TEACHERS_DB = JSON.parse(JSON.stringify(inlineFallback.teachers));
  }

  // 2. Загружаем историю релизов (data/releases.json)
  const loadedReleases = inlineFallback ? null : await fetchRepoJsonFile('data/releases.json');
  if (Array.isArray(loadedReleases) && loadedReleases.length > 0) {
    DEFAULT_APP_RELEASES = loadedReleases;
  } else if (inlineFallback && Array.isArray(inlineFallback.releases)) {
    DEFAULT_APP_RELEASES = JSON.parse(JSON.stringify(inlineFallback.releases));
  }
  const savedReleases = loadParsedStorage(STORAGE_KEY_APP_RELEASES, DEFAULT_APP_RELEASES);
  const customOta = Array.isArray(savedReleases) ? savedReleases.filter(r => r && !String(r.id || '').startsWith('rel_0')) : [];
  APP_RELEASES_LOG = [...customOta, ...DEFAULT_APP_RELEASES];

  // 3. Загружаем расписание исключительно из файла schedule.json на GitHub (или кэша после синхронизации)
  CLASSES         = sanitizeClassesData(loadParsedStorage(STORAGE_KEY_CLASSES, DEFAULT_CLASSES));
  EXAMS           = loadParsedStorage(STORAGE_KEY_EXAMS, DEFAULT_EXAMS);
  WORK_SHIFTS_24H = loadParsedStorage(STORAGE_KEY_SHIFTS, DEFAULT_WORK_SHIFTS_24H);
  PERSONAL_NOTES  = loadParsedStorage(STORAGE_KEY_NOTES, DEFAULT_PERSONAL_NOTES);

  for (const candidatePath of ['data/schedule.json', 'schedule.json']) {
    const schedData = await fetchRepoJsonFile(candidatePath);
    if (schedData && typeof schedData === 'object') {
      if (schedData.classes && typeof schedData.classes === 'object') {
        CLASSES = sanitizeClassesData(schedData.classes);
      }
      if (Array.isArray(schedData.exams)) {
        EXAMS = schedData.exams;
      }
      if (Array.isArray(schedData.shifts)) {
        WORK_SHIFTS_24H = schedData.shifts;
      }
      if (schedData.notes && typeof schedData.notes === 'object') {
        PERSONAL_NOTES = schedData.notes;
      }
      break;
    }
  }
}
