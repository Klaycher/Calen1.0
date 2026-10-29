// ============================================================================
// МОДУЛЬ 5: СИНХРОНИЗАЦИЯ С GITHUB API, ТОЧЕЧНОЕ ОБНОВЛЕНИЕ МОДУЛЕЙ И АВТО-ДЕПЛОЙ (js/github-sync.js)
// ============================================================================
const MODULAR_FILE_MAP = {
  'index.html': 'index.html',
  'style.css': 'css/style.css',
  'schedule.json': 'data/schedule.json',
  'teachers.json': 'data/teachers.json',
  'releases.json': 'data/releases.json',
  'config.js': 'js/config.js',
  'calendar.js': 'js/calendar.js',
  'teachers.js': 'js/teachers.js',
  'admin.js': 'js/admin.js',
  'github-sync.js': 'js/github-sync.js',
  'ai-scanner.js': 'js/ai-scanner.js',
  'bsu-monitor.js': 'js/bsu-monitor.js',
  'app.js': 'js/app.js',
  'README.md': 'README.md'
};

const MODULAR_MANIFEST_INFO = [
  { path: 'index.html',         title: 'Каркас интерфейса и модальных окон', badge: 'HTML • Ядро' },
  { path: 'css/style.css',      title: 'Таблица стилей, сетка и анимации', badge: 'CSS • Стили' },
  { path: 'data/schedule.json', title: 'Живая база расписания пар, экзаменов и смен', badge: 'JSON • База' },
  { path: 'data/teachers.json', title: 'Досье и фото 15 преподавателей Юрфака БГУ', badge: 'JSON • Справочник' },
  { path: 'data/releases.json', title: 'Хронология релизов приложения (v0.1 – v0.8)', badge: 'JSON • Версии' },
  { path: 'js/config.js',       title: 'Константы, состояние, утилиты дат и загрузчик JSON', badge: 'JS • Модуль 1' },
  { path: 'js/calendar.js',     title: 'Сетка 21 дня, сводка дня, шаблон «На данный момент» и пуши', badge: 'JS • Модуль 2' },
  { path: 'js/teachers.js',     title: 'Поиск, фильтры и карточка досье преподавателя', badge: 'JS • Модуль 3' },
  { path: 'js/admin.js',        title: 'Авторизация (4778), CRUD пар/экзаменов и журнал истории', badge: 'JS • Модуль 4' },
  { path: 'js/github-sync.js',  title: 'Синхронизация с GitHub API и обновление отдельных модулей', badge: 'JS • Модуль 5' },
  { path: 'js/ai-scanner.js',   title: 'Gemini API, распознавание фото и умное слияние пар/экзаменов', badge: 'JS • Модуль 6' },
  { path: 'js/bsu-monitor.js',  title: 'Мониторинг сайта law.bsu.by и безопасный демо-режим', badge: 'JS • Модуль 7' },
  { path: 'js/app.js',          title: 'Установка PWA на телефон, таймеры и точка входа', badge: 'JS • Модуль 8' }
];

function populateGithubInputs() {
  const repoEl = document.getElementById('ghRepoInput');
  const branchEl = document.getElementById('ghBranchInput');
  const pathEl = document.getElementById('ghPathInput');
  const tokenEl = document.getElementById('ghTokenInput');
  if (repoEl) repoEl.value = GITHUB_CONFIG.repo || detectGithubPagesRepo() || '';
  if (branchEl) branchEl.value = GITHUB_CONFIG.branch || 'main';
  if (pathEl) pathEl.value = GITHUB_CONFIG.path || 'data/schedule.json';
  if (tokenEl) tokenEl.value = GITHUB_CONFIG.token || '';
}

function saveGithubConfigFromInputs() {
  const repoEl = document.getElementById('ghRepoInput');
  const branchEl = document.getElementById('ghBranchInput');
  const pathEl = document.getElementById('ghPathInput');
  const tokenEl = document.getElementById('ghTokenInput');

  GITHUB_CONFIG = {
    repo: (repoEl ? repoEl.value : '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''),
    branch: (branchEl ? branchEl.value : 'main').trim() || 'main',
    path: (pathEl ? pathEl.value : 'data/schedule.json').trim().replace(/^\/+/, '') || 'data/schedule.json',
    token: (tokenEl ? tokenEl.value : '').trim()
  };
  try {
    localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(GITHUB_CONFIG));
  } catch (e) {}
}

