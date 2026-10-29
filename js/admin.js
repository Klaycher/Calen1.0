// ============================================================================
// МОДУЛЬ 4: АДМИН-ПАНЕЛЬ (4778), CRUD СОБЫТИЙ И ЖУРНАЛ ИСТОРИИ (js/admin.js)
// ============================================================================
// ============================================================================
// 2. УПРАВЛЕНИЕ СОБЫТИЯМИ (ДОБАВЛЕНИЕ, РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ)
// ============================================================================
function populateDateSelect() {
  const sel = document.getElementById('evDateSelect');
  sel.innerHTML = SESSION_DATES.map(iso => {
    const dObj = parseIsoLocal(iso);
    return `<option value="${iso}">${toRuShortDate(iso)} — ${DAYS_FULL[dObj.getDay()]}</option>`;
  }).join('');
}

function setClassSlot(start, end) {
  document.getElementById('evClassStart').value = start;
  document.getElementById('evClassEnd').value = end;
}

function openEventModal(defaultTab = 'class', editData = null) {
  populateDateSelect();
  document.getElementById('evDateSelect').value = selectedIso;
  editingState = editData;

  if (editData && editData.type === 'class') {
    const item = (CLASSES[editData.iso] || [])[editData.index];
    if (item) {
      document.getElementById('eventModalTitle').textContent = '✏️ Редактировать пару';
      document.getElementById('evDateSelect').value = editData.iso;
      document.getElementById('evClassStart').value = item.start || '14:10';
      document.getElementById('evClassEnd').value = item.end || '15:30';
      document.getElementById('evClassSubject').value = item.subject || '';
      document.getElementById('evClassRoom').value = item.room || '';
      document.getElementById('evClassControl').value = item.control || 'зач';
      document.getElementById('evClassTeacher').value = item.teacher || '';
      document.getElementById('evClassNote').value = item.note || '';
      switchEventFormTab('class');
    }
  } else if (editData && editData.type === 'exam') {
    const item = EXAMS[editData.index];
    if (item) {
      document.getElementById('eventModalTitle').textContent = '✏️ Редактировать зачёт/экзамен';
      document.getElementById('evDateSelect').value = item.date;
      document.getElementById('evExamType').value = item.type || 'зач';
      document.getElementById('evExamTime').value = item.time || '09:30';
      document.getElementById('evExamSubject').value = item.subject || '';
      document.getElementById('evExamTeacher').value = item.teacher || '';
      document.getElementById('evExamRoom').value = item.room || 'уточняется';
      document.getElementById('evExamNote').value = item.note || '';
      switchEventFormTab('exam');
    }
  } else {
    document.getElementById('eventModalTitle').textContent = '➕ Добавить событие';
    document.getElementById('evClassSubject').value = '';
    document.getElementById('evClassRoom').value = '';
    document.getElementById('evClassTeacher').value = '';
    document.getElementById('evClassNote').value = '';
    document.getElementById('evExamSubject').value = '';
    document.getElementById('evExamTeacher').value = '';
    document.getElementById('evExamRoom').value = 'уточняется';
    document.getElementById('evExamNote').value = '';
    document.getElementById('evNoteLabel').value = '';
    switchEventFormTab(defaultTab);
  }

  document.getElementById('eventModal').classList.remove('hidden');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.add('hidden');
  editingState = null;
}

function switchEventFormTab(tab) {
  currentEventTab = tab;
  const tabs = ['class', 'exam', 'note', 'shift'];
  const bodies = {
    class: 'formBodyClass',
    exam: 'formBodyExam',
    note: 'formBodyNote',
    shift: 'formBodyShift'
  };
  const btns = {
    class: 'evTabClass',
    exam: 'evTabExam',
    note: 'evTabNote',
    shift: 'evTabShift'
  };

  tabs.forEach(t => {
    document.getElementById(bodies[t]).classList.toggle('hidden', t !== tab);
    document.getElementById(btns[t]).className = t === tab
      ? 'py-2 px-2 rounded-lg text-[11px] font-bold bg-indigo-600 text-white transition'
      : 'py-2 px-2 rounded-lg text-[11px] font-bold text-gray-400 hover:text-white transition';
  });
}

