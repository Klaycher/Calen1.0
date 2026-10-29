// ============================================================================
// МОДУЛЬ 2: КАЛЕНДАРЬ, СВОДКА ДНЯ, НАВИГАЦИЯ И АВТО-ПУШИ (js/calendar.js)
// ============================================================================
// ============================================================================
// 3. АВТО-УВЕДОМЛЕНИЯ (ЗА 1 ЧАС ДО 1-Й ПАРЫ/ЭКЗАМЕНА И В КОНЦЕ КАЖДОЙ ПАРЫ)
// ============================================================================
function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

function togglePushNotifications() {
  if (!pushEnabled) {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    pushEnabled = true;
    document.getElementById('pushIcon').textContent = '🔔';
    document.getElementById('pushText').textContent = 'Пуши ВКЛ';
    document.getElementById('pushBtn').className = 'px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/30 text-emerald-200 border border-emerald-500/40 transition flex items-center gap-1';
    playNotificationBeep();
    showToast('🔔 Авто-уведомления о начале и окончании пар включены');
  } else {
    pushEnabled = false;
    document.getElementById('pushIcon').textContent = '🔕';
    document.getElementById('pushText').textContent = 'Авто-пуши';
    document.getElementById('pushBtn').className = 'px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-800/90 hover:bg-gray-700 text-gray-200 border border-white/10 transition flex items-center gap-1';
    showToast('🔕 Авто-уведомления отключены');
  }
}

function checkAutoTriggers(now) {
  if (!pushEnabled) return;
  const todayIso = toIsoDate(now);
  const curMin = now.getHours() * 60 + now.getMinutes();
  const todayClasses = CLASSES[todayIso] || [];
  const todayExams = EXAMS.filter(e => e.date === todayIso);

  let firstEventMin = null;
  let firstEventTitle = '';
  if (todayExams.length > 0) {
    firstEventMin = timeToMin(todayExams[0].time);
    firstEventTitle = `${todayExams[0].label}: ${todayExams[0].subject} в ${todayExams[0].time}`;
  } else if (todayClasses.length > 0) {
    firstEventMin = timeToMin(todayClasses[0].start);
    firstEventTitle = `1-я пара: ${todayClasses[0].subject} в ${todayClasses[0].start} (Каб ${todayClasses[0].room})`;
  }

  if (firstEventMin !== null && curMin === firstEventMin - 60) {
    const key = `${todayIso}_1h_before`;
    if (!firedNotifications.has(key)) {
      firedNotifications.add(key);
      sendBrowserNotification('⏰ Через 1 час начало учёбы!', firstEventTitle);
    }
  }

  todayClasses.forEach((c, idx) => {
    if (curMin === timeToMin(c.end)) {
      const key = `${todayIso}_end_${idx}`;
      if (!firedNotifications.has(key)) {
        firedNotifications.add(key);
        const nextC = todayClasses[idx + 1];
        const body = nextC
          ? `Следующая пара в ${nextC.start}: ${nextC.subject} (Каб ${nextC.room})`
          : `Все пары на сегодня закончились! Можно отдыхать.`;
        sendBrowserNotification(`✅ Пара по «${c.subject}» окончена!`, body);
      }
    }
  });
}