function toggleGhTokenVisibility() {
  const inp = document.getElementById('ghTokenInput');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

function detectGithubPagesRepo() {
  try {
    const host = window.location.hostname || '';
    const pathParts = (window.location.pathname || '').split('/').filter(Boolean);
    if (host.endsWith('.github.io')) {
      const owner = host.split('.')[0];
      const repo = pathParts[0] || `${owner}.github.io`;
      return `${owner}/${repo}`;
    }
  } catch (e) {}
  return '';
}

function buildSchedulePayload(label = 'Синхронизация') {
  const nowIso = new Date().toISOString();
  return {
    version: '0.8',
    updatedAt: nowIso,
    stamp: label,
    classes: CLASSES,
    exams: EXAMS,
    shifts: WORK_SHIFTS_24H,
    notes: PERSONAL_NOTES,
    changelog: CALENDAR_CHANGELOG
  };
}

function applyRemoteSchedulePayload(parsed, sourceLabel = 'GitHub') {
  if (!parsed || typeof parsed !== 'object') return false;
  let changed = false;

  if (parsed.classes && typeof parsed.classes === 'object') {
    CLASSES = sanitizeClassesData(parsed.classes);
    changed = true;
  }
  if (Array.isArray(parsed.exams)) {
    EXAMS = parsed.exams;
    changed = true;
  }
  if (Array.isArray(parsed.shifts)) {
    WORK_SHIFTS_24H = parsed.shifts;
    changed = true;
  }
  if (parsed.notes && typeof parsed.notes === 'object') {
    PERSONAL_NOTES = parsed.notes;
    changed = true;
  }
  if (Array.isArray(parsed.changelog)) {
    const combined = [...CALENDAR_CHANGELOG, ...parsed.changelog];
    const seen = new Set();
    CALENDAR_CHANGELOG = combined.filter(item => {
      if (!item) return false;
      const key = item.id || `${item.timestamp}_${item.action}_${item.detail}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 200);
  }

  const healRes = typeof healScheduleAndExamsFromLogs === 'function'
    ? healScheduleAndExamsFromLogs()
    : { healed: false };

  if (changed || healRes.healed) {
    try {
      localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(CLASSES));
      localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(EXAMS));
      localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(WORK_SHIFTS_24H));
      localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(PERSONAL_NOTES));
      localStorage.setItem(STORAGE_KEY_CHANGELOG, JSON.stringify(CALENDAR_CHANGELOG));
      const stamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      localStorage.setItem(STORAGE_KEY_STAMP, `${sourceLabel} ${stamp}`);
    } catch (e) {}
    updateStorageBadge();
    updateChangelogBadge();
    refreshAllViews();

    if (healRes.healed && !window._hasAutoPushedHeal && GITHUB_CONFIG && GITHUB_CONFIG.repo && GITHUB_CONFIG.token) {
      window._hasAutoPushedHeal = true;
      pushScheduleToGithub('Авто-восстановление пар и кабинетов экзаменов', false);
    }
  }
  return changed;
}

async function pullScheduleFromGithub(manualTrigger = false, silent = false) {
  if (manualTrigger) {
    saveGithubConfigFromInputs();
  }
  const repo = (GITHUB_CONFIG && GITHUB_CONFIG.repo) || detectGithubPagesRepo();
  const branch = (GITHUB_CONFIG && GITHUB_CONFIG.branch) || 'main';
  const configuredPath = (GITHUB_CONFIG && GITHUB_CONFIG.path) || 'data/schedule.json';
  const candidatePaths = [...new Set([configuredPath, 'data/schedule.json', 'schedule.json'])];
  const token = (GITHUB_CONFIG && GITHUB_CONFIG.token) || '';

  try {
    if (manualTrigger && !silent) {
      showSyncMessage('⏳ Загружаем актуальный файл расписания с GitHub...');
    }

    let parsedData = null;
    let foundPath = configuredPath;

    if (repo) {
      // Сначала проверяем, не лежит ли в корне репозитория нераспакованный ZIP-архив (например, загруженный через приложение GitHub)
      try {
        const zipUnpackRes = await checkAndUnpackRemoteZipInRepo(repo, branch, token, manualTrigger, silent);
        if (zipUnpackRes && zipUnpackRes.scheduleData) {
          parsedData = zipUnpackRes.scheduleData;
          foundPath = `${zipUnpackRes.zipName} ➔ data/schedule.json (распакован автоматически)`;
        }
      } catch (zipErr) {}

      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      for (const pathCandidate of candidatePaths) {
        try {
          const apiUrl = `https://api.github.com/repos/${repo}/contents/${pathCandidate}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
          const resp = await fetch(apiUrl, { headers, cache: 'no-store' });
          if (resp.ok) {
            const meta = await resp.json();
            if (meta && meta.content) {
              parsedData = JSON.parse(decodeUtf8Base64(meta.content));
              foundPath = pathCandidate;
              break;
            }
          }
        } catch (e) {}
      }

      if (!parsedData) {
        for (const pathCandidate of candidatePaths) {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${pathCandidate}?t=${Date.now()}`;
            const rawResp = await fetch(rawUrl, { cache: 'no-store' });
            if (rawResp.ok) {
              parsedData = await rawResp.json();
              foundPath = pathCandidate;
              break;
            }
          } catch (e) {}
        }
      }
    }

    if (!parsedData) {
      for (const pathCandidate of candidatePaths) {
        try {
          const sameOriginUrl = new URL(`${pathCandidate}?t=${Date.now()}`, window.location.href).href;
          const resp = await fetch(sameOriginUrl, { cache: 'no-store' });
          if (resp.ok) {
            parsedData = await resp.json();
            foundPath = pathCandidate;
            break;
          }
        } catch (e) {}
      }
    }

    if (parsedData && applyRemoteSchedulePayload(parsedData, 'GitHub')) {
      if (manualTrigger && !silent) {
        showSyncMessage(`✅ Расписание успешно загружено из файла <b>${foundPath}</b> на GitHub!`);
        showToast('📥 Расписание обновлено из GitHub');
      }
      return true;
    } else if (manualTrigger && !silent) {
      showSyncMessage(`⚠️ Файл <b>${configuredPath}</b> пока не найден в репозитории. Нажми «☁️ Обновить schedule.json на GitHub» или разверни модульную структуру.`, true);
    }
  } catch (err) {
    if (manualTrigger && !silent) {
      showSyncMessage(`❌ Не удалось загрузить файл с GitHub: ${err.message}`, true);
    }
  }
  return false;
}

async function pushScheduleToGithub(label = 'Обновление', manualTrigger = false) {
  if (manualTrigger) {
    saveGithubConfigFromInputs();
  }
  const repo = (GITHUB_CONFIG && GITHUB_CONFIG.repo) || detectGithubPagesRepo();
  const branch = (GITHUB_CONFIG && GITHUB_CONFIG.branch) || 'main';
  const path = (GITHUB_CONFIG && GITHUB_CONFIG.path) || 'data/schedule.json';
  const token = (GITHUB_CONFIG && GITHUB_CONFIG.token) || '';

  if (!repo || !token) {
    if (manualTrigger) {
      showSyncMessage('⚠️ Укажи репозиторий (например, <code>username/repo</code>) и свой GitHub Personal Access Token для записи файла на GitHub.', true);
    }
    return false;
  }

  const btn = document.getElementById('ghPushBtn');
  if (btn && manualTrigger) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Сохранение в GitHub...</span>';
  }

  try {
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let currentSha = null;
    const shaCheckUrl = `${apiUrl}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
    const getResp = await fetch(shaCheckUrl, { headers, cache: 'no-store' });
    if (getResp.ok) {
      const existingMeta = await getResp.json();
      if (existingMeta && existingMeta.sha) {
        currentSha = existingMeta.sha;
      }
    }

    const payloadObj = buildSchedulePayload(label);
    const jsonPretty = JSON.stringify(payloadObj, null, 2);
    const putBody = {
      message: `Обновление расписания 1Б (v0.8): ${label}`,
      content: encodeUtf8Base64(jsonPretty),
      branch: branch
    };
    if (currentSha) putBody.sha = currentSha;

    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(putBody)
    });

    const putData = await putResp.json();
    if (!putResp.ok) {
      throw new Error(putData.message || `HTTP ${putResp.status}`);
    }

    const stamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    try {
      localStorage.setItem(STORAGE_KEY_STAMP, `☁️ GitHub ${stamp}`);
    } catch (e) {}
    updateStorageBadge();

    if (manualTrigger) {
      showSyncMessage(`✅ Файл <b>${path}</b> в репозитории <b>${repo}</b> (${branch}) успешно обновлён!`);
    }
    showToast(`☁️ Файл ${path} на GitHub обновлён`);
    return true;
  } catch (err) {
    if (manualTrigger) {
      showSyncMessage(`❌ Ошибка записи в GitHub: <b>${err.message}</b>`, true);
    } else {
      showToast(`⚠️ Локально сохранено (ошибка GitHub: ${err.message})`, true);
    }
    return false;
  } finally {
    if (btn && manualTrigger) {
      btn.disabled = false;
      btn.innerHTML = '<span>☁️ Обновить schedule.json на GitHub</span>';
    }
  }
}

function downloadScheduleJsonFile() {
  const payloadObj = buildSchedulePayload('Экспорт schedule.json');
  const jsonStr = JSON.stringify(payloadObj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schedule.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('💾 Файл schedule.json скачан');
}

// ============================================================================
// ВСТРОЕННЫЙ РАСПАКОВЩИК ZIP-АРХИВОВ В БРАУЗЕРЕ (БЕЗ ВНЕШНИХ ЗАВИСИМОСТЕЙ)
// И УНИВЕРСАЛЬНОЕ ОБНОВЛЕНИЕ МОДУЛЕЙ / АВТО-РАСПАКОВКА ZIP НА GITHUB (v0.8)
// ============================================================================
let selectedIndexHtmlFile = null;
let selectedOriginalFileName = '';
let selectedIndexUnpackedZipMap = null;

let selectedModDirectFile = null;
let selectedModUnpackedZipMap = null;

function base64ToArrayBuffer(b64) {
  const clean = String(b64 || '').replace(/\s+/g, '');
  const binStr = atob(clean);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes.buffer;
}

function isZipFileNameOrBuffer(fileName, arrayBuffer = null) {
  const cleanName = String(fileName || '').trim().toLowerCase();
  if (cleanName.endsWith('.zip')) return true;
  if (arrayBuffer && arrayBuffer.byteLength >= 4) {
    const view = new DataView(arrayBuffer);
    if (view.getUint32(0, true) === 0x04034b50) return true;
  }
  return false;
}

async function inflateRawViaGzip(compressedSlice, crc32Bytes, sizeBytes) {
  // Оборачиваем raw DEFLATE поток в стандартный 10-байтный GZIP-заголовок и 8-байтный трейлер (CRC32 + ISIZE)
  const gz = new Uint8Array(10 + compressedSlice.length + 8);
  gz.set([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03], 0);
  gz.set(compressedSlice, 10);
  gz.set(crc32Bytes, 10 + compressedSlice.length);
  gz.set(sizeBytes, 10 + compressedSlice.length + 4);

  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(gz);
  writer.close();
  const resp = new Response(ds.readable);
  const ab = await resp.arrayBuffer();
  return new Uint8Array(ab);
}

async function unpackZipBuffer(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8');

  // Ищем End of Central Directory (EOCD) сигнатуру 0x06054b50
  let eocdOffset = -1;
  const minEocdOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocdOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Файл не является корректным ZIP-архивом (не найден каталог EOCD)');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const rawExtracted = {};
  let ptr = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > bytes.length) break;
    if (view.getUint32(ptr, true) !== 0x02014b50) break;

    const compressionMethod = view.getUint16(ptr + 10, true);
    const crc32Bytes = bytes.subarray(ptr + 16, ptr + 20);
    const compressedSize = view.getUint32(ptr + 20, true);
    const sizeBytes = bytes.subarray(ptr + 24, ptr + 28);
    const fileNameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const rawNameBytes = bytes.subarray(ptr + 46, ptr + 46 + fileNameLen);
    const fileName = decoder.decode(rawNameBytes).replace(/\\/g, '/').replace(/^\/+/, '');

    ptr += 46 + fileNameLen + extraLen + commentLen;

    // Пропускаем папки и служебные файлы ОС
    if (!fileName || fileName.endsWith('/') || fileName.startsWith('__MACOSX/') || fileName.split('/').pop().startsWith('.')) {
      continue;
    }

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error(`Повреждён заголовок файла внутри архива: ${fileName}`);
    }
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    let fileBytes;
    if (compressionMethod === 0) {
      fileBytes = compressedSlice;
    } else if (compressionMethod === 8) {
      fileBytes = await inflateRawViaGzip(compressedSlice, crc32Bytes, sizeBytes);
    } else {
      throw new Error(`Неподдерживаемый метод сжатия ZIP (${compressionMethod}) в файле ${fileName}`);
    }

    rawExtracted[fileName] = decoder.decode(fileBytes);
  }

  // Если все файлы в архиве лежат внутри одной корневой папки (например, raspisanie-1b-modular/...), убираем эту обёртку
  const rawPaths = Object.keys(rawExtracted);
  let strippedMap = rawExtracted;
  if (rawPaths.length > 0) {
    const splitParts = rawPaths.map(p => p.split('/'));
    const firstRoot = splitParts[0][0];
    const knownSubdirs = new Set(['css', 'js', 'data']);
    if (
      splitParts.every(parts => parts.length > 1 && parts[0] === firstRoot) &&
      !knownSubdirs.has(firstRoot.toLowerCase())
    ) {
      const prefix = firstRoot + '/';
      strippedMap = {};
      for (const [k, v] of Object.entries(rawExtracted)) {
        strippedMap[k.slice(prefix.length)] = v;
      }
    }
  }

  // Нормализуем пути для модульной структуры репозитория
  const finalMap = {};
  for (const [relPath, content] of Object.entries(strippedMap)) {
    const cleanRel = relPath.replace(/^\/+/, '');
    if (cleanRel.includes('/')) {
      finalMap[cleanRel] = content;
    } else {
      finalMap[resolveTargetRepoPath(cleanRel, 'auto')] = content;
    }
  }

  return finalMap;
}