function saveEventFromModal() {
  const targetIso = document.getElementById('evDateSelect').value;

  if (currentEventTab === 'class') {
    const start = document.getElementById('evClassStart').value || '14:10';
    const end = document.getElementById('evClassEnd').value || '15:30';
    const subject = document.getElementById('evClassSubject').value.trim();
    const room = document.getElementById('evClassRoom').value.trim() || 'уточняется';
    const control = document.getElementById('evClassControl').value || 'зач';
    const teacher = document.getElementById('evClassTeacher').value.trim() || 'уточняется';
    const note = document.getElementById('evClassNote').value.trim();

    if (!subject) {
      showToast('⚠️ Введи название дисциплины!', true);
      return;
    }

    const newClassObj = { start, end, subject, control, teacher, room };
    if (note) newClassObj.note = note;

    if (editingState && editingState.type === 'class') {
      if (editingState.iso === targetIso) {
        CLASSES[targetIso][editingState.index] = newClassObj;
      } else {
        CLASSES[editingState.iso].splice(editingState.index, 1);
        if (!CLASSES[targetIso]) CLASSES[targetIso] = [];
        CLASSES[targetIso].push(newClassObj);
      }
    } else {
      if (!CLASSES[targetIso]) CLASSES[targetIso] = [];
      CLASSES[targetIso].push(newClassObj);
    }

    CLASSES[targetIso].sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    selectedIso = targetIso;
    const _actType = (editingState && editingState.type === 'class') ? 'Редактирование пары' : 'Добавление пары';
    logCalendarChange(_actType, `«${subject}» (${start}–${end}, Каб ${room}) на ${toRuShortDate(targetIso)}`);
    saveAllToStorage('Пара');
    refreshAllViews();
    closeEventModal();
    showToast(`✅ Пара «${subject}» сохранена на ${toRuShortDate(targetIso)}`);
  }

  else if (currentEventTab === 'exam') {
    const type = document.getElementById('evExamType').value;
    const label = type === 'экз' ? 'Экзамен' : 'Зачёт';
    const time = document.getElementById('evExamTime').value || '09:30';
    const subject = document.getElementById('evExamSubject').value.trim();
    const teacher = document.getElementById('evExamTeacher').value.trim() || 'уточняется';
    const room = document.getElementById('evExamRoom').value.trim() || 'уточняется';
    const note = document.getElementById('evExamNote').value.trim() || 'Добавлено пользователем';

    if (!subject) {
      showToast('⚠️ Введи название предмета для зачёта/экзамена!', true);
      return;
    }

    const examObj = { date: targetIso, time, subject, type, label, teacher, room, note };

    if (editingState && editingState.type === 'exam') {
      EXAMS[editingState.index] = examObj;
    } else {
      EXAMS.push(examObj);
    }

    EXAMS.sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.time) - timeToMin(b.time));
    selectedIso = targetIso;
    const _exActType = (editingState && editingState.type === 'exam') ? `Редактирование (${label})` : `Добавление (${label})`;
    logCalendarChange(_exActType, `«${subject}» (${time}, Каб ${room}) на ${toRuShortDate(targetIso)}`);
    saveAllToStorage(label);
    refreshAllViews();
    closeEventModal();
    showToast(`✅ ${label} «${subject}» сохранён на ${toRuShortDate(targetIso)}`);
  }

  else if (currentEventTab === 'note') {
    const label = document.getElementById('evNoteLabel').value.trim();
    const color = document.getElementById('evNoteColor').value || 'sky';

    if (!label) {
      showToast('⚠️ Введи текст заметки или события!', true);
      return;
    }

    if (!PERSONAL_NOTES[targetIso]) PERSONAL_NOTES[targetIso] = [];
    PERSONAL_NOTES[targetIso].push({ label, color });

    selectedIso = targetIso;
    logCalendarChange('Личная заметка', `«${label}» на ${toRuShortDate(targetIso)}`);
    saveAllToStorage('Заметка');
    refreshAllViews();
    closeEventModal();
    showToast(`✅ Заметка «${label}» добавлена на ${toRuShortDate(targetIso)}`);
  }

  else if (currentEventTab === 'shift') {
    toggleWorkShiftForDay(targetIso);
    selectedIso = targetIso;
    closeEventModal();
  }
}

