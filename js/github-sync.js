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
// УНИВЕРСАЛЬНОЕ ОБНОВЛЕНИЕ ЛЮБОГО МОДУЛЯ ПРОЕКТА НА GITHUB (v0.8)
// ============================================================================
let selectedIndexHtmlFile = null;
let selectedOriginalFileName = '';

function resolveTargetRepoPath(rawFileName, explicitTarget = 'auto') {
  if (explicitTarget && explicitTarget !== 'auto') {
    return explicitTarget;
  }
  const clean = String(rawFileName || '').trim();
  if (!clean) return 'index.html';

  // Если имя файла точно совпадает с известным модулем (например, calendar.js -> js/calendar.js)
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

function onIndexHtmlFileSelected(event) {
  const fileInput = document.getElementById('ghIndexFileInput');
  const file = (event && event.target && event.target.files && event.target.files[0]) || (fileInput && fileInput.files && fileInput.files[0]);
  const prevBox = document.getElementById('ghIndexFilePreview');
  const selEl = document.getElementById('ghTargetModuleSelect');
  const explicitTarget = selEl ? selEl.value : 'auto';

  if (!file) {
    selectedIndexHtmlFile = null;
    selectedOriginalFileName = '';
    if (prevBox) prevBox.classList.add('hidden');
    return;
  }
  selectedOriginalFileName = file.name;
  selectedIndexHtmlFile = file;

  const targetRepoPath = resolveTargetRepoPath(file.name, explicitTarget);
  const commitMsgInput = document.getElementById('ghIndexCommitMsg');
  if (commitMsgInput) {
    commitMsgInput.value = `Обновление модуля ${targetRepoPath} (v0.8)`;
  }

  if (prevBox) {
    const kbSize = (file.size / 1024).toFixed(1);
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
    showSyncMessage('⚠️ Укажи репозиторий (например, <code>username/repo</code>) и свой GitHub Personal Access Token выше!', true);
    return false;
  }

  const fileInput = document.getElementById('ghIndexFileInput');
  const file = selectedIndexHtmlFile || (fileInput && fileInput.files && fileInput.files[0]);
  if (!file) {
    showSyncMessage('⚠️ Сначала выбери файл модуля (.js, .css, .json или .html) на своём устройстве!', true);
    return false;
  }

  const selEl = document.getElementById('ghTargetModuleSelect');
  const explicitTarget = selEl ? selEl.value : 'auto';
  const origName = selectedOriginalFileName || file.name || 'index.html';
  const targetRepoPath = resolveTargetRepoPath(origName, explicitTarget);

  const commitMsgInput = document.getElementById('ghIndexCommitMsg');
  const commitMsg = (commitMsgInput && commitMsgInput.value.trim()) || `Обновление модуля ${targetRepoPath} (v0.8)`;

  const btn = document.getElementById('ghPushIndexBtn');
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
      btn.innerHTML = '<span>🚀 Запушить выбранный модуль на GitHub</span>';
    }
  }
}

// ============================================================================
// АВТО-РАЗВЁРТЫВАНИЕ ВСЕХ 13 МОДУЛЬНЫХ ФАЙЛОВ В НОВЫЙ РЕПОЗИТОРИЙ В 1 КЛИК
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
            <button type="button" onclick="previewModuleCode('${item.path}')" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-200 text-[10px] font-semibold transition">👁️ Код</button>
            <button type="button" onclick="downloadSingleModuleFile('${item.path}')" class="px-2 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white text-[10px] font-bold transition">💾 Скачать</button>
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
      statusBox.innerHTML = '<span class="text-rose-300">⚠️ Укажи имя нового репозитория (например, <code>username/raspisanie-v2</code>) и свой GitHub Personal Access Token!</span>';
    }
    showToast('⚠️ Укажи репозиторий и GitHub Token', true);
    return;
  }

  // Сохраняем в конфиг
  GITHUB_CONFIG = { repo, branch, path: 'data/schedule.json', token };
  try {
    localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(GITHUB_CONFIG));
  } catch (e) {}
  populateGithubInputs();

  const filesToDeploy = MODULAR_MANIFEST_INFO.map(m => m.path);
  if (window.MODULAR_PROJECT_FILES && window.MODULAR_PROJECT_FILES['README.md']) {
    filesToDeploy.push('README.md');
  }

  if (deployBtn) {
    deployBtn.disabled = true;
    deployBtn.innerHTML = '<span>⏳ Развёртывание модулей в GitHub...</span>';
  }
  if (statusBox) statusBox.classList.remove('hidden');

  let completed = 0;
  try {
    for (const filePath of filesToDeploy) {
      const content = getModuleSourceContent(filePath);
      if (!content) continue;
      completed++;
      const pct = Math.round((completed / filesToDeploy.length) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (statusBox) {
        statusBox.innerHTML = `⏳ <b>Загружаем модуль ${completed} из ${filesToDeploy.length}:</b> <code class="text-indigo-300">${escapeHtml(filePath)}</code> в репозиторий <b>${escapeHtml(repo)}</b>...`;
      }
      await pushSingleContentToGithub(
        repo,
        branch,
        token,
        filePath,
        content,
        `Модульная сборка v0.8: ${filePath}`
      );
    }

    if (statusBox) {
      const owner = repo.split('/')[0];
      const repoName = repo.split('/')[1] || '';
      const ghPagesUrl = `https://${owner}.github.io/${repoName}/`;
      statusBox.innerHTML = `
        <div class="space-y-1.5 text-emerald-200">
          <div class="font-bold text-sm">🎉 Все ${completed} модульных файлов успешно развёрнуты в репозитории <code>${escapeHtml(repo)}</code>!</div>
          <div class="text-xs text-gray-200">
            Папки <code>css/</code>, <code>data/</code> и <code>js/</code> созданы автоматически. Если в настройках репозитория (Settings ➔ Pages) включён GitHub Pages для ветки <code>${escapeHtml(branch)}</code>, сайт будет доступен по адресу:<br>
            <a href="${ghPagesUrl}" target="_blank" rel="noopener noreferrer" class="text-indigo-300 underline font-mono font-bold">${ghPagesUrl} ↗</a>
          </div>
        </div>
      `;
    }
    showToast(`🎉 Все ${completed} модулей загружены в ${repo}!`);
  } catch (err) {
    if (statusBox) {
      statusBox.innerHTML = `<span class="text-rose-300">❌ Ошибка на файле #${completed}: <b>${escapeHtml(err.message)}</b>. Проверь права токена (нужно право <code>repo</code> или <code>contents:write</code>) и то, что в репозитории создана ветка <code>${escapeHtml(branch)}</code>.</span>`;
    }
    showToast(`❌ Ошибка деплоя: ${err.message}`, true);
  } finally {
    if (deployBtn) {
      deployBtn.disabled = false;
      deployBtn.innerHTML = '<span>🚀 Развернуть все 13 модульных файлов в репозиторий GitHub</span>';
    }
  }
}