function applyExtractedZipDataLocally(extractedMap, sourceLabel = 'ZIP-архив') {
  if (!extractedMap || typeof extractedMap !== 'object') return null;

  // Обновляем локальный кэш модулей для предпросмотра
  if (!window.MODULAR_PROJECT_FILES) window.MODULAR_PROJECT_FILES = {};
  for (const [pathKey, textVal] of Object.entries(extractedMap)) {
    window.MODULAR_PROJECT_FILES[pathKey] = textVal;
  }

  let parsedSchedule = null;
  const schedJsonText = extractedMap['data/schedule.json'] || extractedMap['schedule.json'];
  if (schedJsonText) {
    try {
      parsedSchedule = JSON.parse(schedJsonText);
      applyRemoteSchedulePayload(parsedSchedule, sourceLabel);
    } catch (e) {}
  }

  const teachersJsonText = extractedMap['data/teachers.json'] || extractedMap['teachers.json'];
  if (teachersJsonText) {
    try {
      const parsedTeachers = JSON.parse(teachersJsonText);
      if (Array.isArray(parsedTeachers) && parsedTeachers.length > 0) {
        BSU_TEACHERS_DB = parsedTeachers;
        if (typeof renderTeachersDirectory === 'function') renderTeachersDirectory();
      }
    } catch (e) {}
  }

  const releasesJsonText = extractedMap['data/releases.json'] || extractedMap['releases.json'];
  if (releasesJsonText) {
    try {
      const parsedReleases = JSON.parse(releasesJsonText);
      if (Array.isArray(parsedReleases) && parsedReleases.length > 0) {
        DEFAULT_APP_RELEASES = parsedReleases;
      }
    } catch (e) {}
  }

  if (typeof renderModularFilesList === 'function') {
    renderModularFilesList();
  }
  return parsedSchedule;
}

function resolveTargetRepoPath(rawFileName, explicitTarget = 'auto') {
  if (explicitTarget && explicitTarget !== 'auto' && explicitTarget !== 'zip-unpack') {
    return explicitTarget;
  }
  const clean = String(rawFileName || '').trim();
  if (!clean) return 'index.html';

  for (const [baseName, repoPath] of Object.entries(MODULAR_FILE_MAP)) {
    if (clean.toLowerCase() === baseName.toLowerCase() || clean.toLowerCase().endsWith('_' + baseName.toLowerCase())) {
      return repoPath;
    }
  }
  if (clean.endsWith('.css')) return `css/${clean}`;
  if (clean.endsWith('.js')) return `js/${clean}`;
  if (clean.endsWith('.json')) return `data/${clean}`;
  if (clean.endsWith('.html') || clean.endsWith('.htm')) return 'index.html';
  return clean;
}

async function listZipArchivesInGithubRepoRoot(repo, branch, token = '') {
  if (!repo) return [];
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `https://api.github.com/repos/${repo}/contents?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
  const resp = await fetch(url, { headers, cache: 'no-store' });
  if (!resp.ok) return [];
  const items = await resp.json();
  if (!Array.isArray(items)) return [];

  return items.filter(item => item && item.type === 'file' && String(item.name || '').toLowerCase().endsWith('.zip'));
}

async function fetchZipArrayBufferFromGithubItem(repo, branch, token, zipItem) {
  const headers = { 'Accept': 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Способ 1: через Git Blobs API (поддерживает CORS и файлы до 100 МБ в base64)
  if (zipItem && zipItem.sha) {
    try {
      const blobUrl = `https://api.github.com/repos/${repo}/git/blobs/${zipItem.sha}?t=${Date.now()}`;
      const blobResp = await fetch(blobUrl, { headers, cache: 'no-store' });
      if (blobResp.ok) {
        const blobData = await blobResp.json();
        if (blobData && blobData.content) {
          return base64ToArrayBuffer(blobData.content);
        }
      }
    } catch (e) {}
  }

  // Способ 2: через Contents API
  if (zipItem && zipItem.path) {
    try {
      const contentUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(zipItem.path)}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
      const contentResp = await fetch(contentUrl, { headers, cache: 'no-store' });
      if (contentResp.ok) {
        const contentData = await contentResp.json();
        if (contentData && contentData.content) {
          return base64ToArrayBuffer(contentData.content);
        }
      }
    } catch (e) {}
  }

  // Способ 3: через прямую ссылку download_url / raw.githubusercontent.com
  const rawUrl = (zipItem && zipItem.download_url) || `https://raw.githubusercontent.com/${repo}/${branch}/${zipItem.path}?t=${Date.now()}`;
  const rawResp = await fetch(rawUrl, { cache: 'no-store' });
  if (!rawResp.ok) {
    throw new Error(`Не удалось скачать архив ${zipItem.name} из репозитория (HTTP ${rawResp.status})`);
  }
  return await rawResp.arrayBuffer();
}