function deleteClassEvent(iso, idx) {
  if (!CLASSES[iso] || !CLASSES[iso][idx]) return;
  const removed = CLASSES[iso].splice(idx, 1)[0];
  logCalendarChange('Удаление пары', `«${removed.subject}» (${removed.start}–${removed.end}, Каб ${removed.room}) на ${toRuShortDate(iso)}`);
  saveAllToStorage('Удалена пара');
  refreshAllViews();
  showToast(`🗑️ Удалена пара «${removed.subject}» (${toRuShortDate(iso)})`);
}

function deleteExamEvent(examIndex) {
  if (!EXAMS[examIndex]) return;
  const removed = EXAMS.splice(examIndex, 1)[0];
  logCalendarChange(`Удаление (${removed.label})`, `«${removed.subject}» (${removed.time}) на ${toRuShortDate(removed.date)}`);
  saveAllToStorage('Удалён контроль');
  refreshAllViews();
  showToast(`🗑️ Удалён ${removed.label.toLowerCase()} «${removed.subject}»`);
}

function deletePersonalNote(iso, noteIdx) {
  if (!PERSONAL_NOTES[iso] || !PERSONAL_NOTES[iso][noteIdx]) return;
  const removed = PERSONAL_NOTES[iso].splice(noteIdx, 1)[0];
  if (PERSONAL_NOTES[iso].length === 0) delete PERSONAL_NOTES[iso];
  logCalendarChange('Удаление заметки', `«${removed.label}» на ${toRuShortDate(iso)}`);
  saveAllToStorage('Удалена заметка');
  refreshAllViews();
  showToast(`🗑️ Удалена заметка «${removed.label}»`);
}

function toggleWorkShiftForDay(iso) {
  const idx = WORK_SHIFTS_24H.indexOf(iso);
  if (idx >= 0) {
    WORK_SHIFTS_24H.splice(idx, 1);
    logCalendarChange('Удаление смены', `Суточная смена 09:00 на ${toRuShortDate(iso)} снята`);
    saveAllToStorage('Смена снята');
    refreshAllViews();
    showToast(`🗑️ Суточная смена 09:00 на ${toRuShortDate(iso)} удалена`);
  } else {
    WORK_SHIFTS_24H.push(iso);
    WORK_SHIFTS_24H.sort();
    logCalendarChange('Добавление смены', `Суточная смена 09:00–09:00 на ${toRuShortDate(iso)} добавлена`);
    saveAllToStorage('Смена +');
    refreshAllViews();
    showToast(`🛠️ Добавлена суточная смена 09:00–09:00 на ${toRuShortDate(iso)}`);
  }
}


function logCalendarChange(action, detail) {
  const now = new Date();
  const timeStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + 
                  now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const newEntry = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: timeStr,
    action: action,
    detail: detail
  };

  CALENDAR_CHANGELOG.unshift(newEntry);
  if (CALENDAR_CHANGELOG.length > 200) {
    CALENDAR_CHANGELOG = CALENDAR_CHANGELOG.slice(0, 200);
  }

  localStorage.setItem(STORAGE_KEY_CHANGELOG, JSON.stringify(CALENDAR_CHANGELOG));
  updateChangelogBadge();
}

function logAppReleaseChange(versionLabel, detailText) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const newRelease = {
    id: 'rel_' + Date.now(),
    version: versionLabel,
    date: dateStr,
    title: 'Обновление index.html через админку',
    badgeColor: 'bg-indigo-500/25 text-indigo-300 border-indigo-500/40',
    icon: '🚀',
    features: [detailText]
  };
  APP_RELEASES_LOG.unshift(newRelease);
  try {
    localStorage.setItem(STORAGE_KEY_APP_RELEASES, JSON.stringify(APP_RELEASES_LOG));
  } catch (e) {}
  updateChangelogBadge();
  if (activeChangelogTab === 'releases') {
    renderAppReleases();
  }
}

