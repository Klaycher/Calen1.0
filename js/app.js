// ============================================================================
// МОДУЛЬ 8: ТОЧКА ВХОДА, УСТАНОВКА PWA И ЗАПУСК ПРИЛОЖЕНИЯ (js/app.js)
// ============================================================================
let deferredPwaPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  const nativeBtn = document.getElementById('pwaNativeInstallBtn');
  if (nativeBtn) nativeBtn.classList.remove('hidden');
  const textEl = document.getElementById('pwaInstallBtnText');
  if (textEl) textEl.textContent = 'Установить';
});

window.addEventListener('appinstalled', () => {
  deferredPwaPrompt = null;
  const nativeBtn = document.getElementById('pwaNativeInstallBtn');
  if (nativeBtn) nativeBtn.classList.add('hidden');
  const textEl = document.getElementById('pwaInstallBtnText');
  if (textEl) textEl.textContent = 'Установлено';
  showToast('🎉 Приложение успешно установлено на телефон!');
});

function isRunningStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
         (window.navigator && window.navigator.standalone === true);
}

function handlePwaInstallClick() {
  if (isRunningStandalone()) {
    showToast('📱 Приложение уже открыто в отдельном окне!');
    return;
  }
  if (deferredPwaPrompt) {
    triggerPwaPrompt();
  } else {
    openPwaInstallModal();
  }
}

function openPwaInstallModal() {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) modal.classList.remove('hidden');
}

function closePwaInstallModal() {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) modal.classList.add('hidden');
}

async function triggerPwaPrompt() {
  if (!deferredPwaPrompt) {
    openPwaInstallModal();
    return;
  }
  try {
    deferredPwaPrompt.prompt();
    const choice = await deferredPwaPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      showToast('✅ Установка приложения запущена...');
    }
    deferredPwaPrompt = null;
    closePwaInstallModal();
  } catch (e) {
    openPwaInstallModal();
  }
}

// Проверка статуса запуска при загрузке
if (isRunningStandalone()) {
  const btn = document.getElementById('pwaInstallHeaderBtn');
  if (btn) {
    btn.innerHTML = '<span>📱</span> <span class="hidden md:inline">Установлено</span>';
    btn.className = 'px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/25 text-emerald-200 border border-emerald-500/30 transition flex items-center gap-1 shadow-sm';
  }
}

// Первичный запуск v0.7 + авто-лечение базы из логов
healScheduleAndExamsFromLogs();
applyAdminVisibility();
updateStorageBadge();

async function bootstrapModularApp() {
  // 1. Загружаем внешние базы из папки data/ (teachers.json, releases.json, schedule.json)
  await loadModularDataFiles();

  // 2. Проверяем целостность и подтягиваем кабинеты из журнала истории
  if (typeof healScheduleAndExamsFromLogs === 'function') {
    healScheduleAndExamsFromLogs();
  }

  // 3. Отрисовываем интерфейс
  applyAdminVisibility();
  updateStorageBadge();
  updateChangelogBadge();
  selectToday();
  refreshAllViews();

  // 4. Запрашиваем свежий schedule.json с GitHub
  pullScheduleFromGithub(false, true);

  if (isAdminMode && typeof checkBsuWebsiteSchedule === 'function') {
    setTimeout(() => {
      checkBsuWebsiteSchedule(false);
    }, 1200);
  }

  // 5. Запускаем периодические таймеры
  setInterval(renderAssistantTemplate, 1000);
  setInterval(() => {
    pullScheduleFromGithub(false, true);
  }, 60000);
}

// Запускаем модульное приложение
bootstrapModularApp();