function sendBrowserNotification(title, body) {
  playNotificationBeep();
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// ============================================================================
// 4. ГЕНЕРАЦИЯ ЖИВОЙ СВОДКИ ПО ШАБЛОНУ
// ============================================================================
function toggleSummaryCollapse() {
  const box = document.getElementById('assistantReportBox');
  const btn = document.getElementById('collapseSummaryBtn');
  const isHidden = box.classList.toggle('hidden');
  btn.textContent = isHidden ? 'Развернуть' : 'Свернуть';
}

function renderAssistantTemplate() {
  const now = getMinskNow();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const curTimeStr = `${hh}:${mm}`;
  const curMin = now.getHours() * 60 + now.getMinutes();

  document.getElementById('liveClock').textContent = `${hh}:${mm}:${ss}`;
  checkAutoTriggers(now);

  if (Object.keys(CLASSES).length === 0 && EXAMS.length === 0) {
    document.getElementById('assistantReportBox').innerHTML = `
      <div class="p-3.5 sm:p-4 rounded-2xl bg-gray-950/80 border border-white/10 text-center space-y-1.5">
        <div class="text-[10px] sm:text-xs font-bold text-indigo-300 uppercase tracking-wider">⏳ Синхронизация расписания</div>
        <div class="text-xs sm:text-sm font-semibold text-white">Загрузка данных из schedule.json...</div>
        <div class="text-[11px] text-gray-400">Приложение получает актуальную сетку пар и зачётов с GitHub.</div>
      </div>
    `;
    plainReportForCopy = 'Загрузка расписания из schedule.json...';
    return;
  }

  const todayIso = toIsoDate(now);
  const tmrwObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);
  const tmrwIso = toIsoDate(tmrwObj);

  const todayClasses = Array.isArray(CLASSES[todayIso]) ? CLASSES[todayIso] : [];
  const todayNotes = Array.isArray(PERSONAL_NOTES[todayIso]) ? PERSONAL_NOTES[todayIso] : [];
  const shiftToday = getShiftStatus(todayIso);

  let activeClass = null;
  let nextClass = null;
  const remainingClasses = [];

  for (const c of todayClasses) {
    const sMin = timeToMin(c.start);
    const eMin = timeToMin(c.end);
    if (curMin >= sMin && curMin < eMin) {
      activeClass = c;
    } else if (curMin < sMin) {
      if (!nextClass) nextClass = c;
      remainingClasses.push(c);
    }
  }

  let nowHeroHtml = '';

  if (activeClass) {
    const left = timeToMin(activeClass.end) - curMin;
    nowHeroHtml = `
      <div class="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-900/80 via-emerald-950/75 to-gray-900 border-2 border-emerald-400/60 shadow-lg shadow-emerald-500/10 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider bg-emerald-500/25 text-emerald-200 border border-emerald-400/50">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>🟢 Сейчас идёт пара</span>
          </span>
          <span class="font-mono text-xs sm:text-sm font-bold text-emerald-300 bg-black/40 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
            ⏱️ До конца: ${formatMinDiff(left)} (в ${activeClass.end.replace(':','.')})
          </span>
        </div>
        <div class="text-sm sm:text-lg font-extrabold text-white leading-snug">
          📚 ${activeClass.subject} <span class="text-xs sm:text-sm font-bold text-indigo-300 uppercase">(${activeClass.control})</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-200">
          <span class="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 font-mono font-bold">
            🚪 Каб ${activeClass.room}
          </span>
          <span>👨‍🏫 Преподаватель: <b class="text-white">${activeClass.teacher}</b></span>
          <span class="text-xs text-gray-400 font-mono ml-auto">Сейчас ${curTimeStr}</span>
        </div>
      </div>
    `;
  } else if (nextClass) {
    const wait = timeToMin(nextClass.start) - curMin;
    nowHeroHtml = `
      <div class="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-purple-950/75 to-gray-900 border-2 border-indigo-400/60 shadow-lg shadow-indigo-500/10 space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider bg-amber-500/25 text-amber-200 border border-amber-400/50">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>⏳ Сейчас перерыв / ожидание пары</span>
          </span>
          <span class="font-mono text-xs sm:text-sm font-bold text-indigo-200 bg-black/40 px-2.5 py-0.5 rounded-lg border border-indigo-400/40">
            🔔 Начало через ${formatMinDiff(wait)} (${nextClass.start.replace(':','.')}–${nextClass.end.replace(':','.')})
          </span>
        </div>
        <div class="text-sm sm:text-lg font-extrabold text-white leading-snug">
          Готовимся к паре: <span class="text-indigo-200">${nextClass.subject}</span> <span class="text-xs sm:text-sm font-bold text-purple-300 uppercase">(${nextClass.control})</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-200">
          <span class="px-2.5 py-0.5 rounded-lg bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 font-mono font-bold">
            🚪 Каб ${nextClass.room}
          </span>
          <span>👨‍🏫 Преподаватель: <b class="text-white">${nextClass.teacher}</b></span>
          <span class="text-xs text-gray-400 font-mono ml-auto">Сейчас ${curTimeStr}</span>
        </div>
      </div>
    `;
  } else {
    nowHeroHtml = `
      <div class="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-2 border-indigo-500/45 shadow-md space-y-1.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-wider bg-indigo-500/25 text-indigo-200 border border-indigo-400/40">
            <span>✨ На данный момент пар нет</span>
          </span>
          <span class="font-mono text-xs sm:text-sm font-bold text-indigo-300">
            🕒 Сейчас ${curTimeStr} (${toRuShortDate(todayIso)}, ${DAYS_FULL[now.getDay()]})
          </span>
        </div>
        <div class="text-sm sm:text-base font-extrabold text-white">
          Учебные пары на сегодня завершены — время отдыхать и готовиться к следующему учебному дню!
        </div>
      </div>
    `;
  }

  let shiftBanner = '';
  if (isAdminMode) {
    todayNotes.forEach(n => {
      if (n.color === 'contest') {
        shiftBanner += `<div class="px-3 py-1.5 rounded-lg badge-contest text-xs font-semibold">🏆 Сегодня (${toRuShortDate(todayIso)}): ${n.label}</div>`;
      }
    });
    if (shiftToday.startsAt9) {
      shiftBanner += `<div class="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs">🛠️ <b>График смен:</b> Сегодня в <b>09:00</b> началась твоя суточная смена (до 09:00 завтрашнего дня).</div>`;
    } else if (shiftToday.endsAt9) {
      shiftBanner += `<div class="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs">🛠️ <b>График смен:</b> Сегодня в <b>09:00</b> утра завершилась твоя суточная смена.</div>`;
    }
  }

  let remHtml = '';
  if (remainingClasses.length > 0) {
    remHtml = `<ul class="space-y-1 mt-1">` + remainingClasses.map(c =>
      `<li class="flex items-start gap-2"><span class="text-indigo-400">•</span><span><b>${c.start.replace(':','.')}–${c.end.replace(':','.')}</b> — ${c.subject} <b>(${c.control})</b>, ${c.teacher}, Каб <b>${c.room}</b></span></li>`
    ).join('') + `</ul>`;
  } else {
    remHtml = `<div class="text-gray-400 text-xs mt-0.5">На сегодня больше пар по расписанию нет.</div>`;
  }

  const tmrwExams = EXAMS.filter(e => e.date === tmrwIso);
  const tmrwClasses = Array.isArray(CLASSES[tmrwIso]) ? CLASSES[tmrwIso] : [];
  const tmrwShift = getShiftStatus(tmrwIso);
  const tmrwNotes = Array.isArray(PERSONAL_NOTES[tmrwIso]) ? PERSONAL_NOTES[tmrwIso] : [];

  let tmrwExamLine = '';
  if (tmrwExams.length > 0) {
    tmrwExamLine = tmrwExams.map(ex => {
      const noteText = formatExamNoteForView(ex.note);
      return `<div class="p-2 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium">⚠️ <b>Экзамен/Зачет!</b> <b>${ex.time}</b> — <b>${ex.subject} (${ex.type})</b>, Каб <b>${ex.room}</b>, Преподаватель <b>${ex.teacher}</b>.${noteText ? ` <span class="text-amber-300">${noteText}</span>` : ''}</div>`;
    }).join('');
  } else {
    tmrwExamLine = `<div class="text-xs text-gray-300">⚠️ <b>Экзамен/Зачет! (если есть):</b> Событий контроля на завтра нет.</div>`;
  }

  let tmrwExtraAlert = '';
  if (isAdminMode) {
    tmrwNotes.forEach(n => {
      tmrwExtraAlert += `<div class="text-xs text-fuchsia-300 font-semibold">📌 Событие на завтра: ${n.label}</div>`;
    });
    if (tmrwShift.startsAt9) {
      tmrwExtraAlert += `<div class="text-xs text-amber-300 font-medium">🛠️ Завтра с <b>09:00</b> заступаешь на суточную смену (до 09:00 следующего дня).</div>`;
    } else if (tmrwShift.endsAt9) {
      tmrwExtraAlert += `<div class="text-xs text-amber-300 font-medium">🛠️ Завтра в <b>09:00</b> утра заканчивается твоя суточная смена.</div>`;
    }
  }

  let tmrwClassesHtml = '';
  if (tmrwClasses.length > 0) {
    tmrwClassesHtml = `<ul class="space-y-1 mt-1">` + tmrwClasses.map(c =>
      `<li class="flex items-start gap-2"><span class="text-emerald-400">•</span><span><b>${c.start.replace(':','.')}–${c.end.replace(':','.')}</b> — ${c.subject} <b>(${c.control})</b>, ${c.teacher}, Каб <b>${c.room}</b></span></li>`
    ).join('') + `</ul>`;
  } else {
    tmrwClassesHtml = `<div class="text-gray-400 text-xs mt-0.5">Пар на завтра нет.</div>`;
  }

  document.getElementById('assistantReportBox').innerHTML = `
    ${shiftBanner}
    ${nowHeroHtml}
    <div class="pt-2 border-t border-white/10">
      <div class="font-bold text-indigo-300 text-xs uppercase tracking-wider">Следующие пары на сегодня (${toRuShortDate(todayIso)}):</div>
      ${remHtml}
    </div>
    <div class="pt-2 border-t border-white/10 space-y-1">
      <div class="font-bold text-emerald-300 text-xs uppercase tracking-wider">Информация на завтра (${toRuShortDate(tmrwIso)}, ${DAYS_FULL[tmrwObj.getDay()]}):</div>
      ${tmrwExamLine}
      ${tmrwExtraAlert}
      ${tmrwClassesHtml}
    </div>
  `;

  plainReportForCopy = document.getElementById('assistantReportBox').innerText;
}