function updateChangelogBadge() {
  const totalCount = CALENDAR_CHANGELOG.length;
  const b = document.getElementById('changelogCountBadge');
  if (b) b.textContent = totalCount;
  const total = document.getElementById('changelogTotalCount');
  if (total) total.textContent = totalCount;
  const schedBadge = document.getElementById('logBadgeScheduleCount');
  if (schedBadge) schedBadge.textContent = totalCount;
  const relBadge = document.getElementById('logBadgeReleasesCount');
  if (relBadge) relBadge.textContent = APP_RELEASES_LOG.length;
}

function openChangelogModal() {
  switchChangelogTab(activeChangelogTab || 'schedule');
  document.getElementById('changelogModal').classList.remove('hidden');
}

function closeChangelogModal() {
  document.getElementById('changelogModal').classList.add('hidden');
}

function switchChangelogTab(tab) {
  activeChangelogTab = tab;
  const isSched = tab === 'schedule';

  const schedBtn = document.getElementById('logTabBtnSchedule');
  const relBtn = document.getElementById('logTabBtnReleases');
  if (schedBtn) {
    schedBtn.className = isSched
      ? 'py-1.5 px-2 rounded-lg text-xs font-bold bg-indigo-600 text-white transition flex items-center justify-center gap-1.5'
      : 'py-1.5 px-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition flex items-center justify-center gap-1.5';
  }
  if (relBtn) {
    relBtn.className = !isSched
      ? 'py-1.5 px-2 rounded-lg text-xs font-bold bg-indigo-600 text-white transition flex items-center justify-center gap-1.5'
      : 'py-1.5 px-2 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition flex items-center justify-center gap-1.5';
  }

  const schedCtrl = document.getElementById('logScheduleControls');
  const relCtrl = document.getElementById('logReleasesControls');
  if (schedCtrl) schedCtrl.classList.toggle('hidden', !isSched);
  if (relCtrl) relCtrl.classList.toggle('hidden', isSched);

  const schedBox = document.getElementById('changelogEntriesContainer');
  const relBox = document.getElementById('changelogReleasesContainer');
  if (schedBox) schedBox.classList.toggle('hidden', !isSched);
  if (relBox) relBox.classList.toggle('hidden', isSched);

  if (isSched) {
    renderChangelogEntries();
  } else {
    renderAppReleases();
  }
}