async function deployUnpackedFilesMapToGithub(repo, branch, token, filesMap, commitMessage, extraZipItemsToDelete = [], onProgress = null) {
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const fileEntries = Object.entries(filesMap || {}).filter(([p, c]) => p && typeof c === 'string');
  if (fileEntries.length === 0) {
    throw new Error('В архиве не найдено файлов для распаковки');
  }

  // Проверяем, какие .zip файлы сейчас лежат в корне репозитория, чтобы удалить их после распаковки
  let repoZipItems = [];
  try {
    repoZipItems = await listZipArchivesInGithubRepoRoot(repo, branch, token);
  } catch (e) {}

  const zipDeleteMap = new Map();
  for (const item of [...repoZipItems, ...(extraZipItemsToDelete || [])]) {
    if (item && item.path && !filesMap[item.path]) {
      zipDeleteMap.set(item.path, item);
    }
  }
  const zipsToDelete = Array.from(zipDeleteMap.values());

  // Попытка 1: Быстрый атомарный коммит через GitHub Git Trees API (распаковывает все файлы и удаляет .zip за 1 коммит!)
  try {
    if (onProgress) onProgress(15, `⚡ Формируем единое дерево файлов в репозитории ${repo}...`);

    const refUrl = `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}?t=${Date.now()}`;
    const refResp = await fetch(refUrl, { headers, cache: 'no-store' });
    if (refResp.ok) {
      const refData = await refResp.json();
      const latestCommitSha = refData && refData.object && refData.object.sha;
      if (latestCommitSha) {
        const commitUrl = `https://api.github.com/repos/${repo}/git/commits/${latestCommitSha}?t=${Date.now()}`;
        const commitResp = await fetch(commitUrl, { headers, cache: 'no-store' });
        if (commitResp.ok) {
          const commitData = await commitResp.json();
          const baseTreeSha = commitData && commitData.tree && commitData.tree.sha;
          if (baseTreeSha) {
            const treeItems = fileEntries.map(([filePath, contentText]) => ({
              path: filePath.replace(/^\/+/, ''),
              mode: '100644',
              type: 'blob',
              content: contentText
            }));

            // Добавляем удаление нераспакованных .zip архивов из корня репозитория
            for (const zipItem of zipsToDelete) {
              treeItems.push({
                path: zipItem.path.replace(/^\/+/, ''),
                mode: '100644',
                type: 'blob',
                sha: null
              });
            }

            if (onProgress) onProgress(50, `📦 Загружаем ${fileEntries.length} распакованных файлов в GitHub Tree...`);

            const createTreeResp = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeItems
              })
            });

            if (createTreeResp.ok) {
              const newTreeData = await createTreeResp.json();
              if (newTreeData && newTreeData.sha) {
                if (onProgress) onProgress(80, '📝 Создаём коммит с распакованной структурой...');
                const createCommitResp = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    message: commitMessage,
                    tree: newTreeData.sha,
                    parents: [latestCommitSha]
                  })
                });

                if (createCommitResp.ok) {
                  const newCommitData = await createCommitResp.json();
                  if (newCommitData && newCommitData.sha) {
                    const updateRefResp = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
                      method: 'PATCH',
                      headers,
                      body: JSON.stringify({
                        sha: newCommitData.sha,
                        force: false
                      })
                    });
                    if (updateRefResp.ok) {
                      if (onProgress) onProgress(100, '✅ Архив успешно распакован в репозитории!');
                      return {
                        commitSha: newCommitData.sha,
                        filesCount: fileEntries.length,
                        deletedZips: zipsToDelete.map(z => z.path),
                        method: 'git-tree'
                      };
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (treeErr) {
    // При любой ошибке Git Trees API автоматически переходим к пофайловой загрузке через Contents API
  }

  // Попытка 2: Надёжная пофайловая распаковка через Contents API + удаление .zip
  let doneCount = 0;
  const totalSteps = fileEntries.length + zipsToDelete.length;
  let lastCommitSha = '';

  for (const [filePath, contentText] of fileEntries) {
    doneCount++;
    const pct = Math.round((doneCount / totalSteps) * 100);
    if (onProgress) {
      onProgress(pct, `⏳ Распаковка и отправка файла ${doneCount} из ${fileEntries.length}: ${filePath}...`);
    }
    const putRes = await pushSingleContentToGithub(
      repo,
      branch,
      token,
      filePath.replace(/^\/+/, ''),
      contentText,
      `${commitMessage} (${filePath})`
    );
    if (putRes && putRes.commit && putRes.commit.sha) {
      lastCommitSha = putRes.commit.sha;
    }
  }

  const deletedZipNames = [];
  for (const zipItem of zipsToDelete) {
    try {
      doneCount++;
      const pct = Math.round((doneCount / totalSteps) * 100);
      if (onProgress) {
        onProgress(pct, `🧹 Удаляем нераспакованный архив ${zipItem.path} из репозитория...`);
      }
      let shaToDelete = zipItem.sha;
      if (!shaToDelete) {
        const checkUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(zipItem.path)}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
        const checkResp = await fetch(checkUrl, { headers, cache: 'no-store' });
        if (checkResp.ok) {
          const meta = await checkResp.json();
          shaToDelete = meta && meta.sha;
        }
      }
      if (shaToDelete) {
        const delUrl = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(zipItem.path)}`;
        const delResp = await fetch(delUrl, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({
            message: `Авто-удаление распакованного архива ${zipItem.path}`,
            sha: shaToDelete,
            branch
          })
        });
        if (delResp.ok) {
          deletedZipNames.push(zipItem.path);
        }
      }
    } catch (e) {}
  }

  return {
    commitSha: lastCommitSha,
    filesCount: fileEntries.length,
    deletedZips: deletedZipNames,
    method: 'contents-api'
  };
}

// Автоматическое обнаружение и распаковка ZIP-архива, который уже лежит в репозитории GitHub
async function checkAndUnpackRemoteZipInRepo(repo, branch, token, manualTrigger = false, silent = false) {
  if (!repo) return null;
  const zipItems = await listZipArchivesInGithubRepoRoot(repo, branch, token);
  if (!zipItems || zipItems.length === 0) return null;

  const targetZip = zipItems[0];
  if (manualTrigger && !silent) {
    showSyncMessage(`📦 В репозитории обнаружен ZIP-архив <b>${escapeHtml(targetZip.name)}</b>! Скачиваем и распаковываем...`);
  }

  const zipAb = await fetchZipArrayBufferFromGithubItem(repo, branch, token, targetZip);
  const extractedMap = await unpackZipBuffer(zipAb);
  const scheduleData = applyExtractedZipDataLocally(extractedMap, `GitHub ZIP (${targetZip.name})`);

  // Если есть токен и этот архив ещё не распаковывался в текущей сессии — автоматически раскладываем файлы по папкам в репозитории и удаляем .zip
  const sessionUnpackKey = `${repo}_${branch}_${targetZip.sha || targetZip.name}`;
  if (token && window._lastUnpackedRemoteZipKey !== sessionUnpackKey) {
    window._lastUnpackedRemoteZipKey = sessionUnpackKey;
    try {
      if (manualTrigger && !silent) {
        showSyncMessage(`⏳ Распаковываем <b>${escapeHtml(targetZip.name)}</b> (${Object.keys(extractedMap).length} файлов) прямо в папки репозитория <b>${escapeHtml(repo)}</b> и удаляем исходный .zip...`);
      }
      const res = await deployUnpackedFilesMapToGithub(
        repo,
        branch,
        token,
        extractedMap,
        `Авто-распаковка архива ${targetZip.name} в структуру проекта`,
        [targetZip]
      );
      logAppReleaseChange('v0.8 (Авто-распаковка ZIP)', `Архив ${targetZip.name} автоматически распакован в репозитории ${repo} (${res.filesCount} файлов).`);
      if (!silent) {
        showToast(`📦 Архив ${targetZip.name} распакован на GitHub (${res.filesCount} файлов)!`);
      }
    } catch (deployErr) {
      window._lastUnpackedRemoteZipKey = null;
      if (manualTrigger && !silent) {
        showSyncMessage(`⚠️ Архив ${escapeHtml(targetZip.name)} прочитан локально, но не удалось записать распакованные файлы в GitHub: ${escapeHtml(deployErr.message)}`, true);
      }
    }
  } else if (!token && manualTrigger && !silent) {
    showSyncMessage(`📦 Архив <b>${escapeHtml(targetZip.name)}</b> (${Object.keys(extractedMap).length} файлов) распакован локально! Чтобы разложить файлы по папкам в самом репозитории GitHub, укажи GitHub Token и нажми «📦 Распаковать ZIP в репо».`);
  }

  return {
    zipName: targetZip.name,
    extractedMap,
    scheduleData
  };
}

// Ручной запуск поиска и распаковки ZIP-архива, уже загруженного в репозиторий GitHub
async function unpackRemoteZipInGithubRepo(fromSyncModal = false) {
  if (fromSyncModal) {
    saveGithubConfigFromInputs();
  }
  const repoInp = document.getElementById('modDeployRepoInput');
  const branchInp = document.getElementById('modDeployBranchInput');
  const tokenInp = document.getElementById('modDeployTokenInput');

  const repo = ((fromSyncModal ? '' : (repoInp ? repoInp.value : '')) || (GITHUB_CONFIG && GITHUB_CONFIG.repo) || detectGithubPagesRepo() || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
  const branch = ((fromSyncModal ? '' : (branchInp ? branchInp.value : '')) || (GITHUB_CONFIG && GITHUB_CONFIG.branch) || 'main').trim() || 'main';
  const token = ((fromSyncModal ? '' : (tokenInp ? tokenInp.value : '')) || (GITHUB_CONFIG && GITHUB_CONFIG.token) || '').trim();

  const statusBox = fromSyncModal ? null : document.getElementById('modDirectStatusBox');
  const progressBar = document.getElementById('modDeployProgressBar');

  const setStatus = (htmlMsg, isError = false) => {
    if (fromSyncModal) {
      showSyncMessage(htmlMsg, isError);
    } else if (statusBox) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = isError ? `<span class="text-rose-300">${htmlMsg}</span>` : htmlMsg;
    }
  };

  if (!repo || !token) {
    setStatus('⚠️ Укажи <b>Репозиторий</b> (например, <code>klaycher/Calen</code>) и <b>GitHub Personal Access Token</b>, чтобы сайт смог распаковать ZIP-архив в репозитории!', true);
    showToast('⚠️ Укажи репозиторий и GitHub Token', true);
    return false;
  }

  GITHUB_CONFIG = { repo, branch, path: (GITHUB_CONFIG && GITHUB_CONFIG.path) || 'data/schedule.json', token };
  try {
    localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(GITHUB_CONFIG));
  } catch (e) {}
  populateGithubInputs();

  try {
    setStatus(`🔍 Ищем нераспакованные <code>.zip</code> архивы в корне репозитория <b>${escapeHtml(repo)}</b> (ветка <code>${escapeHtml(branch)}</code>)...`);
    const zipItems = await listZipArchivesInGithubRepoRoot(repo, branch, token);

    if (!zipItems || zipItems.length === 0) {
      setStatus(`ℹ️ В корне репозитория <b>${escapeHtml(repo)}</b> сейчас нет нераспакованных <code>.zip</code> архивов. Ты можешь выбрать <code>.zip</code> файл на своём телефоне кнопкой <b>«📁 Выбрать ZIP-архив или файл»</b> ниже или нажать <b>«🚀 Развернуть все 13 модульных файлов»</b>!`);
      showToast('ℹ️ В репозитории нет нераспакованных .zip файлов');
      return false;
    }

    let totalFilesExtracted = 0;
    const unpackedZipNames = [];

    for (const zipItem of zipItems) {
      setStatus(`📥 Скачиваем архив <b>${escapeHtml(zipItem.name)}</b> (${(zipItem.size / 1024).toFixed(1)} КБ) из репозитория и распаковываем...`);
      const zipAb = await fetchZipArrayBufferFromGithubItem(repo, branch, token, zipItem);
      const extractedMap = await unpackZipBuffer(zipAb);
      const fileKeys = Object.keys(extractedMap);

      applyExtractedZipDataLocally(extractedMap, `GitHub ZIP (${zipItem.name})`);

      const deployRes = await deployUnpackedFilesMapToGithub(
        repo,
        branch,
        token,
        extractedMap,
        `Авто-распаковка архива ${zipItem.name} (${fileKeys.length} файлов)`,
        [zipItem],
        (pct, msg) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          setStatus(`⏳ <b>${escapeHtml(zipItem.name)}:</b> ${escapeHtml(msg)}`);
        }
      );

      totalFilesExtracted += deployRes.filesCount;
      unpackedZipNames.push(zipItem.name);
    }

    const fileListPreview = MODULAR_MANIFEST_INFO.map(m => `<code>${m.path}</code>`).slice(0, 6).join(', ');
    setStatus(`
      <div class="space-y-1.5 text-emerald-200">
        <div class="font-bold text-sm">🎉 Архив <code>${escapeHtml(unpackedZipNames.join(', '))}</code> успешно распакован прямо на GitHub!</div>
        <div class="text-xs text-gray-200">
          ✅ В репозиторий <b>${escapeHtml(repo)}</b> записано файлов: <b>${totalFilesExtracted} шт.</b> (${fileListPreview} и др.)<br>
          🧹 Сам нераспакованный файл <code>${escapeHtml(unpackedZipNames.join(', '))}</code> автоматически удалён из корня репозитория.<br>
          🌐 GitHub Pages обновит сайт в течение 1–2 минут.
        </div>
      </div>
    `);
    showToast(`🎉 ZIP распакован на GitHub (${totalFilesExtracted} файлов)!`);
    return true;
  } catch (err) {
    setStatus(`❌ Ошибка при распаковке ZIP в репозитории: <b>${escapeHtml(err.message)}</b>`, true);
    showToast(`❌ Ошибка: ${err.message}`, true);
    return false;
  }
}

async function onIndexHtmlFileSelected(event) {
  const fileInput = document.getElementById('ghIndexFileInput');
  const file = (event && event.target && event.target.files && event.target.files[0]) || (fileInput && fileInput.files && fileInput.files[0]);
  const prevBox = document.getElementById('ghIndexFilePreview');
  const selEl = document.getElementById('ghTargetModuleSelect');
  const commitMsgInput = document.getElementById('ghIndexCommitMsg');

  if (!file) {
    selectedIndexHtmlFile = null;
    selectedOriginalFileName = '';
    selectedIndexUnpackedZipMap = null;
    if (prevBox) prevBox.classList.add('hidden');
    return;
  }
  selectedOriginalFileName = file.name;
  selectedIndexHtmlFile = file;
  selectedIndexUnpackedZipMap = null;

  const kbSize = (file.size / 1024).toFixed(1);

  if (isZipFileNameOrBuffer(file.name)) {
    try {
      const ab = await file.arrayBuffer();
      const extractedMap = await unpackZipBuffer(ab);
      selectedIndexUnpackedZipMap = extractedMap;
      const paths = Object.keys(extractedMap);

      if (selEl) selEl.value = 'zip-unpack';
      if (commitMsgInput) {
        commitMsgInput.value = `Распаковка обновления из архива ${file.name} (${paths.length} файлов)`;
      }
      if (prevBox) {
        prevBox.innerHTML = `📦 <b>ZIP-архив успешно распакован в браузере:</b> <code>${escapeHtml(file.name)}</code> (${kbSize} КБ)<br>📂 <b>Файлов внутри (${paths.length} шт.):</b> <span class="text-white">${paths.map(escapeHtml).join(', ')}</span><br>✅ При нажатии кнопки все файлы автоматически разложатся по папкам на GitHub!`;
        prevBox.classList.remove('hidden');
      }
      return;
    } catch (zipErr) {
      if (prevBox) {
        prevBox.innerHTML = `❌ Ошибка чтения ZIP-архива: <b>${escapeHtml(zipErr.message)}</b>`;
        prevBox.classList.remove('hidden');
      }
      return;
    }
  }

  const explicitTarget = (selEl && selEl.value !== 'zip-unpack') ? selEl.value : 'auto';
  const targetRepoPath = resolveTargetRepoPath(file.name, explicitTarget);
  if (commitMsgInput) {
    commitMsgInput.value = `Обновление модуля ${targetRepoPath} (v0.8)`;
  }

  if (prevBox) {
    prevBox.innerHTML = `📄 Выбран файл: <b>${escapeHtml(file.name)}</b> (${kbSize} КБ)<br>🎯 Путь в репозитории GitHub: <code class="text-white font-bold">${escapeHtml(targetRepoPath)}</code>`;
    prevBox.classList.remove('hidden');
  }
}

async function pushSingleContentToGithub(repo, branch, token, repoFilePath, contentText, commitMessage) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${repoFilePath}`;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  let currentSha = null;
  try {
    const shaCheckUrl = `${apiUrl}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
    const getResp = await fetch(shaCheckUrl, { headers, cache: 'no-store' });
    if (getResp.ok) {
      const existingMeta = await getResp.json();
      if (existingMeta && existingMeta.sha) {
        currentSha = existingMeta.sha;
      }
    }
  } catch (e) {}

  const putBody = {
    message: commitMessage,
    content: encodeUtf8Base64(contentText),
    branch: branch
  };
  if (currentSha) putBody.sha = currentSha;

  const putResp = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody)
  });

  const putData = await putResp.json();
  if (!putResp.ok) {
    throw new Error(putData.message || `HTTP ${putResp.status}`);
  }
  return putData;
}

async function pushIndexHtmlToGithub() {
  saveGithubConfigFromInputs();
  const repo = (GITHUB_CONFIG && GITHUB_CONFIG.repo) || detectGithubPagesRepo();
  const branch = (GITHUB_CONFIG && GITHUB_CONFIG.branch) || 'main';
  const token = (GITHUB_CONFIG && GITHUB_CONFIG.token) || '';

  if (!repo || !token) {
    showSyncMessage('⚠️ Укажи репозиторий (например, <code>klaycher/Calen</code>) и свой GitHub Personal Access Token выше!', true);
    return false;
  }

  const fileInput = document.getElementById('ghIndexFileInput');
  const file = selectedIndexHtmlFile || (fileInput && fileInput.files && fileInput.files[0]);
  if (!file) {
    showSyncMessage('⚠️ Сначала выбери ZIP-архив или файл модуля (.js, .css, .json, .html) на своём устройстве!', true);
    return false;
  }

  const commitMsgInput = document.getElementById('ghIndexCommitMsg');
  const btn = document.getElementById('ghPushIndexBtn');

  // Если выбран ZIP-архив — распаковываем и раскладываем все файлы по папкам на GitHub
  if (isZipFileNameOrBuffer(file.name) || selectedIndexUnpackedZipMap) {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Распаковка ZIP-архива в GitHub...</span>';
    }
    try {
      const extractedMap = selectedIndexUnpackedZipMap || await unpackZipBuffer(await file.arrayBuffer());
      applyExtractedZipDataLocally(extractedMap, `ZIP (${file.name})`);

      const commitMsg = (commitMsgInput && commitMsgInput.value.trim()) || `Распаковка обновления ${file.name} (${Object.keys(extractedMap).length} файлов)`;
      showSyncMessage(`⏳ Распаковываем <b>${escapeHtml(file.name)}</b> и отправляем <b>${Object.keys(extractedMap).length} файлов</b> в репозиторий <b>${escapeHtml(repo)}</b>...`);

      const res = await deployUnpackedFilesMapToGithub(
        repo,
        branch,
        token,
        extractedMap,
        commitMsg,
        [{ path: file.name }],
        (pct, msg) => showSyncMessage(`⏳ [${pct}%] ${escapeHtml(msg)}`)
      );

      logAppReleaseChange('v0.8 (Распаковка ZIP)', `Архив ${file.name} (${res.filesCount} файлов) распакован и загружен в ${repo} (${branch}).`);
      showSyncMessage(`🎉 <b>ZIP-архив <code>${escapeHtml(file.name)}</code> успешно распакован на GitHub!</b><br>Записано файлов по папкам: <b>${res.filesCount} шт.</b>${res.deletedZips.length ? `<br>🧹 Удалён старый нераспакованный архив: <code>${escapeHtml(res.deletedZips.join(', '))}</code>` : ''}`);
      showToast(`🚀 ZIP распакован (${res.filesCount} файлов)!`);

      if (fileInput) fileInput.value = '';
      selectedIndexHtmlFile = null;
      selectedIndexUnpackedZipMap = null;
      const prevBox = document.getElementById('ghIndexFilePreview');
      if (prevBox) prevBox.classList.add('hidden');
      return true;
    } catch (err) {
      showSyncMessage(`❌ Ошибка распаковки ZIP-архива: <b>${escapeHtml(err.message)}</b>`, true);
      showToast(`❌ Ошибка: ${err.message}`, true);
      return false;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🚀 Запушить выбранный модуль / распаковать ZIP на GitHub</span>';
      }
    }
  }

  const selEl = document.getElementById('ghTargetModuleSelect');
  const explicitTarget = selEl ? selEl.value : 'auto';
  const origName = selectedOriginalFileName || file.name || 'index.html';
  const targetRepoPath = resolveTargetRepoPath(origName, explicitTarget);
  const commitMsg = (commitMsgInput && commitMsgInput.value.trim()) || `Обновление модуля ${targetRepoPath} (v0.8)`;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Отправка ${escapeHtml(targetRepoPath)} в GitHub...</span>`;
  }

  try {
    const fileText = await file.text();
    showSyncMessage(`⏳ Отправляем модуль <b>${escapeHtml(targetRepoPath)}</b> в репозиторий <b>${escapeHtml(repo)}</b> (${escapeHtml(branch)})...`);

    await pushSingleContentToGithub(repo, branch, token, targetRepoPath, fileText, commitMsg);

    const kb = (fileText.length / 1024).toFixed(1);
    logAppReleaseChange('v0.8 (Модуль)', `Модуль ${targetRepoPath} (${kb} КБ) точечно обновлён на GitHub в ветке ${branch}. Коммит: «${commitMsg}».`);

    showSyncMessage(`🎉 <b>Модуль <code>${escapeHtml(targetRepoPath)}</code> (${kb} КБ) успешно обновлён на GitHub!</b><br>Остальные блоки приложения не перезаписывались.`);
    showToast(`🚀 Модуль ${targetRepoPath} обновлён на GitHub!`);

    if (fileInput) fileInput.value = '';
    selectedIndexHtmlFile = null;
    const prevBox = document.getElementById('ghIndexFilePreview');
    if (prevBox) prevBox.classList.add('hidden');
    return true;
  } catch (err) {
    showSyncMessage(`❌ Ошибка обновления модуля ${escapeHtml(targetRepoPath)}: <b>${escapeHtml(err.message)}</b>`, true);
    showToast(`❌ Ошибка: ${err.message}`, true);
    return false;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀 Запушить выбранный модуль / распаковать ZIP на GitHub</span>';
    }
  }
}

