// ============================================================================
// МОДУЛЬ 3: СПРАВОЧНИК ПРЕПОДАВАТЕЛЕЙ ЮРФАКА БГУ (js/teachers.js)
// Данные преподавателей загружаются из файла data/teachers.json
// ============================================================================
function getTeacherInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (fullName || 'БГУ').slice(0, 2).toUpperCase();
}

// Точный расчёт пар и наличия зачёта/экзамена ИМЕННО НА ДАННОЙ СЕССИИ по расписанию (EXAMS и CLASSES)
function getTeacherScheduleStats(teacherObj) {
  const pairs = [];
  for (const iso of SESSION_DATES) {
    const dayArr = CLASSES[iso] || [];
    dayArr.forEach((c, idx) => {
      const tName = (c.teacher || '').toLowerCase();
      const matched = teacherObj.matchKeys.some(k => tName.includes(k.toLowerCase())) ||
                      (c.subject && c.subject.toLowerCase() === teacherObj.subject1B.toLowerCase());
      if (matched) {
        pairs.push({ iso, ...c, index: idx });
      }
    });
  }

  const exams = EXAMS.filter(ex => {
    const tName = (ex.teacher || '').toLowerCase();
    return teacherObj.matchKeys.some(k => tName.includes(k.toLowerCase())) ||
           (ex.subject && ex.subject.toLowerCase() === teacherObj.subject1B.toLowerCase());
  });

  // Определяем точный статус аттестации на ЭТОЙ сессии:
  // 'экз' — сдаём экзамен на этой сессии (Гавриленко, Федчук, Слуцкая)
  // 'зач' — сдаём зачёт на этой сессии (Краснобаева, Пилипенко, Юсупов, Абраменко)
  // 'none' — на этой сессии только начитка пар (сдача в следующую сессию)
  let sessionControlStatus = 'none';
  if (exams.some(e => e.type === 'экз')) {
    sessionControlStatus = 'экз';
  } else if (exams.some(e => e.type === 'зач')) {
    sessionControlStatus = 'зач';
  }

  return { pairs, exams, sessionControlStatus };
}

function getEffectiveTeacherPhoto(teacherObj) {
  if (TEACHER_USER_PHOTOS[teacherObj.id]) {
    return TEACHER_USER_PHOTOS[teacherObj.id];
  }
  return teacherObj.photoUrl || '';
}

function handleTeacherImgError(imgEl, teacherId) {
  const t = BSU_TEACHERS_DB.find(x => x.id === teacherId);
  if (!t) return;
  const triedFallback = imgEl.getAttribute('data-tried-fallback');
  if (!triedFallback && t.fallbackPhotoUrl && imgEl.src !== t.fallbackPhotoUrl) {
    imgEl.setAttribute('data-tried-fallback', '1');
    imgEl.src = t.fallbackPhotoUrl;
    return;
  }
  imgEl.classList.add('hidden');
  const fallbackBox = document.getElementById(`avatarFallback_${teacherId}`);
  if (fallbackBox) fallbackBox.classList.remove('hidden');
  const modalFallbackBox = document.getElementById(`modalAvatarFallback_${teacherId}`);
  if (modalFallbackBox) modalFallbackBox.classList.remove('hidden');
}

function setTeacherFilter(filterKey) {
  activeTeacherFilter = filterKey;
  const filters = ['all', 'session_all', 'exam', 'zach', 'lect_only', 'polit', 'law'];
  filters.forEach(f => {
    const btn = document.getElementById(`tFilter_${f}`);
    if (!btn) return;
    if (f === filterKey) {
      btn.className = 'shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white transition shadow-md shadow-indigo-600/25';
    } else {
      btn.className = 'shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition';
    }
  });
  renderTeachersSection();
}

function clearTeacherSearch() {
  const inp = document.getElementById('teacherSearchInput');
  if (inp) inp.value = '';
  renderTeachersSection();
}