// ============================================================================
// 5. ОТРИСОВКА СЕТКИ КАЛЕНДАРЯ И СВОДКИ ДНЯ
// ============================================================================
function renderCalendarGrid() {
  const grid = document.getElementById('calendarGrid');
  const nowIso = toIsoDate(getMinskNow());

  grid.innerHTML = SESSION_DATES.map(iso => {
    const dObj = parseIsoLocal(iso);
    const dayNum = dObj.getDate();
    const monthShort = dObj.getMonth() === 9 ? 'окт' : 'ноя';
    const isToday = iso === nowIso;
    const isSelected = iso === selectedIso;

    const dayClasses = CLASSES[iso] || [];
    const dayExams = EXAMS.filter(e => e.date === iso);
    const notes = PERSONAL_NOTES[iso] || [];
    const shift = getShiftStatus(iso);

    let badges = '';

    if (isAdminMode) {
      if (shift.startsAt9) {
        badges += `<div class="text-[8px] sm:text-[10px] px-1 py-0.5 rounded badge-work24 font-bold text-center leading-tight truncate"><span class="sm:hidden">🛠️09</span><span class="hidden sm:inline">работа 09:00</span></div>`;
      } else if (shift.endsAt9) {
        badges += `<div class="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-300/90 border border-amber-500/20 text-center leading-tight truncate"><span class="sm:hidden">до 09</span><span class="hidden sm:inline">смена до 09:00</span></div>`;
      }
    }

    dayExams.forEach(ex => {
      const cls = ex.type === 'экз' ? 'badge-exam' : 'badge-zach';
      badges += `<div class="text-[8px] sm:text-[10px] px-1 py-0.5 rounded ${cls} font-bold text-center leading-tight truncate">⚠️ ${ex.type.toUpperCase()} <span class="hidden sm:inline">${ex.time}</span></div>`;
    });

    if (isAdminMode) {
      notes.forEach(n => {
        if (n.color === 'contest') {
          badges += `<div class="text-[8px] sm:text-[10px] px-1 py-0.5 rounded badge-contest font-bold text-center leading-tight truncate">🏆 <span class="hidden sm:inline">${n.label}</span></div>`;
        } else {
          const colorCls = n.color === 'emerald'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : 'bg-sky-500/15 text-sky-300 border-sky-500/30';
          badges += `<div class="text-[8px] sm:text-[9px] px-1 py-0.5 rounded ${colorCls} border text-center leading-tight truncate">${n.label}</div>`;
        }
      });
    }

    if (dayClasses.length > 0) {
      const firstStart = dayClasses[0].start.replace(':','.');
      const lastEnd = dayClasses[dayClasses.length - 1].end.replace(':','.');
      badges += `<div class="text-[8px] sm:text-[10px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-center font-mono leading-tight truncate"><span class="sm:hidden">${dayClasses.length}п</span><span class="hidden sm:inline">${dayClasses.length} п: ${firstStart}-${lastEnd}</span></div>`;
    }

    return `
      <button onclick="selectDay('${iso}')" class="text-left rounded-xl p-1 sm:p-2 min-h-[78px] sm:min-h-[118px] flex flex-col justify-between transition border border-white/10 bg-gray-900/60 hover:bg-gray-800/80 active:scale-95 ${isSelected ? 'day-selected' : ''} ${isToday ? 'ring-1 ring-emerald-400' : ''}">
        <div class="flex items-center justify-between w-full mb-0.5">
          <span class="text-[11px] sm:text-sm font-extrabold ${isSelected ? 'text-indigo-300' : 'text-white'}">
            ${dayNum}<span class="text-[8px] sm:text-[9px] font-normal text-gray-400 ml-0.5">${dayNum === 1 || dayNum === 26 ? monthShort : ''}</span>
          </span>
          ${isToday ? '<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400" title="Сегодня"></span>' : ''}
        </div>
        <div class="space-y-0.5 sm:space-y-1 w-full overflow-hidden">
          ${badges}
        </div>
      </button>
    `;
  }).join('');
}