// ============================================================================
// АВТО-РАЗВЁРТЫВАНИЕ ВСЕХ 13 МОДУЛЬНЫХ ФАЙЛОВ И УПРАВЛЕНИЕ МОДУЛЯМИ
// ============================================================================
function openModularExplorerModal() {
  const modal = document.getElementById('modularExplorerModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const repoInp = document.getElementById('modDeployRepoInput');
  const branchInp = document.getElementById('modDeployBranchInput');
  const tokenInp = document.getElementById('modDeployTokenInput');
  if (repoInp && !repoInp.value) repoInp.value = (GITHUB_CONFIG && GITHUB_CONFIG.repo) || detectGithubPagesRepo() || '';
  if (branchInp && !branchInp.value) branchInp.value = (GITHUB_CONFIG && GITHUB_CONFIG.branch) || 'main';
  if (tokenInp && !tokenInp.value) tokenInp.value = (GITHUB_CONFIG && GITHUB_CONFIG.token) || '';

  renderModularFilesList();
}

function closeModularExplorerModal() {
  const modal = document.getElementById('modularExplorerModal');
  if (modal) modal.classList.add('hidden');
}

function getModuleSourceContent(path) {
  if (window.MODULAR_PROJECT_FILES && window.MODULAR_PROJECT_FILES[path]) {
    if (path === 'data/schedule.json') {
      return JSON.stringify(buildSchedulePayload('Модульная база v0.8'), null, 2);
    }
    return window.MODULAR_PROJECT_FILES[path];
  }
  if (path === 'data/schedule.json') {
    return JSON.stringify(buildSchedulePayload('Модульная база v0.8'), null, 2);
  }
  if (path === 'data/teachers.json') {
    return JSON.stringify(BSU_TEACHERS_DB, null, 2);
  }
  if (path === 'data/releases.json') {
    return JSON.stringify(DEFAULT_APP_RELEASES, null, 2);
  }
  return '';
}

function renderModularFilesList() {
  const listEl = document.getElementById('modularFilesGrid');
  if (!listEl) return;

  listEl.innerHTML = MODULAR_MANIFEST_INFO.map(item => {
    const src = getModuleSourceContent(item.path);
    const linesCount = src ? src.split('\n').length : 0;
    const kb = src ? (src.length / 1024).toFixed(1) : '—';
    return `
      <div class="p-3 rounded-xl bg-gray-950/90 border border-white/10 hover:border-indigo-500/40 transition flex flex-col justify-between gap-2">
        <div>
          <div class="flex items-center justify-between gap-1.5 mb-1">
            <code class="text-xs font-bold text-indigo-300">${escapeHtml(item.path)}</code>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">${escapeHtml(item.badge)}</span>
          </div>
          <p class="text-[11px] text-gray-300 leading-snug">${escapeHtml(item.title)}</p>
        </div>
        <div class="flex items-center justify-between gap-1.5 pt-2 border-t border-white/5">
          <span class="text-[10px] font-mono text-gray-400">${linesCount ? `${linesCount} стр. • ${kb} КБ` : 'Готов'}</span>
          <div class="flex items-center gap-1">
            <button type="button" onclick="previewModuleCode('${item.path}')" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-200 text-[10px] font-semibold transition" title="Посмотреть исходный код">👁️ Код</button>
            <button type="button" onclick="downloadSingleModuleFile('${item.path}')" class="px-2 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white text-[10px] font-bold transition" title="Скачать файл на устройство">💾 Скачать</button>
            <button type="button" onclick="selectModuleForDirectUpload('${item.path}')" class="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white text-[10px] font-bold transition shadow-sm" title="Выбрать файл обновления на телефоне и загрузить на GitHub">📤 Загрузить</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function previewModuleCode(path) {
  const box = document.getElementById('moduleCodePreviewBox');
  const titleEl = document.getElementById('moduleCodePreviewTitle');
  const area = document.getElementById('moduleCodePreviewTextarea');
  if (!box || !area) return;
  const src = getModuleSourceContent(path);
  if (titleEl) titleEl.textContent = `${path} (${src.split('\n').length} строк)`;
  area.value = src || '// Файл загружается по сети из репозитория';
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function downloadSingleModuleFile(path) {
  const src = getModuleSourceContent(path);
  if (!src) {
    showToast('⚠️ Исходный текст модуля доступен в архиве raspisanie-1b-modular.zip', true);
    return;
  }
  const fileName = path.split('/').pop();
  const blob = new Blob([src], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`💾 Модуль ${fileName} скачан`);
}

async function deployAllModulesToGithub() {
  const repoInp = document.getElementById('modDeployRepoInput');
  const branchInp = document.getElementById('modDeployBranchInput');
  const tokenInp = document.getElementById('modDeployTokenInput');
  const statusBox = document.getElementById('modDeployStatusBox');
  const progressBar = document.getElementById('modDeployProgressBar');
  const deployBtn = document.getElementById('modDeployAllBtn');

  const repo = ((repoInp ? repoInp.value : '') || (GITHUB_CONFIG && GITHUB_CONFIG.repo) || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
  const branch = ((branchInp ? branchInp.value : '') || (GITHUB_CONFIG && GITHUB_CONFIG.branch) || 'main').trim() || 'main';
  const token = ((tokenInp ? tokenInp.value : '') || (GITHUB_CONFIG && GITHUB_CONFIG.token) || '').trim();

  if (!repo || !token) {
    if (statusBox) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = '<span class="text-rose-300">⚠️ Укажи имя репозитория (например, <code>klaycher/Calen</code>) и свой GitHub Personal Access Token!</span>';
    }
    showToast('⚠️ Укажи репозиторий и GitHub Token', true);
    return;
  }

  GITHUB_CONFIG = { repo, branch, path: 'data/schedule.json', token };
  try {
    localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(GITHUB_CONFIG));
  } catch (e) {}
  populateGithubInputs();

  const filesMap = {};
  for (const m of MODULAR_MANIFEST_INFO) {
    const content = getModuleSourceContent(m.path);
    if (content) filesMap[m.path] = content;
  }
  if (window.MODULAR_PROJECT_FILES && window.MODULAR_PROJECT_FILES['README.md']) {
    filesMap['README.md'] = window.MODULAR_PROJECT_FILES['README.md'];
  }

  if (deployBtn) {
    deployBtn.disabled = true;
    deployBtn.innerHTML = '<span>⏳ Развёртывание модулей и очистка старых .zip в GitHub...</span>';
  }
  if (statusBox) statusBox.classList.remove('hidden');

  try {
    const res = await deployUnpackedFilesMapToGithub(
      repo,
      branch,
      token,
      filesMap,
      'Модульная сборка v0.8: развёртывание всех модулей по папкам',
      [],
      (pct, msg) => {
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (statusBox) statusBox.innerHTML = `⏳ <b>[${pct}%]</b> ${escapeHtml(msg)}`;
      }
    );

    if (statusBox) {
      const owner = repo.split('/')[0];
      const repoName = repo.split('/')[1] || '';
      const ghPagesUrl = `https://${owner}.github.io/${repoName}/`;
      statusBox.innerHTML = `
        <div class="space-y-1.5 text-emerald-200">
          <div class="font-bold text-sm">🎉 Все ${res.filesCount} модульных файлов успешно развёрнуты в репозитории <code>${escapeHtml(repo)}</code>!</div>
          <div class="text-xs text-gray-200">
            Папки <code>css/</code>, <code>data/</code> и <code>js/</code> созданы автоматически.${res.deletedZips.length ? `<br>🧹 Удалён нераспакованный архив из корня: <code>${escapeHtml(res.deletedZips.join(', '))}</code>.` : ''}<br>
            Адрес сайта GitHub Pages: <a href="${ghPagesUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-300 underline font-mono font-bold">${ghPagesUrl} ↗</a>
          </div>
        </div>
      `;
    }
    showToast(`🎉 Все ${res.filesCount} модулей развёрнуты в ${repo}!`);
  } catch (err) {
    if (statusBox) {
      statusBox.innerHTML = `<span class="text-rose-300">❌ Ошибка деплоя: <b>${escapeHtml(err.message)}</b>. Проверь права токена (нужно право <code>repo</code> или <code>contents:write</code>).</span>`;
    }
    showToast(`❌ Ошибка деплоя: ${err.message}`, true);
  } finally {
    if (deployBtn) {
      deployBtn.disabled = false;
      deployBtn.innerHTML = '<span>🚀 Развернуть все 13 модульных файлов в репозиторий GitHub</span>';
    }
  }
}

// ============================================================================
// ПРЯМАЯ ЗАГРУЗКА И АВТО-РАСПАКОВКА ZIP-АРХИВА / ФАЙЛА С УСТРОЙСТВА В GITHUB
// ============================================================================
function onModTargetSelectChange() {
  const sel = document.getElementById('modUploadTargetSelect');
  const target = sel ? sel.value : 'auto';
  if (selectedModDirectFile) {
    updateModDirectFilePreview(selectedModDirectFile, target, selectedModUnpackedZipMap);
  }
}

function updateModDirectFilePreview(file, targetOption, unpackedZipMap = null) {
  const previewBox = document.getElementById('modDirectFilePreview');
  const previewContent = document.getElementById('modDirectFilePreviewContent');
  const labelText = document.getElementById('modDirectFileLabelText');
  const commitInput = document.getElementById('modDirectCommitMsg');
  if (!previewBox || !previewContent) return;

  const kb = (file.size / 1024).toFixed(1);

  if (unpackedZipMap && Object.keys(unpackedZipMap).length > 0) {
    const filePaths = Object.keys(unpackedZipMap);
    if (labelText) {
      labelText.textContent = `📦 ZIP-архив: ${file.name} (${filePaths.length} файлов)`;
    }
    previewContent.innerHTML = `
      <div><b>📦 Распознан ZIP-архив:</b> <span class="text-white">${escapeHtml(file.name)}</span> (${kb} КБ)</div>
      <div class="mt-1"><b>📂 Внутри распаковано файлов (${filePaths.length} шт.):</b></div>
      <div class="mt-0.5 text-[11px] text-indigo-200 leading-snug break-all">${filePaths.map(p => `<code class="bg-indigo-950/80 px-1 py-0.5 rounded border border-indigo-500/30 mr-1 inline-block mb-0.5">${escapeHtml(p)}</code>`).join('')}</div>
      <div class="text-[10px] text-emerald-300 font-semibold mt-1">✅ Сайт сам разложит все ${filePaths.length} файлов по папкам в репозитории и удалит старый нераспакованный .zip!</div>
    `;
    previewBox.classList.remove('hidden');
    if (commitInput) {
      commitInput.value = `Авто-распаковка архива ${file.name} (${filePaths.length} файлов)`;
    }
    return;
  }

  const targetPath = resolveTargetRepoPath(file.name, targetOption);
  if (labelText) {
    labelText.textContent = `Выбран: ${file.name} (${kb} КБ)`;
  }

  previewContent.innerHTML = `
    <div><b>Файл:</b> <span class="text-white">${escapeHtml(file.name)}</span> (${kb} КБ)</div>
    <div class="mt-0.5"><b>Цель в репозитории:</b> <code class="text-indigo-200 font-bold bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-500/30">${escapeHtml(targetPath)}</code></div>
    <div class="text-[10px] text-emerald-300/90 mt-0.5">✅ Файл готов к отправке в репозиторий GitHub</div>
  `;
  previewBox.classList.remove('hidden');

  if (commitInput && (!commitInput.value || commitInput.value.startsWith('Обновление ') || commitInput.value.startsWith('Авто-распаковка '))) {
    commitInput.value = `Обновление ${targetPath} напрямую из приложения`;
  }
}

async function onModDirectFileSelected(event) {
  const input = document.getElementById('modDirectFileInput');
  const file = (event && event.target && event.target.files && event.target.files[0]) || (input && input.files && input.files[0]);
  const previewBox = document.getElementById('modDirectFilePreview');
  const labelText = document.getElementById('modDirectFileLabelText');
  const statusBox = document.getElementById('modDirectStatusBox');

  if (!file) {
    selectedModDirectFile = null;
    selectedModUnpackedZipMap = null;
    if (previewBox) previewBox.classList.add('hidden');
    if (labelText) labelText.textContent = 'Нажми сюда, чтобы выбрать ZIP-архив или файл...';
    return;
  }

  selectedModDirectFile = file;
  selectedModUnpackedZipMap = null;
  const sel = document.getElementById('modUploadTargetSelect');

  // Проверяем, является ли выбранный файл ZIP-архивом
  if (isZipFileNameOrBuffer(file.name)) {
    try {
      const ab = await file.arrayBuffer();
      const extractedMap = await unpackZipBuffer(ab);
      selectedModUnpackedZipMap = extractedMap;
      if (sel) sel.value = 'zip-unpack';
      updateModDirectFilePreview(file, 'zip-unpack', extractedMap);
      return;
    } catch (zipErr) {
      if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.innerHTML = `<span class="text-rose-300">❌ Не удалось распаковать выбранный ZIP-архив: <b>${escapeHtml(zipErr.message)}</b></span>`;
      }
      showToast(`❌ Ошибка чтения ZIP: ${zipErr.message}`, true);
      return;
    }
  }

  if (sel && (sel.value === 'auto' || sel.value === 'zip-unpack')) {
    const autoPath = resolveTargetRepoPath(file.name, 'auto');
    let matched = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === autoPath) {
        sel.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched) sel.value = 'auto';
  }

  updateModDirectFilePreview(file, sel ? sel.value : 'auto', null);
}