function renderChangelogEntries() {
  const container = document.getElementById('changelogEntriesContainer');
  updateChangelogBadge();

  if (!CALENDAR_CHANGELOG || CALENDAR_CHANGELOG.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 space-y-2">
        <div class="text-3xl">📭</div>
        <div class="text-sm font-semibold text-gray-300">История расписания пуста</div>
        <div class="text-xs text-gray-500">Любые добавления, редактирования и удаления в расписании будут автоматически сохраняться сюда.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = CALENDAR_CHANGELOG.map(entry => {
    let badgeColor = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    let icon = '✏️';

    if (entry.action.includes('Удален')) {
      badgeColor = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      icon = '🗑️';
    } else if (entry.action.includes('Добавлен') || entry.action.includes('Пара +') || entry.action.includes('Смена +')) {
      badgeColor = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      icon = '➕';
    } else if (entry.action.includes('Импорт') || entry.action.includes('AI') || entry.action.includes('Сброс')) {
      badgeColor = 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      icon = '🔄';
    }

    return `
      <div class="p-3 rounded-xl bg-gray-950/80 border border-white/10 flex items-start justify-between gap-3 hover:border-white/20 transition">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badgeColor} flex items-center gap-1">
              <span>${icon}</span>
              <span>${entry.action}</span>
            </span>
            <span class="text-[10px] font-mono text-gray-400">${entry.timestamp}</span>
          </div>
          <div class="text-xs text-gray-200 break-words leading-relaxed">${entry.detail}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAppReleases() {
  const container = document.getElementById('changelogReleasesContainer');
  updateChangelogBadge();

  if (!APP_RELEASES_LOG || APP_RELEASES_LOG.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-xs text-gray-400">Список релизов пуст</div>`;
    return;
  }

  container.innerHTML = APP_RELEASES_LOG.map(rel => {
    const feats = (rel.features || []).map(f => `
      <li class="flex items-start gap-1.5 text-xs text-gray-200 leading-relaxed">
        <span class="text-indigo-400 text-sm leading-none">•</span>
        <span>${f}</span>
      </li>
    `).join('');

    return `
      <div class="p-3.5 rounded-xl bg-gray-950/90 border border-white/10 hover:border-indigo-500/35 transition space-y-2">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-base">${rel.icon || '🚀'}</span>
            <span class="font-bold text-sm text-white">${rel.title}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${rel.badgeColor || 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'}">
              ${rel.version}
            </span>
            <span class="text-[10px] font-mono text-gray-400">${rel.date}</span>
          </div>
        </div>
        <ul class="space-y-1.5 pl-1 pt-1 border-t border-white/5">
          ${feats}
        </ul>
      </div>
    `;
  }).join('');
}

let confirmClearLogPending = false;
function clearChangelogHistory() {
  if (!confirmClearLogPending) {
    confirmClearLogPending = true;
    showToast('⚠️ Нажми «Очистить журнал» ещё раз для подтверждения', true);
    setTimeout(() => { confirmClearLogPending = false; }, 3500);
    return;
  }
  confirmClearLogPending = false;
  CALENDAR_CHANGELOG = [];
  localStorage.removeItem(STORAGE_KEY_CHANGELOG);
  renderChangelogEntries();
  showToast('🗑️ Журнал расписания очищен (обновления приложения сохранены)');
}



// ============================================================================
// 10. АДМИН-ПАНЕЛЬ (ПАРОЛЬ 4778) И СИНХРОНИЗАЦИЯ С ФАЙЛОМ SCHEDULE.JSON НА GITHUB
// ============================================================================
function handleAdminAuthClick() {
  if (isAdminMode) {
    isAdminMode = false;
    try {
      sessionStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
      localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
    } catch (e) {}
    if (simDateObj) resetSim();
    const drawer = document.getElementById('timeMachineDrawer');
    if (drawer) drawer.classList.add('hidden');
    if (currentBottomTab === 'conflicts') {
      switchBottomTab('exams');
    }
    applyAdminVisibility();
    refreshAllViews();
    showToast('🔒 Вы вышли из админ-панели');
  } else {
    const modal = document.getElementById('adminPasswordModal');
    const inp = document.getElementById('adminPasswordInput');
    const err = document.getElementById('adminPasswordError');
    if (err) err.classList.add('hidden');
    if (inp) inp.value = '';
    if (modal) modal.classList.remove('hidden');
    setTimeout(() => { if (inp) inp.focus(); }, 60);
  }
}

function closeAdminPasswordModal() {
  const modal = document.getElementById('adminPasswordModal');
  if (modal) modal.classList.add('hidden');
}

function submitAdminPassword() {
  const inp = document.getElementById('adminPasswordInput');
  const err = document.getElementById('adminPasswordError');
  const val = (inp ? inp.value : '').trim();

  if (val === ADMIN_PASSWORD_CODE) {
    isAdminMode = true;
    try {
      sessionStorage.setItem(STORAGE_KEY_ADMIN_SESSION, '1');
      localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, '1');
    } catch (e) {}
    closeAdminPasswordModal();
    applyAdminVisibility();
    refreshAllViews();
    showToast('🔓 Админ-панель разблокирована! Проверяем сайт Юрфака БГУ...');
    setTimeout(() => {
      checkBsuWebsiteSchedule(false);
    }, 400);
  } else {
    if (err) err.classList.remove('hidden');
    if (inp) {
      inp.value = '';
      inp.focus();
    }
  }
}

function applyAdminVisibility() {
  // Панель автопроверки БГУ и демо-режима в админке (v0.7)
  const admAutoPanel = document.getElementById('adminAutoUpdatePanel');
  if (admAutoPanel) admAutoPanel.classList.toggle('hidden', !isAdminMode);

  // Шапка
  const hAdd = document.getElementById('headerAddEventBtn');
  if (hAdd) hAdd.className = isAdminMode
    ? 'hidden sm:flex px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition items-center gap-1.5 shadow-lg shadow-indigo-600/25'
    : 'hidden';

  const hSync = document.getElementById('headerSyncBtn');
  if (hSync) hSync.className = isAdminMode
    ? 'hidden sm:flex px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 transition items-center gap-1.5 shadow-sm'
    : 'hidden';

  const hTime = document.getElementById('headerTimeMachineBtn');
  if (hTime) hTime.className = isAdminMode
    ? 'px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/25 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/30 transition flex items-center gap-1'
    : 'hidden';

  const hSub = document.getElementById('headerSubtext');
  if (hSub) hSub.textContent = isAdminMode
    ? 'Минск (UTC+3) • Сессия + Смены 09–09 (Админ)'
    : 'Минск (UTC+3) • Сессия группы 1Б';

  // Календарь и легенда
  const cAdd = document.getElementById('calAddEventBtn');
  if (cAdd) cAdd.classList.toggle('hidden', !isAdminMode);

  const cSub = document.getElementById('calSubtitleText');
  if (cSub) cSub.textContent = isAdminMode
    ? 'Нажми на день для просмотра или редактирования 👇'
    : 'Нажми на день для просмотра расписания 👇';

  const lShift = document.getElementById('legendShiftBadge');
  if (lShift) lShift.classList.toggle('hidden', !isAdminMode);

  // Быстрые кнопки дня
  const dQuick = document.getElementById('dayAdminQuickActions');
  if (dQuick) dQuick.classList.toggle('hidden', !isAdminMode);

  // Вкладка Смены 09-09 и кнопка Добавить контроль
  const tConf = document.getElementById('tabBtnConflicts');
  if (tConf) tConf.classList.toggle('hidden', !isAdminMode);

  const bAddEx = document.getElementById('addExamControlBtn');
  if (bAddEx) bAddEx.classList.toggle('hidden', !isAdminMode);

  // Футер: кнопка Админ и кнопка Лог изменений
  const fLog = document.getElementById('footerChangelogBtn');
  if (fLog) {
    fLog.className = isAdminMode
      ? 'px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-200 border border-white/20 font-sans font-medium text-[11px] transition flex items-center gap-1 shadow-sm'
      : 'hidden';
  }

  const admBtn = document.getElementById('adminToggleBtn');
  const admIcon = document.getElementById('adminToggleIcon');
  const admTxt = document.getElementById('adminToggleText');
  if (admBtn && admIcon && admTxt) {
    if (isAdminMode) {
      admIcon.textContent = '🔓';
      admTxt.textContent = 'Выйти из админ-панели';
      admBtn.className = 'px-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-rose-500/25 active:scale-95 text-emerald-200 hover:text-rose-200 border border-emerald-500/40 font-sans font-bold text-[11px] transition flex items-center gap-1 shadow-sm';
    } else {
      admIcon.textContent = '🔒';
      admTxt.textContent = 'Вход в админ-панель';
      admBtn.className = 'px-2.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-200 border border-white/20 font-sans font-semibold text-[11px] transition flex items-center gap-1 shadow-sm';
    }
  }

  // Мобильное нижнее меню
  const mobGrid = document.getElementById('mobileBottomNavGrid');
  const mobAdd = document.getElementById('mobileNavAddBtn');
  const mobSync = document.getElementById('mobileNavSyncBtn');
  if (mobGrid && mobAdd && mobSync) {
    mobGrid.className = isAdminMode
      ? 'grid grid-cols-6 gap-1 max-w-md mx-auto'
      : 'grid grid-cols-4 gap-1 max-w-md mx-auto';
    mobAdd.className = isAdminMode
      ? 'flex flex-col items-center justify-center py-1 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 active:scale-95'
      : 'hidden';
    mobSync.className = isAdminMode
      ? 'flex flex-col items-center justify-center py-1 rounded-xl text-emerald-300 hover:text-emerald-200 active:bg-white/10'
      : 'hidden';
  }
}