function renderQuickDayStrip() {
  const strip = document.getElementById('quickDayStrip');
  strip.innerHTML = SESSION_DATES.map(iso => {
    const dObj = parseIsoLocal(iso);
    const dayNum = dObj.getDate();
    const dow = DAYS_SHORT[dObj.getDay()];
    const isSel = iso === selectedIso;
    const hasExam = EXAMS.some(e => e.date === iso);
    const hasNote = isAdminMode && (PERSONAL_NOTES[iso] || []).length > 0;

    return `
      <button onclick="selectDay('${iso}')" id="stripDay_${iso}" class="shrink-0 px-2.5 py-1.5 rounded-xl border text-center transition ${isSel ? 'bg-indigo-600 text-white border-indigo-400 font-bold' : 'bg-gray-900/80 text-gray-300 border-white/10 hover:bg-gray-800'}">
        <div class="text-[10px] opacity-80">${dow}</div>
        <div class="text-xs font-mono flex items-center justify-center gap-0.5">
          ${dayNum}
          ${hasExam ? '<span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>' : ''}
          ${hasNote ? '<span class="w-1.5 h-1.5 rounded-full bg-fuchsia-400"></span>' : ''}
        </div>
      </button>
    `;
  }).join('');
}

function renderSelectedDaySummary() {
  const dObj = parseIsoLocal(selectedIso);
  const dayNum = dObj.getDate();
  const monthName = MONTHS_GEN[dObj.getMonth()];
  const dowFull = DAYS_FULL[dObj.getDay()];

  document.getElementById('detailDaySubtitle').textContent = `Детальная сводка • ${toRuShortDate(selectedIso)}`;
  document.getElementById('detailDayTitle').textContent = `${dayNum} ${monthName}, ${dowFull}`;

  const dayClasses = CLASSES[selectedIso] || [];
  const dayExams = EXAMS
    .map((ex, globalIdx) => ({ ...ex, globalIdx }))
    .filter(e => e.date === selectedIso);
  const shift = getShiftStatus(selectedIso);
  const notes = PERSONAL_NOTES[selectedIso] || [];

  const shiftBtn = document.getElementById('quickShiftToggleBtn');
  if (shiftBtn) {
    shiftBtn.innerHTML = shift.startsAt9 ? '🗑️ Смена' : '🛠️ +Смена';
  }

  let html = '';

  html += `
    <div class="grid ${isAdminMode ? 'grid-cols-3' : 'grid-cols-2'} gap-2 text-center">
      <div class="p-2 rounded-xl bg-gray-900/90 border border-white/10">
        <div class="text-[10px] text-gray-400 uppercase">Пар за день</div>
        <div class="text-sm font-extrabold text-indigo-300 mt-0.5">${dayClasses.length}</div>
      </div>
      <div class="p-2 rounded-xl bg-gray-900/90 border border-white/10">
        <div class="text-[10px] text-gray-400 uppercase">Контроль</div>
        <div class="text-sm font-extrabold ${dayExams.length ? 'text-rose-400' : 'text-emerald-400'} mt-0.5">
          ${dayExams.length ? dayExams[0].label : 'Нет'}
        </div>
      </div>
      ${isAdminMode ? `
      <div class="p-2 rounded-xl bg-gray-900/90 border border-white/10">
        <div class="text-[10px] text-gray-400 uppercase">Смена 09–09</div>
        <div class="text-xs font-bold text-amber-300 mt-1">
          ${shift.startsAt9 ? 'Старт 09:00' : (shift.endsAt9 ? 'Конец 09:00' : 'Выходной')}
        </div>
      </div>
      ` : ''}
    </div>
  `;

  if (isAdminMode && notes.length > 0) {
    notes.forEach((n, noteIdx) => {
      if (n.color === 'contest') {
        html += `
          <div class="p-3 rounded-xl badge-contest flex items-start justify-between gap-2">
            <div>
              <div class="font-extrabold text-xs sm:text-sm flex items-center gap-1.5">${n.label}</div>
              <div class="text-[11px] mt-0.5 text-fuchsia-100">Важное событие на выбранный день</div>
            </div>
            <button onclick="deletePersonalNote('${selectedIso}', ${noteIdx})" class="px-2 py-1 rounded-lg bg-black/30 hover:bg-rose-500/40 text-xs text-rose-200 transition shrink-0" title="Удалить событие">
              🗑️
            </button>
          </div>
        `;
      } else {
        const colorCls = n.color === 'emerald'
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
          : 'bg-sky-500/15 border-sky-500/30 text-sky-200';
        html += `
          <div class="px-3 py-2 rounded-xl border ${colorCls} text-xs font-medium flex items-center justify-between gap-2">
            <span>📌 Заметка: <b>${n.label}</b></span>
            <button onclick="deletePersonalNote('${selectedIso}', ${noteIdx})" class="px-2 py-1 rounded-lg bg-black/25 hover:bg-rose-500/40 text-rose-300 transition shrink-0" title="Удалить заметку">
              🗑️
            </button>
          </div>
        `;
      }
    });
  }

  if (isAdminMode && (shift.startsAt9 || shift.endsAt9)) {
    html += `
      <div class="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-1">
        <div class="font-bold flex items-center justify-between gap-2">
          <span>🛠️ Суточная рабочая смена (09:00 – 09:00)</span>
          ${shift.startsAt9 ? `
            <button onclick="toggleWorkShiftForDay('${selectedIso}')" class="px-2 py-0.5 rounded-lg bg-black/30 hover:bg-rose-500/40 text-rose-200 text-[11px] transition" title="Удалить смену">
              🗑️ Удалить
            </button>
          ` : `<span class="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/20">до 09:00</span>`}
        </div>
        <div>${shift.startsAt9
          ? 'Заступаешь на смену в <b>09:00 утра</b> до 09:00 следующего дня.'
          : 'Смена заканчивается сегодня в <b>09:00 утра</b>.'}</div>
      </div>
    `;
  }

  if (dayExams.length > 0) {
    dayExams.forEach(ex => {
      const isExam = ex.type === 'экз';
      const examNoteView = formatExamNoteForView(ex.note);
      html += `
        <div class="p-3.5 rounded-xl ${isExam ? 'badge-exam' : 'badge-zach'} space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-mono uppercase font-extrabold px-2 py-0.5 rounded bg-black/30">⚠️ ${ex.label} (${ex.type}) • ⏰ ${ex.time}</span>
            ${isAdminMode ? `
            <div class="flex items-center gap-1">
              <button onclick='openEventModal("exam", {type:"exam", index:${ex.globalIdx}})' class="px-2 py-1 rounded-lg bg-black/30 hover:bg-white/20 text-white text-xs transition" title="Редактировать">
                ✏️
              </button>
              <button onclick="deleteExamEvent(${ex.globalIdx})" class="px-2 py-1 rounded-lg bg-black/30 hover:bg-rose-500/50 text-rose-200 text-xs transition" title="Удалить">
                🗑️
              </button>
            </div>
            ` : ''}
          </div>
          <div class="font-bold text-sm sm:text-base text-white">${ex.subject}</div>
          <div class="text-xs opacity-95 flex flex-wrap items-center gap-1">
            <span>Преподаватель:</span>
            <button type="button" onclick='openTeacherByScheduleName(${JSON.stringify(ex.teacher)})' class="font-bold underline decoration-white/40 hover:text-indigo-200 transition">${ex.teacher} ℹ️</button>
            <span>• Каб: <b>${ex.room}</b></span>
          </div>
          ${examNoteView ? `<div class="text-[11px] pt-0.5 text-amber-200 font-medium">${examNoteView}</div>` : ''}
        </div>
      `;
    });
  }

  if (dayClasses.length > 0) {
    html += `<div class="space-y-2"><div class="text-xs font-bold uppercase tracking-wider text-gray-400">Расписание пар группы 1Б (${dayClasses.length}):</div>`;
    dayClasses.forEach((c, idx) => {
      const badgeCls = c.control === 'экз'
        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        : 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      html += `
        <div class="p-3 rounded-xl bg-gray-900/90 border border-white/10 hover:border-indigo-500/40 transition">
          <div class="flex items-center justify-between gap-1.5 mb-1.5">
            <span class="font-mono text-[11px] sm:text-xs font-bold text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
              ${idx + 1}-я пара • ${c.start.replace(':','.')}–${c.end.replace(':','.')}
            </span>
            <div class="flex items-center gap-1">
              <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Каб ${c.room}
              </span>
              ${isAdminMode ? `
              <button onclick='openEventModal("class", {type:"class", iso:"${selectedIso}", index:${idx}})' class="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 text-xs transition" title="Редактировать пару">
                ✏️
              </button>
              <button onclick="deleteClassEvent('${selectedIso}', ${idx})" class="px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/35 text-rose-300 text-xs transition" title="Удалить пару">
                🗑️
              </button>
              ` : ''}
            </div>
          </div>
          <div class="font-bold text-xs sm:text-sm text-white flex flex-wrap items-center gap-1.5">
            <span>${c.subject}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${badgeCls}">(${c.control})</span>
          </div>
          <div class="text-xs text-gray-300 mt-1 flex items-center justify-between gap-2">
            <button type="button" onclick='openTeacherByScheduleName(${JSON.stringify(c.teacher)})' class="text-left hover:text-indigo-300 transition flex items-center gap-1 group">
              <span>👨‍🏫</span>
              <span class="underline decoration-white/20 group-hover:decoration-indigo-400">${c.teacher}</span>
              <span class="text-[10px] text-indigo-400 opacity-80 group-hover:opacity-100">ℹ️ профиль</span>
            </button>
          </div>
          ${c.note ? `<div class="mt-1.5 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">💡 ${c.note}</div>` : ''}
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `
      <div class="p-5 rounded-xl bg-gray-900/60 border border-white/5 text-center space-y-2">
        <div class="text-2xl">☕</div>
        <div class="text-sm font-bold text-gray-200">Учебных пар в этот день нет</div>
        <div class="text-xs text-gray-400">${isAdminMode ? 'Можно отдыхать или нажать «➕ Пара» выше, чтобы добавить занятие.' : 'В этот день занятий по расписанию нет — можно отдыхать и готовиться к сессии.'}</div>
      </div>
    `;
  }

  document.getElementById('dayDetailContainer').innerHTML = html;
}

function renderBottomSections() {
  document.getElementById('examsCountLabel').textContent = EXAMS.length;
  document.getElementById('shiftsCountLabel').textContent = WORK_SHIFTS_24H.length;

  const examsBox = document.getElementById('bottomTabExams');
  if (EXAMS.length === 0) {
    examsBox.innerHTML = `<div class="col-span-full text-center text-xs text-gray-400 py-6">Список зачётов и экзаменов пуст. Нажми «➕ Добавить контроль», чтобы создать запись.</div>`;
  } else {
    examsBox.innerHTML = EXAMS.map((ex, idx) => {
      const isEx = ex.type === 'экз';
      const noteView = formatExamNoteForView(ex.note);
      return `
        <div class="p-3.5 rounded-xl bg-gray-900/80 border ${isEx ? 'border-rose-500/40 hover:border-rose-400' : 'border-purple-500/40 hover:border-purple-400'} transition flex flex-col justify-between gap-2">
          <div>
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <span onclick="selectDay('${ex.date}')" class="cursor-pointer font-mono text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded">${toRuShortDate(ex.date)} • ${ex.time}</span>
              <div class="flex items-center gap-1">
                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded ${isEx ? 'badge-exam' : 'badge-zach'}">${ex.label}</span>
                ${isAdminMode ? `
                <button onclick='openEventModal("exam", {type:"exam", index:${idx}})' class="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-xs" title="Редактировать">✏️</button>
                <button onclick="deleteExamEvent(${idx})" class="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/35 text-rose-300 text-xs" title="Удалить">🗑️</button>
                ` : ''}
              </div>
            </div>
            <div onclick="selectDay('${ex.date}')" class="cursor-pointer font-bold text-sm text-white hover:text-indigo-300 transition">${ex.subject}</div>
            <div class="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-1">
              <button type="button" onclick='openTeacherByScheduleName(${JSON.stringify(ex.teacher)})' class="text-indigo-300 hover:text-indigo-200 underline decoration-indigo-500/40 font-medium">${ex.teacher}</button>
              <span>• Каб: ${ex.room}</span>
            </div>
          </div>
          ${noteView ? `
          <div class="text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
            ${noteView}
          </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  const conflictsBox = document.getElementById('bottomTabConflicts');
  if (WORK_SHIFTS_24H.length === 0) {
    conflictsBox.innerHTML = `<div class="col-span-full text-center text-xs text-gray-400 py-6">Рабочие смены не отмечены.</div>`;
  } else {
    conflictsBox.innerHTML = WORK_SHIFTS_24H.map((iso, idx) => {
      const dClasses = CLASSES[iso] || [];
      const dExams = EXAMS.filter(e => e.date === iso);
      const nextIdx = SESSION_DATES.indexOf(iso) + 1;
      const nextIso = nextIdx > 0 && nextIdx < SESSION_DATES.length ? SESSION_DATES[nextIdx] : null;
      const nextExams = nextIso ? EXAMS.filter(e => e.date === nextIso) : [];

      let details = `В день заступления (${toRuShortDate(iso)}): пар — <b>${dClasses.length}</b>`;
      if (dExams.length > 0) {
        details += `, 🛑 <b>${dExams.map(e => `${e.label} по «${e.subject}» в ${e.time}`).join(', ')}</b>`;
      }
      if (nextExams.length > 0) {
        details += `. На следующее утро (${toRuShortDate(nextIso)} после смены в 09:00): ⚠️ <b>${nextExams.map(e => `${e.label} по «${e.subject}» в ${e.time}`).join(', ')}</b>`;
      }

      return `
        <div class="p-3.5 rounded-xl bg-gray-900/80 border border-amber-500/30 hover:border-amber-400 transition space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span onclick="selectDay('${iso}')" class="cursor-pointer font-bold text-sm text-amber-300 hover:underline">
              🛠️ Смена №${idx + 1}: ${toRuShortDate(iso)} (09:00 – 09:00)
            </span>
            <button onclick="toggleWorkShiftForDay('${iso}')" class="px-2 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 text-xs">
              🗑️ Удалить
            </button>
          </div>
          <div class="text-xs text-gray-300 leading-relaxed">${details}.</div>
        </div>
      `;
    }).join('');
  }
}


// ============================================================================
// 7. НАВИГАЦИЯ, КОПИРОВАНИЕ И ИНИЦИАЛИЗАЦИЯ
// ============================================================================
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function selectDay(iso) {
  if (!SESSION_DATES.includes(iso)) return;
  selectedIso = iso;
  renderCalendarGrid();
  renderQuickDayStrip();
  renderSelectedDaySummary();

  const stripBtn = document.getElementById(`stripDay_${iso}`);
  if (stripBtn) {
    stripBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function stepSelectedDay(delta) {
  const idx = SESSION_DATES.indexOf(selectedIso);
  const nextIdx = idx + delta;
  if (nextIdx >= 0 && nextIdx < SESSION_DATES.length) {
    selectDay(SESSION_DATES[nextIdx]);
  }
}

function selectToday() {
  const nowIso = toIsoDate(getMinskNow());
  if (SESSION_DATES.includes(nowIso)) {
    selectDay(nowIso);
  } else {
    selectDay('2026-10-26');
  }
}

let currentBottomTab = 'exams';

function switchBottomTab(tab) {
  currentBottomTab = tab;
  const isExams = tab === 'exams';
  const isConflicts = tab === 'conflicts';
  const isTeachers = tab === 'teachers';

  document.getElementById('bottomTabExams').classList.toggle('hidden', !isExams);
  document.getElementById('bottomTabConflicts').classList.toggle('hidden', !isConflicts);
  const tBox = document.getElementById('bottomTabTeachers');
  if (tBox) tBox.classList.toggle('hidden', !isTeachers);

  const activeCls = 'px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 text-white transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20';
  const inactiveCls = 'px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition flex items-center gap-1.5';

  document.getElementById('tabBtnExams').className = isExams ? activeCls : inactiveCls;
  document.getElementById('tabBtnConflicts').className = isConflicts ? activeCls : inactiveCls;
  const tBtn = document.getElementById('tabBtnTeachers');
  if (tBtn) tBtn.className = isTeachers ? activeCls : inactiveCls;

  if (isTeachers) {
    renderTeachersSection();
  }
}

function openTeachersSection() {
  switchBottomTab('teachers');
  scrollToSection('sectionExamsList');
}

function toggleTimeMachine() {
  document.getElementById('timeMachineDrawer').classList.toggle('hidden');
}

function setSim(isoDateTime) {
  simDateObj = new Date(isoDateTime);
  document.getElementById('simIndicator').textContent = `Симуляция: ${isoDateTime.replace('T', ' ')}`;
  document.getElementById('simIndicator').className = 'px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] sm:text-[11px]';
  const simDay = isoDateTime.split('T')[0];
  if (SESSION_DATES.includes(simDay)) selectedIso = simDay;
  refreshAllViews();
}

function resetSim() {
  simDateObj = null;
  document.getElementById('simIndicator').textContent = 'Реальное время Минска';
  document.getElementById('simIndicator').className = 'px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] sm:text-[11px]';
  selectToday();
  refreshAllViews();
}

function copyTemplateText() {
  copyTextFallback(plainReportForCopy);
  const btn = document.getElementById('copyBtn');
  btn.textContent = '✅ Скопировано!';
  showToast('📋 Сводка скопирована в буфер обмена');
  setTimeout(() => { btn.textContent = '📋 Копировать'; }, 2000);
}

function refreshAllViews() {
  renderAssistantTemplate();
  renderCalendarGrid();
  renderQuickDayStrip();
  renderSelectedDaySummary();
  renderBottomSections();
  renderTeachersSection();
}