function renderTeachersSection() {
  const countLbl = document.getElementById('teachersCountLabel');
  if (countLbl) countLbl.textContent = BSU_TEACHERS_DB.length;

  const grid = document.getElementById('teachersCardsGrid');
  if (!grid) return;

  // Обновляем счётчики на кнопках фильтров динамически по текущему расписанию EXAMS
  const enrichedList = BSU_TEACHERS_DB.map(t => ({
    teacher: t,
    stats: getTeacherScheduleStats(t)
  }));

  const countExamNow = enrichedList.filter(x => x.stats.sessionControlStatus === 'экз').length;
  const countZachNow = enrichedList.filter(x => x.stats.sessionControlStatus === 'зач').length;
  const countSessionAll = countExamNow + countZachNow;
  const countLectOnly = enrichedList.filter(x => x.stats.sessionControlStatus === 'none').length;

  const btnSessionAll = document.getElementById('tFilter_session_all');
  if (btnSessionAll) btnSessionAll.textContent = `🔥 Сдача на этой сессии (${countSessionAll})`;
  const btnExam = document.getElementById('tFilter_exam');
  if (btnExam) btnExam.textContent = `🛑 Принимают экзамен (${countExamNow})`;
  const btnZach = document.getElementById('tFilter_zach');
  if (btnZach) btnZach.textContent = `🎓 Принимают зачёт сейчас (${countZachNow})`;
  const btnLectOnly = document.getElementById('tFilter_lect_only');
  if (btnLectOnly) btnLectOnly.textContent = `📚 Только начитка пар (${countLectOnly})`;

  const searchInput = document.getElementById('teacherSearchInput');
  const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const clearBtn = document.getElementById('clearTeacherSearchBtn');
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !query);
  }

  const filtered = enrichedList.filter(({ teacher: t, stats }) => {
    if (activeTeacherFilter === 'session_all' && stats.sessionControlStatus === 'none') return false;
    if (activeTeacherFilter === 'exam' && stats.sessionControlStatus !== 'экз') return false;
    if (activeTeacherFilter === 'zach' && stats.sessionControlStatus !== 'зач') return false;
    if (activeTeacherFilter === 'lect_only' && stats.sessionControlStatus !== 'none') return false;
    if (activeTeacherFilter === 'polit' && t.deptCategory !== 'polit') return false;
    if (activeTeacherFilter === 'law' && t.deptCategory !== 'law') return false;

    if (query) {
      const hay = `${t.fullName} ${t.shortName} ${t.subject1B} ${t.department} ${t.degree} ${t.bio} ${t.interests.join(' ')}`.toLowerCase();
      return hay.includes(query);
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full p-8 rounded-2xl bg-gray-900/60 border border-white/10 text-center space-y-2">
        <div class="text-2xl">🔍</div>
        <div class="text-sm font-bold text-white">Преподаватели по заданному фильтру не найдены</div>
        <div class="text-xs text-gray-400">Попробуй изменить поисковый запрос или переключить фильтр выше.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(({ teacher: t, stats }) => {
    const status = stats.sessionControlStatus; // 'экз' | 'зач' | 'none'
    const initials = getTeacherInitials(t.fullName);
    const photoSrc = getEffectiveTeacherPhoto(t);
    const hasPhoto = Boolean(photoSrc);
    const userNote = TEACHER_USER_NOTES[t.id] || '';
    const examInfo = stats.exams[0];

    let statusBadgeHtml = '';
    let cardBorderCls = 'border-white/10 hover:border-indigo-500/50';
    if (status === 'экз') {
      statusBadgeHtml = `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full badge-exam">🛑 Экзамен на этой сессии</span>`;
      cardBorderCls = 'border-rose-500/35 hover:border-rose-400/70';
    } else if (status === 'зач') {
      statusBadgeHtml = `<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full badge-zach">🎓 Зачёт на этой сессии</span>`;
      cardBorderCls = 'border-purple-500/35 hover:border-purple-400/70';
    } else {
      statusBadgeHtml = `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">📚 Начитка пар (без сдачи сейчас)</span>`;
    }

    let scheduleNoteHtml = '';
    if (examInfo) {
      const isEx = examInfo.type === 'экз';
      scheduleNoteHtml = `
        <div onclick="selectDay('${examInfo.date}'); scrollToSection('sectionDayDetail');" class="cursor-pointer pt-1 text-[11px] font-bold ${isEx ? 'text-rose-300' : 'text-purple-300'} hover:underline flex items-center gap-1">
          <span>🗓️ Сдача: ${toRuShortDate(examInfo.date)} в ${examInfo.time} (${examInfo.label}, Каб: ${examInfo.room})</span>
        </div>
      `;
    } else {
      scheduleNoteHtml = `
        <div class="text-[11px] text-sky-300/90 pt-0.5">
          ℹ️ На этой сессии только учебные пары (${stats.pairs.length} п.) — зачёт в следующую сессию
        </div>
      `;
    }

    return `
      <div class="rounded-2xl bg-gray-900/85 border ${cardBorderCls} transition p-4 flex flex-col justify-between gap-3 shadow-lg">
        <div class="space-y-3">
          <!-- Верхняя часть карточки: Фото + ФИО + Регалии -->
          <div class="flex items-start gap-3.5">
            <div onclick="openTeacherModal('${t.id}')" class="relative w-16 h-20 sm:w-20 sm:h-24 rounded-2xl overflow-hidden shrink-0 border border-white/15 bg-gray-950 cursor-pointer group shadow-md" title="${t.photoNote || 'Нажми для открытия досье'}">
              ${hasPhoto ? `
                <img
                  src="${photoSrc}"
                  alt="${t.fullName}"
                  onerror="handleTeacherImgError(this, '${t.id}')"
                  class="w-full h-full object-cover object-top group-hover:scale-105 transition duration-300"
                />
              ` : ''}
              <div id="avatarFallback_${t.id}" class="${hasPhoto ? 'hidden' : ''} absolute inset-0 bg-gradient-to-br ${t.avatarGradient} flex flex-col items-center justify-center text-white font-extrabold p-1 text-center">
                <span class="text-lg sm:text-xl tracking-wider">${initials}</span>
                <span class="text-[8px] font-mono uppercase opacity-90 leading-tight mt-0.5">${hasPhoto ? 'ЮФ БГУ' : 'Нет фото на БГУ'}</span>
              </div>
              <div class="absolute bottom-0 inset-x-0 bg-black/70 backdrop-blur-xs text-[8px] sm:text-[9px] text-center py-0.5 text-gray-200 font-mono">
                ${hasPhoto ? 'Фото БГУ' : '📷 +Фото'}
              </div>
            </div>

            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                ${statusBadgeHtml}
                <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                  Пар: <b>${stats.pairs.length}</b>
                </span>
              </div>

              <h4 onclick="openTeacherModal('${t.id}')" class="font-extrabold text-sm sm:text-base text-white hover:text-indigo-300 cursor-pointer leading-snug transition">
                ${t.fullName}
              </h4>

              <p class="text-[11px] text-indigo-300 font-semibold leading-tight">${t.degree} • ${t.rank}</p>
              <p class="text-[11px] text-gray-400 leading-tight">${t.department}</p>
            </div>
          </div>

          <!-- Дисциплина у 1Б и статус на текущей сессии -->
          <div class="p-2.5 rounded-xl bg-gray-950/90 border border-white/10 space-y-1">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Дисциплина у 1Б:</span>
              <span class="text-[10px] font-mono text-gray-400">По плану: (${t.planControlType})</span>
            </div>
            <div class="text-xs sm:text-sm font-bold text-white">
              📚 ${t.subject1B}
            </div>
            ${scheduleNoteHtml}
          </div>

          <!-- Краткая биография -->
          <p class="text-xs text-gray-300 leading-relaxed line-clamp-3">
            ${t.bio}
          </p>

          <!-- Теги научных интересов -->
          <div class="flex flex-wrap gap-1">
            ${t.interests.slice(0, 3).map(tag => `
              <span class="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-200 border border-indigo-500/20">
                ${tag}
              </span>
            `).join('')}
          </div>

          ${userNote ? `
            <div class="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
              📌 <b>Твоя заметка:</b> ${userNote}
            </div>
          ` : ''}
        </div>

        <!-- Нижняя панель контактов и кнопки досье -->
        <div class="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <a href="${t.profileUrl}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-gray-400 hover:text-indigo-300 underline truncate" title="Открыть официальный источник">
            🏛️ Источник БГУ / Scholar ↗
          </a>
          <button type="button" onclick="openTeacherModal('${t.id}')" class="px-3 py-1.5 rounded-xl bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/35 text-xs font-bold transition shrink-0">
            📖 Досье и пары (${stats.pairs.length})
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openTeacherByScheduleName(rawTeacherName) {
  if (!rawTeacherName) return;
  const clean = rawTeacherName.toLowerCase();
  const found = BSU_TEACHERS_DB.find(t =>
    t.matchKeys.some(k => clean.includes(k.toLowerCase())) ||
    t.shortName.toLowerCase() === clean
  );
  if (found) {
    openTeacherModal(found.id);
  } else {
    openTeachersSection();
    showToast(`ℹ️ Показан список преподавателей Юрфака БГУ`);
  }
}

function openTeacherModal(teacherId) {
  const t = BSU_TEACHERS_DB.find(x => x.id === teacherId);
  if (!t) return;

  const stats = getTeacherScheduleStats(t);
  const status = stats.sessionControlStatus; // 'экз' | 'зач' | 'none'
  const initials = getTeacherInitials(t.fullName);
  const photoSrc = getEffectiveTeacherPhoto(t);
  const hasPhoto = Boolean(photoSrc);
  const savedNote = TEACHER_USER_NOTES[t.id] || '';

  let modalStatusBadge = '';
  if (status === 'экз') {
    modalStatusBadge = `<span class="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full badge-exam">🛑 Принимает ЭКЗАМЕН на этой сессии</span>`;
  } else if (status === 'зач') {
    modalStatusBadge = `<span class="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full badge-zach">🎓 Принимает ЗАЧЁТ на этой сессии</span>`;
  } else {
    modalStatusBadge = `<span class="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">📚 На этой сессии только начитка пар (сдача в след. сессию)</span>`;
  }

  const pairsHtml = stats.pairs.length > 0
    ? stats.pairs.map((p, i) => `
        <div onclick="closeTeacherModal(); selectDay('${p.iso}'); scrollToSection('sectionDayDetail');" class="cursor-pointer p-2.5 rounded-xl bg-gray-900/90 hover:bg-indigo-950/60 border border-white/10 hover:border-indigo-500/40 transition flex items-center justify-between gap-2">
          <div class="text-xs">
            <span class="font-mono font-bold text-indigo-300">${i + 1}. ${toRuShortDate(p.iso)} (${DAYS_SHORT[parseIsoLocal(p.iso).getDay()]})</span>
            <span class="text-gray-300 ml-1.5">${p.start.replace(':','.')}–${p.end.replace(':','.')}</span>
            <div class="text-[11px] text-gray-400 mt-0.5">${p.subject} (по плану: ${p.control})</div>
          </div>
          <span class="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
            Каб ${p.room}
          </span>
        </div>
      `).join('')
    : `<div class="text-xs text-gray-400 py-2">Учебных пар в текущем окне расписания не найдено.</div>`;

  const examsHtml = stats.exams.length > 0
    ? stats.exams.map(ex => {
        const noteText = formatExamNoteForView(ex.note);
        return `
        <div onclick="closeTeacherModal(); selectDay('${ex.date}'); scrollToSection('sectionDayDetail');" class="cursor-pointer p-3 rounded-xl ${ex.type === 'экз' ? 'badge-exam' : 'badge-zach'} flex items-center justify-between gap-2">
          <div>
            <div class="text-xs font-extrabold uppercase">⚠️ ${ex.label} НА ЭТОЙ СЕССИИ • ${toRuShortDate(ex.date)} в ${ex.time}</div>
            <div class="text-xs mt-0.5">${ex.subject} • Каб: <b>${ex.room}</b></div>
            ${noteText ? `<div class="text-[11px] text-amber-200 mt-0.5">${noteText}</div>` : ''}
          </div>
          <span class="text-xs font-bold underline shrink-0">К дате →</span>
        </div>
      `;
      }).join('')
    : `
      <div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200">
        ℹ️ <b>Статус на текущей сессии (26.10 – 15.11.2026):</b> в ведомости сдачи текущей сессии зачёта или экзамена у этого преподавателя <b>нет</b> — сейчас проходит только начитка учебных пар (${stats.pairs.length} п.), а сдача зачёта будет на следующей сессии.
      </div>
    `;

  const box = document.getElementById('teacherModalContent');
  box.innerHTML = `
    <div class="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          🏛️ Юридический факультет БГУ
        </span>
        ${modalStatusBadge}
      </div>
      <button type="button" onclick="closeTeacherModal()" class="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 flex items-center justify-center text-lg shrink-0">✕</button>
    </div>

    <!-- Шапка профиля с фото -->
    <div class="flex flex-col sm:flex-row items-center sm:items-start gap-4">
      <div class="flex flex-col items-center gap-2 shrink-0">
        <div class="relative w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 border-indigo-500/40 bg-gray-950 shadow-xl">
          ${hasPhoto ? `
            <img
              id="modalTeacherImg_${t.id}"
              src="${photoSrc}"
              alt="${t.fullName}"
              onerror="handleTeacherImgError(this, '${t.id}')"
              class="w-full h-full object-cover object-top"
            />
          ` : ''}
          <div id="modalAvatarFallback_${t.id}" class="${hasPhoto ? 'hidden' : ''} absolute inset-0 bg-gradient-to-br ${t.avatarGradient} flex flex-col items-center justify-center text-white font-extrabold p-2 text-center">
            <span class="text-3xl tracking-wider">${initials}</span>
            <span class="text-[9px] font-mono uppercase opacity-90 mt-1 leading-tight">${hasPhoto ? 'Юрфак БГУ' : 'Фото не размещено на law.bsu.by'}</span>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <label class="cursor-pointer px-2.5 py-1 rounded-lg bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 text-[10px] font-semibold text-indigo-200 transition">
            📷 Загрузить фото
            <input type="file" accept="image/*" class="hidden" onchange="uploadCustomTeacherPhoto(event, '${t.id}')" />
          </label>
          ${TEACHER_USER_PHOTOS[t.id] ? `
            <button type="button" onclick="resetCustomTeacherPhoto('${t.id}')" class="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 text-[10px]" title="Сбросить загруженное фото">✕</button>
          ` : ''}
        </div>
      </div>

      <div class="space-y-2 text-center sm:text-left flex-1">
        <h3 class="text-base sm:text-xl font-extrabold text-white">${t.fullName}</h3>
        <div class="text-xs sm:text-sm font-semibold text-indigo-300">${t.position}</div>
        <div class="text-xs text-gray-300">🎓 <b>Учёная степень и звание:</b> ${t.degree}, ${t.rank}</div>
        <div class="text-xs text-gray-300">🏛️ <b>Подразделение:</b> ${t.department}</div>
        <div class="text-xs text-gray-300">📚 <b>Дисциплина у 1Б:</b> <span class="text-white font-bold">${t.subject1B}</span></div>
        <div class="text-xs text-gray-300">📍 <b>Адрес и телефон:</b> ${t.office} • <span class="font-mono text-emerald-300">${t.phone}</span></div>
        <div class="text-xs text-gray-300">✉️ <b>E-mail:</b> <span class="font-mono text-indigo-200">${t.email}</span></div>
        ${t.photoNote && !TEACHER_USER_PHOTOS[t.id] ? `
          <div class="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg">
            ℹ️ ${t.photoNote}
          </div>
        ` : ''}
        <div class="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
          <a href="${t.profileUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md">
            🌐 Открыть официальный профиль ↗
          </a>
          ${t.secondaryUrl ? `
            <a href="${t.secondaryUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-semibold transition">
              🏛️ Страница на БГУ ↗
            </a>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- Биография и научная деятельность -->
    <div class="p-3.5 rounded-xl bg-gray-950/90 border border-white/10 space-y-2">
      <div class="text-xs font-bold uppercase tracking-wider text-indigo-300">📋 Проверенная биография и карьера (БГУ):</div>
      <p class="text-xs sm:text-sm text-gray-200 leading-relaxed">${t.bio}</p>
      <div class="pt-1 text-xs text-gray-300">
        <b>📚 Основные труды и УМК:</b> ${t.publications}
      </div>
    </div>

    <!-- Научные интересы -->
    <div class="space-y-1.5">
      <div class="text-xs font-bold uppercase tracking-wider text-gray-400">🔬 Сфера научных интересов:</div>
      <div class="flex flex-wrap gap-1.5">
        ${t.interests.map(tag => `
          <span class="text-xs px-2.5 py-1 rounded-xl bg-indigo-500/15 text-indigo-200 border border-indigo-500/30 font-medium">
            ${tag}
          </span>
        `).join('')}
      </div>
    </div>

    <!-- Расписание сдачи и пар у группы 1Б -->
    <div class="space-y-2">
      <div class="text-xs font-bold uppercase tracking-wider text-emerald-300">
        🗓️ Аттестация на этой сессии и расписание пар у 1Б (${stats.pairs.length} пар):
      </div>
      ${examsHtml}
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
        ${pairsHtml}
      </div>
    </div>

    <!-- Личная заметка студента о требованиях преподавателя -->
    <div class="p-3.5 rounded-xl bg-gray-950/90 border border-white/10 space-y-2">
      <label class="block text-xs font-bold text-amber-300">📌 Личная заметка (требования к зачёту/экзамену, вопросы, консультации):</label>
      <div class="flex flex-col sm:flex-row gap-2">
        <input type="text" id="teacherNoteInput_${t.id}" value="${savedNote.replace(/"/g, '&quot;')}" placeholder="Например: Принести распечатку кодекса / Автомат за активную работу на семинарах" class="flex-1 rounded-xl bg-gray-900 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
        <button type="button" onclick="saveTeacherCustomNote('${t.id}')" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shrink-0 transition">
          💾 Сохранить заметку
        </button>
      </div>
    </div>

    <div class="pt-2 border-t border-white/10 flex justify-end">
      <button type="button" onclick="closeTeacherModal()" class="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition">
        Закрыть
      </button>
    </div>
  `;

  document.getElementById('teacherProfileModal').classList.remove('hidden');
}

function closeTeacherModal() {
  document.getElementById('teacherProfileModal').classList.add('hidden');
}

function saveTeacherCustomNote(teacherId) {
  const inp = document.getElementById(`teacherNoteInput_${teacherId}`);
  if (!inp) return;
  const val = inp.value.trim();
  if (val) {
    TEACHER_USER_NOTES[teacherId] = val;
  } else {
    delete TEACHER_USER_NOTES[teacherId];
  }
  localStorage.setItem(STORAGE_KEY_TEACHER_NOTES, JSON.stringify(TEACHER_USER_NOTES));
  renderTeachersSection();
  showToast('✅ Заметка о преподавателе сохранена');
}

async function uploadCustomTeacherPhoto(event, teacherId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const { base64Data, mimeType } = await compressAndConvertImage(file);
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    TEACHER_USER_PHOTOS[teacherId] = dataUri;
    localStorage.setItem(STORAGE_KEY_TEACHER_PHOTOS, JSON.stringify(TEACHER_USER_PHOTOS));
    openTeacherModal(teacherId);
    renderTeachersSection();
    showToast('📷 Фотография преподавателя сохранена');
  } catch (e) {
    showToast('❌ Не удалось загрузить фото', true);
  }
}

function resetCustomTeacherPhoto(teacherId) {
  delete TEACHER_USER_PHOTOS[teacherId];
  localStorage.setItem(STORAGE_KEY_TEACHER_PHOTOS, JSON.stringify(TEACHER_USER_PHOTOS));
  openTeacherModal(teacherId);
  renderTeachersSection();
  showToast('🔄 Восстановлено стандартное изображение');
}