function selectModuleForDirectUpload(repoPath) {
  const sel = document.getElementById('modUploadTargetSelect');
  if (sel) {
    let matched = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === repoPath) {
        sel.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched && repoPath) {
      const opt = document.createElement('option');
      opt.value = repoPath;
      opt.textContent = repoPath;
      opt.selected = true;
      sel.appendChild(opt);
    }
  }

  const uploadCard = document.getElementById('modDirectUploadCard');
  if (uploadCard) {
    uploadCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const fileInput = document.getElementById('modDirectFileInput');
  if (fileInput) {
    fileInput.click();
  }
}

async function pushModDirectFileToGithub() {
  const repoInp = document.getElementById('modDeployRepoInput');
  const branchInp = document.getElementById('modDeployBranchInput');
  const tokenInp = document.getElementById('modDeployTokenInput');
  const statusBox = document.getElementById('modDirectStatusBox');
  const pushBtn = document.getElementById('modDirectPushBtn');
  const progressBar = document.getElementById('modDeployProgressBar');

  const repo = ((repoInp ? repoInp.value : '') || (GITHUB_CONFIG && GITHUB_CONFIG.repo) || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, '');
  const branch = ((branchInp ? branchInp.value : '') || (GITHUB_CONFIG && GITHUB_CONFIG.branch) || 'main').trim() || 'main';
  const token = ((tokenInp ? tokenInp.value : '') || (GITHUB_CONFIG && GITHUB_CONFIG.token) || '').trim();

  if (!repo || !token) {
    if (statusBox) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = '<span class="text-rose-300">⚠️ Заполни поля <b>Репозиторий</b> (например, <code>klaycher/Calen</code>) и <b>GitHub Personal Access Token</b> выше!</span>';
    }
    showToast('⚠️ Укажи репозиторий и GitHub Token', true);
    return;
  }

  GITHUB_CONFIG = { repo, branch, path: (GITHUB_CONFIG && GITHUB_CONFIG.path) || 'data/schedule.json', token };
  try {
    localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(GITHUB_CONFIG));
  } catch (e) {}
  populateGithubInputs();

  const fileInput = document.getElementById('modDirectFileInput');
  const file = selectedModDirectFile || (fileInput && fileInput.files && fileInput.files[0]);

  if (!file) {
    if (statusBox) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = '<span class="text-amber-300">⚠️ Сначала выбери <b>ZIP-архив</b> или файл обновления на телефоне, либо нажми кнопку <b>«📦 Распаковать ZIP, уже лежащий в репозитории GitHub»</b> выше!</span>';
    }
    showToast('⚠️ Сначала выбери ZIP-архив или файл', true);
    return;
  }

  const commitMsgInp = document.getElementById('modDirectCommitMsg');

  // ЕСЛИ ВЫБРАН ZIP-АРХИВ — АВТОМАТИЧЕСКИ РАСПАКОВЫВАЕМ ЕГО И РАСКЛАДЫВАЕМ ПО ПАПКАМ В GITHUB!
  if (isZipFileNameOrBuffer(file.name) || selectedModUnpackedZipMap) {
    if (pushBtn) {
      pushBtn.disabled = true;
      pushBtn.innerHTML = '<span>⏳ Распаковка ZIP и загрузка всех файлов в GitHub...</span>';
    }
    if (statusBox) {
      statusBox.classList.remove('hidden');
      statusBox.innerHTML = `⏳ <b>Распаковка архива:</b> Извлекаем файлы из <code>${escapeHtml(file.name)}</code> и раскладываем по папкам в <code>${escapeHtml(repo)}</code>...`;
    }

    try {
      const extractedMap = selectedModUnpackedZipMap || await unpackZipBuffer(await file.arrayBuffer());
      applyExtractedZipDataLocally(extractedMap, `ZIP (${file.name})`);

      const fileCount = Object.keys(extractedMap).length;
      const commitMsg = (commitMsgInp && commitMsgInp.value.trim()) || `Авто-распаковка архива ${file.name} (${fileCount} файлов)`;

      const deployRes = await deployUnpackedFilesMapToGithub(
        repo,
        branch,
        token,
        extractedMap,
        commitMsg,
        [{ path: file.name }],
        (pct, msg) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (statusBox) statusBox.innerHTML = `⏳ <b>[${pct}%]</b> ${escapeHtml(msg)}`;
        }
      );

      logAppReleaseChange('v0.8 (Распаковка ZIP)', `ZIP-архив ${file.name} (${deployRes.filesCount} файлов) распакован в ${repo} (${branch}).`);

      const shortSha = deployRes.commitSha ? deployRes.commitSha.substring(0, 7) : 'успешно';
      const repoUrl = `https://github.com/${repo}/tree/${branch}`;

      if (statusBox) {
        statusBox.innerHTML = `
          <div class="space-y-1.5 text-emerald-200">
            <div class="font-bold text-sm">🎉 ZIP-архив <code>${escapeHtml(file.name)}</code> успешно распакован и загружен в <code>${escapeHtml(repo)}</code>!</div>
            <div class="text-xs text-gray-200">
              ✅ Разложено по папкам (<code>index.html</code>, <code>css/</code>, <code>data/</code>, <code>js/</code>): <b>${deployRes.filesCount} файлов</b> (коммит <code>${escapeHtml(shortSha)}</code>).<br>
              ${deployRes.deletedZips.length ? `🧹 Нераспакованный архив <code>${escapeHtml(deployRes.deletedZips.join(', '))}</code> удалён из корня репозитория.<br>` : ''}
              🌐 GitHub Pages обновит сайт в течение 1–2 минут.<br>
              <a href="${repoUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-300 underline font-mono text-[11px]">Открыть распакованные файлы на GitHub ↗</a>
            </div>
          </div>
        `;
      }
      showToast(`🎉 ZIP распакован на GitHub (${deployRes.filesCount} файлов)!`);

      if (fileInput) fileInput.value = '';
      selectedModDirectFile = null;
      selectedModUnpackedZipMap = null;
      const labelText = document.getElementById('modDirectFileLabelText');
      if (labelText) labelText.textContent = 'Нажми сюда, чтобы выбрать ZIP-архив или файл...';
      const previewBox = document.getElementById('modDirectFilePreview');
      if (previewBox) previewBox.classList.add('hidden');
      return;
    } catch (zipErr) {
      if (statusBox) {
        statusBox.innerHTML = `<span class="text-rose-300">❌ Ошибка распаковки ZIP-архива: <b>${escapeHtml(zipErr.message)}</b></span>`;
      }
      showToast(`❌ Ошибка распаковки ZIP: ${zipErr.message}`, true);
      return;
    } finally {
      if (pushBtn) {
        pushBtn.disabled = false;
        pushBtn.innerHTML = '<span>🚀 Распаковать ZIP / загрузить файл в репозиторий GitHub</span>';
      }
    }
  }

  const sel = document.getElementById('modUploadTargetSelect');
  const explicitTarget = sel ? sel.value : 'auto';
  const targetPath = resolveTargetRepoPath(file.name, explicitTarget);
  const commitMsg = (commitMsgInp && commitMsgInp.value.trim()) || `Обновление ${targetPath} напрямую из приложения`;

  if (pushBtn) {
    pushBtn.disabled = true;
    pushBtn.innerHTML = `<span>⏳ Отправка ${escapeHtml(targetPath)} в GitHub...</span>`;
  }
  if (statusBox) {
    statusBox.classList.remove('hidden');
    statusBox.innerHTML = `⏳ <b>Отправка файла:</b> Читаем <code>${escapeHtml(file.name)}</code> и отправляем в <code>${escapeHtml(repo)}/${escapeHtml(targetPath)}</code> (ветка <code>${escapeHtml(branch)}</code>)...`;
  }

  try {
    const fileText = await file.text();
    const result = await pushSingleContentToGithub(repo, branch, token, targetPath, fileText, commitMsg);

    const kb = (fileText.length / 1024).toFixed(1);
    logAppReleaseChange('v0.8 (Прямая загрузка)', `Файл ${targetPath} (${kb} КБ) обновлён в ${repo} (${branch}).`);

    const commitSha = (result && result.commit && result.commit.sha) ? result.commit.sha.substring(0, 7) : '';
    const fileUrl = `https://github.com/${repo}/blob/${branch}/${targetPath}`;

    if (statusBox) {
      statusBox.innerHTML = `
        <div class="space-y-1.5 text-emerald-200">
          <div class="font-bold text-sm">🎉 Файл <code>${escapeHtml(targetPath)}</code> (${kb} КБ) успешно загружен в репозиторий <code>${escapeHtml(repo)}</code>!</div>
          <div class="text-xs text-gray-200">
            Коммит: <code class="font-mono text-indigo-300 font-bold">${escapeHtml(commitSha || 'успешно')}</code> («${escapeHtml(commitMsg)}»)<br>
            GitHub Pages обновит сайт в течение 1–2 минут.<br>
            <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-300 underline font-mono text-[11px]">Посмотреть обновлённый файл на GitHub ↗</a>
          </div>
        </div>
      `;
    }
    showToast(`🚀 Файл ${targetPath} успешно загружен в GitHub!`);

    if (fileInput) fileInput.value = '';
    selectedModDirectFile = null;
    const labelText = document.getElementById('modDirectFileLabelText');
    if (labelText) labelText.textContent = 'Нажми сюда, чтобы выбрать ZIP-архив или файл...';
    const previewBox = document.getElementById('modDirectFilePreview');
    if (previewBox) previewBox.classList.add('hidden');
  } catch (err) {
    if (statusBox) {
      statusBox.innerHTML = `<span class="text-rose-300">❌ Ошибка загрузки файла <code>${escapeHtml(targetPath)}</code>: <b>${escapeHtml(err.message)}</b>.<br>Убедись, что токен имеет право <code>repo</code> или <code>contents:write</code> и имя репозитория указано верно.</span>`;
    }
    showToast(`❌ Ошибка загрузки: ${err.message}`, true);
  } finally {
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.innerHTML = '<span>🚀 Распаковать ZIP / загрузить файл в репозиторий GitHub</span>';
    }
  }
}
