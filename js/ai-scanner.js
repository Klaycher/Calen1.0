// ============================================================================
// МОДУЛЬ 6: AI-СКАНЕР ФОТО GEMINI И УМНОЕ СЛИЯНИЕ ПАР/ЭКЗАМЕНОВ (js/ai-scanner.js)
// ============================================================================
function sanitizeGeminiKey(raw) {
  if (!raw) return '';
  let clean = raw.replace(/[\s"'`«»\u200B-\u200D\uFEFF]+/g, '').trim();
  const match = clean.match(/AIza[0-9A-Za-z\-_]{25,}/);
  if (match) return match[0];
  return clean;
}

function onApiKeyInput() {
  const input = document.getElementById('geminiApiKeyInput');
  const cleaned = sanitizeGeminiKey(input.value);
  if (cleaned) {
    localStorage.setItem(STORAGE_KEY_API, cleaned);
  }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('geminiApiKeyInput');
  input.type = input.type === 'password' ? 'text' : 'password';
}

            async function discoverAvailableGeminiModels(apiKey) {
  // Базовые модели для генерации текста и фото
  const defaultModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ];

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    const data = await resp.json();

    if (resp.ok && Array.isArray(data.models)) {
      const valid = data.models
        .filter(m => {
          const name = (m.name || '').toLowerCase();
          const methods = m.supportedGenerationMethods || [];
          return (
            methods.includes('generateContent') &&
            name.includes('gemini') &&
            name.includes('flash') &&
            !name.includes('tts') &&
            !name.includes('audio') &&
            !name.includes('computer-use') &&
            !name.includes('embedding') &&
            !name.includes('imagen') &&
            !name.includes('preview') &&
            !name.includes('exp') &&
            !name.includes('2.0') &&
            !name.includes('2.5') &&
            !name.includes('1.5')
          );
        })
        .map(m => m.name.replace(/^models\//, ''));

      if (valid.length > 0) {
        // Приоритет проверенным легковесным моделям
        const ordered = [...new Set([...defaultModels.filter(m => valid.includes(m)), ...valid])];
        return ordered;
      }
    }
  } catch (e) {}

  return defaultModels;
}

async function callGeminiWithFallback(apiKey, contentsPayload, useJsonConfig = true) {
  const models = await discoverAvailableGeminiModels(apiKey);
  let lastErrorMsg = 'Все модели временно перегружены';

  for (const modelName of models) {
    try {
      const bodyObj = { contents: contentsPayload };
      if (useJsonConfig) {
        bodyObj.generationConfig = { temperature: 0.1 };
      }

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        const errMsg = data?.error?.message || `HTTP ${resp.status}`;
        lastErrorMsg = `[${modelName}] ${errMsg}`;

        if (errMsg.includes('API key not valid')) {
          throw new Error('API-ключ недействителен. Проверь ключ на aistudio.google.com/apikey');
        }
        continue;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        window.CURRENT_GEMINI_MODEL = modelName;
        return { text, modelName };
      }
    } catch (err) {
      if (err.message.includes('недействителен')) throw err;
      lastErrorMsg = err.message || String(err);
    }
  }

  throw new Error(lastErrorMsg);
}

async function testGeminiApiKey() {
  const input = document.getElementById('geminiApiKeyInput');
  const rawKey = sanitizeGeminiKey(input.value);
  input.value = rawKey;

  if (!rawKey) {
    showSyncMessage('⚠️ Введи свой Gemini API Key в поле выше.', true);
    return;
  }

  const btn = document.getElementById('testApiKeyBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Проверка...';
  showSyncMessage('🔍 Запрашиваем список доступных моделей для твоего ключа...');

  try {
    const result = await callGeminiWithFallback(rawKey, [
      { parts: [{ text: 'Ответь одним словом: ОК' }] }
    ], false);

    localStorage.setItem(STORAGE_KEY_API, rawKey);
    showSyncMessage(`✅ Ключ успешно проверен и сохранён! Активная модель: <b>${result.modelName}</b>.`);
    showToast(`✅ Ключ рабочий (${result.modelName})`);
  } catch (err) {
    showSyncMessage(`❌ Ошибка проверки ключа: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔑 Проверить';
  }
}

function openSyncModal() {
  if (!isAdminMode) {
    handleAdminAuthClick();
    return;
  }
  document.getElementById('syncModal').classList.remove('hidden');
  const savedKey = localStorage.getItem(STORAGE_KEY_API) || '';
  document.getElementById('geminiApiKeyInput').value = savedKey;
  populateGithubInputs();
}

function closeSyncModal() {
  document.getElementById('syncModal').classList.add('hidden');
  document.getElementById('syncStatusMsg').classList.add('hidden');
}

function switchSyncTab(tab) {
  const isGh = tab === 'github';
  const isAi = tab === 'ai';
  const isJson = tab === 'json';

  const ghBody = document.getElementById('syncTabGithubBody');
  if (ghBody) ghBody.classList.toggle('hidden', !isGh);
  document.getElementById('syncTabAiBody').classList.toggle('hidden', !isAi);
  document.getElementById('syncTabJsonBody').classList.toggle('hidden', !isJson);

  const ghBtn = document.getElementById('syncTabGithubBtn');
  if (ghBtn) {
    ghBtn.className = isGh
      ? 'py-2 px-2 rounded-lg text-[11px] sm:text-xs font-bold bg-emerald-600 text-white transition'
      : 'py-2 px-2 rounded-lg text-[11px] sm:text-xs font-bold text-gray-400 hover:text-white transition';
  }
  document.getElementById('syncTabAiBtn').className = isAi
    ? 'py-2 px-2 rounded-lg text-[11px] sm:text-xs font-bold bg-purple-600 text-white transition'
    : 'py-2 px-2 rounded-lg text-[11px] sm:text-xs font-bold text-gray-400 hover:text-white transition';
  document.getElementById('syncTabJsonBtn').className = isJson
    ? 'py-2 px-2 rounded-lg text-[11px] sm:text-xs font-bold bg-indigo-600 text-white transition'
    : 'py-2 px-2 rounded-lg text-[11px] sm:text-xs font-bold text-gray-400 hover:text-white transition';
}

function showSyncMessage(text, isError = false) {
  const box = document.getElementById('syncStatusMsg');
  box.classList.remove('hidden');
  box.className = `p-3 rounded-xl text-xs font-medium leading-relaxed break-words ${isError ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'}`;
  box.innerHTML = text;
}

let currentAiScanMode = 'auto'; // 'auto' | 'classes' | 'exams'


function setAiScanMode(mode) {
  currentAiScanMode = mode || 'auto';
  const modes = ['auto', 'classes', 'exams'];
  modes.forEach(m => {
    const btn = document.getElementById(`aiScanMode_${m}`);
    if (!btn) return;
    btn.className = (m === currentAiScanMode)
      ? 'py-2 px-2 rounded-lg text-[11px] font-bold bg-purple-600 text-white transition shadow-sm'
      : 'py-2 px-2 rounded-lg text-[11px] font-bold text-gray-400 hover:text-white transition';
  });
  const hint = document.getElementById('aiScanModeHint');
  if (hint) {
    if (currentAiScanMode === 'exams') {
      hint.innerHTML = '🎓 <b>Режим «Зачёты и экзамены»:</b> ИИ обновит кабинеты и время только в карточках зачётов/экзаменов. Обычные учебные пары и их кабинеты останутся нетронутыми!';
    } else if (currentAiScanMode === 'classes') {
      hint.innerHTML = '📚 <b>Режим «Обычные пары»:</b> ИИ обновит сетку дневных/вечерних пар (14:10–20:10) и их кабинеты, не затрагивая ведомость экзаменов.';
    } else {
      hint.innerHTML = '🛡️ <b>Умный авто-режим:</b> ИИ сам отличает расписание пар (14:10–20:10) от расписания зачётов/экзаменов и никогда не удаляет пары при обновлении экзаменов!';
    }
  }
}

function isLikelyExamItem(item, dateIso, dayArrayLength = 0) {
  if (!item || typeof item !== 'object') return false;
  if (item.isExam === true || item.eventType === 'exam') return true;

  const rawStart = normalizeTimeToken(item.start || item.time);
  const rawEnd = normalizeTimeToken(item.end);

  // 1. Утреннее/дневное время начала до 13:30 (все обычные пары у 1Б начинаются с 14:10)
  if (rawStart) {
    const sMin = timeToMin(rawStart);
    if (sMin > 0 && sMin < 13 * 60 + 30) return true;
  }

  // 2. Если есть только одно время (нет времени окончания пары) и это не стандартный слот 14:10/15:50/17:20/18:50
  const isStandardAfternoonStart = ['14:10', '15:50', '17:20', '18:50'].includes(rawStart);
  if (!rawEnd && !isStandardAfternoonStart) {
    return true;
  }

  // 3. Проверяем совпадение предмета с экзаменом/зачётом в этот день
  const subj = item.subject || '';
  const baseDayClasses = (BASELINE_CLASSES_1B && BASELINE_CLASSES_1B[dateIso]) ? BASELINE_CLASSES_1B[dateIso] : [];
  const matchesAfternoonClassOnThatDay = baseDayClasses.some(c => subjectsMatch(c.subject, subj));

  const allExamsRef = (Array.isArray(EXAMS) && EXAMS.length > 0) ? EXAMS : BASELINE_EXAMS_1B;
  const matchesExamOnThatDate = allExamsRef.some(ex => ex.date === dateIso && subjectsMatch(ex.subject, subj));
  if (matchesExamOnThatDate && !matchesAfternoonClassOnThatDay) {
    return true;
  }

  // 4. Если на весь день всего 1 запись, и её предмет совпадает с одним из 7 зачётов/экзаменов сессии, но в этот день нет такой обычной пары
  if (dayArrayLength === 1 && !matchesAfternoonClassOnThatDay) {
    const matchesAnySessionExam = allExamsRef.some(ex => subjectsMatch(ex.subject, subj));
    if (matchesAnySessionExam) return true;
  }

  return false;
}

function upsertExamRecord(examInput) {
  if (!examInput || typeof examInput !== 'object') return { updated: false, exam: null };
  if (!Array.isArray(EXAMS) || EXAMS.length === 0) {
    EXAMS = JSON.parse(JSON.stringify(BASELINE_EXAMS_1B));
  }

  const dateIso = (examInput.date && /^\d{4}-\d{2}-\d{2}$/.test(examInput.date)) ? examInput.date : '';
  const rawTime = normalizeTimeToken(examInput.time || examInput.start);
  const cleanRoom = cleanRoomString(examInput.room);
  const subj = (examInput.subject || '').trim();
  const teacher = (examInput.teacher || '').trim();

  // Ищем подходящий зачёт/экзамен: 1) по дате + предмету, 2) по предмету, 3) по дате (если на дату 1 экзамен)
  let targetExam = null;
  if (dateIso && subj) {
    targetExam = EXAMS.find(e => e.date === dateIso && subjectsMatch(e.subject, subj));
  }
  if (!targetExam && subj) {
    targetExam = EXAMS.find(e => subjectsMatch(e.subject, subj));
  }
  if (!targetExam && dateIso) {
    const sameDateExams = EXAMS.filter(e => e.date === dateIso);
    if (sameDateExams.length === 1) targetExam = sameDateExams[0];
  }

  if (targetExam) {
    let changed = false;
    if (isValidRoomValue(cleanRoom) && targetExam.room !== cleanRoom) {
      targetExam.room = cleanRoom;
      changed = true;
    }
    // Обновляем время только если распознано реальное утреннее время экзамена (до 13:45)
    if (rawTime) {
      const tMin = timeToMin(rawTime);
      if (tMin >= 7 * 60 && tMin <= 13 * 60 + 45 && targetExam.time !== rawTime) {
        targetExam.time = rawTime;
        changed = true;
      }
    }
    if (dateIso && SESSION_DATES.includes(dateIso) && targetExam.date !== dateIso) {
      targetExam.date = dateIso;
      changed = true;
    }
    if (teacher && isValidRoomValue(teacher) && (!targetExam.teacher || targetExam.teacher === 'уточняется')) {
      targetExam.teacher = teacher;
      changed = true;
    }
    EXAMS.sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.time) - timeToMin(b.time));
    return { updated: changed, exam: targetExam, isNew: false };
  }

  // Если это новый зачёт/экзамен, которого ещё не было в списке
  if (dateIso && subj) {
    const rawType = String(examInput.type || examInput.control || '').toLowerCase();
    const type = rawType.includes('экз') ? 'экз' : 'зач';
    const label = type === 'экз' ? 'Экзамен' : 'Зачёт';
    const validMorningTime = (rawTime && timeToMin(rawTime) < 14 * 60) ? rawTime : '09:30';
    const newExam = {
      date: dateIso,
      time: validMorningTime,
      subject: subj,
      type,
      label,
      teacher: teacher || 'уточняется',
      room: isValidRoomValue(cleanRoom) ? cleanRoom : 'уточняется',
      note: examInput.note || 'По расписанию экзаменационной сессии группы 1Б'
    };
    EXAMS.push(newExam);
    EXAMS.sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.time) - timeToMin(b.time));
    return { updated: true, exam: newExam, isNew: true };
  }

  return { updated: false, exam: null };
}

function mergeAfternoonClassesForDay(dateIso, incomingClasses) {
  if (!Array.isArray(incomingClasses) || incomingClasses.length === 0) return false;

  // Нормализуем входящие пары
  const normalizedIncoming = incomingClasses.map(c => {
    const start = normalizeTimeToken(c.start || c.time) || '14:10';
    let end = normalizeTimeToken(c.end) || '';
    if (start === '14:10' && (end === '15:50' || !end)) end = '15:30';
    else if (start === '15:50' && (end === '17:20' || !end)) end = '17:10';
    else if (start === '17:20' && !end) end = '18:40';
    else if (start === '18:50' && !end) end = '20:10';
    else if (!end) end = '15:30';

    const room = cleanRoomString(c.room);
    const baseMatch = ((BASELINE_CLASSES_1B && BASELINE_CLASSES_1B[dateIso]) || []).find(
      b => b.start === start || subjectsMatch(b.subject, c.subject)
    );

    return {
      start,
      end,
      subject: (c.subject || (baseMatch && baseMatch.subject) || 'Дисциплина').trim(),
      control: c.control || (baseMatch && baseMatch.control) || 'зач',
      teacher: (c.teacher && c.teacher !== 'уточняется') ? c.teacher : ((baseMatch && baseMatch.teacher) || 'уточняется'),
      room,
      ...(c.note || (baseMatch && baseMatch.note) ? { note: c.note || baseMatch.note } : {})
    };
  });

  const existingDay = (Array.isArray(CLASSES[dateIso]) && CLASSES[dateIso].length > 0)
    ? CLASSES[dateIso]
    : JSON.parse(JSON.stringify((BASELINE_CLASSES_1B && BASELINE_CLASSES_1B[dateIso]) || []));

  // Если пришло меньше пар, чем обычно в этот день (например, частичное фото), обновляем слоты точечно без удаления остальных пар дня!
  if (existingDay.length > normalizedIncoming.length) {
    const merged = existingDay.map(exCls => ({ ...exCls }));
    normalizedIncoming.forEach(inc => {
      let idx = merged.findIndex(m => m.start === inc.start);
      if (idx === -1) {
        idx = merged.findIndex(m => subjectsMatch(m.subject, inc.subject));
      }
      if (idx >= 0) {
        const prevRoom = merged[idx].room;
        merged[idx] = {
          ...merged[idx],
          ...inc,
          room: isValidRoomValue(inc.room) ? inc.room : (isValidRoomValue(prevRoom) ? prevRoom : 'уточняется')
        };
      } else {
        merged.push(inc);
      }
    });
    merged.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
    CLASSES[dateIso] = merged;
    return true;
  }

  // Если пришёл полный день пар — сохраняем уже известные кабинеты, если в новом скане стоит «уточняется»
  const fullUpdated = normalizedIncoming.map(inc => {
    const prevMatch = existingDay.find(m => m.start === inc.start || subjectsMatch(m.subject, inc.subject));
    const finalRoom = isValidRoomValue(inc.room)
      ? inc.room
      : (prevMatch && isValidRoomValue(prevMatch.room) ? prevMatch.room : 'уточняется');
    return {
      ...inc,
      room: finalRoom
    };
  });
  fullUpdated.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
  CLASSES[dateIso] = fullUpdated;
  return true;
}

function applySmartScheduleUpdate(parsed, mode = 'auto', actionLabel = 'Импорт JSON', modelLabel = '') {
  let updatedClassDays = 0;
  let updatedExamsCount = 0;
  const detailsList = [];

  // 1. Если есть явный массив parsed.exams — обрабатываем каждый зачёт/экзамен точечно (не затирая кабинеты на «уточняется» и не трогая CLASSES)
  if (Array.isArray(parsed.exams) && parsed.exams.length > 0) {
    parsed.exams.forEach(exItem => {
      const res = upsertExamRecord(exItem);
      if (res.exam) {
        updatedExamsCount++;
        detailsList.push(`🎓 <b>${toRuShortDate(res.exam.date)} (${res.exam.time}):</b> ${res.exam.label} «${res.exam.subject}» — <b>Каб ${res.exam.room}</b>`);
      }
    });
  }

  // 2. Разбираем объект дат (parsed.classes или сам parsed)
  const classesSource = (parsed.classes && typeof parsed.classes === 'object' && !Array.isArray(parsed.classes))
    ? parsed.classes
    : parsed;

  // Проверяем, не является ли весь пакет целиком ведомостью зачётов/экзаменов (по 1 предмету в день из списка экзаменов)
  const dateEntries = Object.entries(classesSource).filter(([k, v]) => /^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(v));
  const allDaysSingleExamSubject = dateEntries.length > 0 && dateEntries.every(([dKey, dArr]) => {
    if (dArr.length !== 1) return false;
    const item = dArr[0];
    return isLikelyExamItem(item, dKey, 1) || BASELINE_EXAMS_1B.some(ex => subjectsMatch(ex.subject, item.subject));
  });

  const effectiveExamBatch = (mode === 'exams') || (parsed.type === 'exams') || (parsed.sheetType === 'exams') || allDaysSingleExamSubject;

  for (const [dateKey, dayArr] of dateEntries) {
    const afternoonForDay = [];
    for (const item of dayArr) {
      if (effectiveExamBatch || (mode !== 'classes' && isLikelyExamItem(item, dateKey, dayArr.length))) {
        const res = upsertExamRecord({ ...item, date: dateKey });
        if (res.exam) {
          updatedExamsCount++;
          detailsList.push(`🎓 <b>${toRuShortDate(res.exam.date)} (${res.exam.time}):</b> ${res.exam.label} «${res.exam.subject}» — <b>Каб ${res.exam.room}</b>`);
        }
      } else {
        afternoonForDay.push(item);
      }
    }

    if (afternoonForDay.length > 0 && mode !== 'exams') {
      mergeAfternoonClassesForDay(dateKey, afternoonForDay);
      updatedClassDays++;
      const finalDay = CLASSES[dateKey] || [];
      const dayPairs = finalDay.map(p => `${p.start || ''}–${p.end || ''} ${p.subject || 'Предмет'} (Каб ${p.room || '?'})`).join(', ');
      detailsList.push(`📅 <b>${toRuShortDate(dateKey)}:</b> ${dayPairs}`);
    }
  }

  if (Array.isArray(parsed.shifts)) {
    WORK_SHIFTS_24H = [...parsed.shifts];
    detailsList.push(`🛠️ <b>Смены 09–09:</b> ${WORK_SHIFTS_24H.map(toRuShortDate).join(', ')}`);
  }
  if (parsed.notes && typeof parsed.notes === 'object') {
    PERSONAL_NOTES = { ...parsed.notes };
  }

  const summaryParts = [];
  if (updatedClassDays > 0) summaryParts.push(`учебных дней: ${updatedClassDays}`);
  if (updatedExamsCount > 0) summaryParts.push(`зачётов/экзаменов: ${updatedExamsCount}`);
  const summaryHeader = summaryParts.length > 0 ? `<b>Обновлено ${summaryParts.join(', ')}</b>` : `<b>Данные синхронизированы</b>`;
  const modelSuffix = modelLabel ? ` (${modelLabel})` : '';

  const logMsg = `${summaryHeader}${modelSuffix}<br>` + detailsList.join('<br>');
  logCalendarChange(actionLabel, logMsg);
  saveAllToStorage(updatedExamsCount > 0 && updatedClassDays === 0 ? 'Экзамены' : 'Обновление');
  refreshAllViews();

  return { updatedClassDays, updatedExamsCount, detailsList, summaryHeader };
}

function isClassDeletedInChangelog(dateIso, subject, startTime) {
  if (!Array.isArray(CALENDAR_CHANGELOG) || CALENDAR_CHANGELOG.length === 0) return false;
  const ruDate = toRuShortDate(dateIso);
  return CALENDAR_CHANGELOG.some(entry => {
    if (!entry || !entry.action || !entry.detail) return false;
    if (!entry.action.toLowerCase().includes('удален')) return false;
    const det = String(entry.detail);
    if (!det.includes(ruDate)) return false;
    if (subject && subjectsMatch(det, subject)) return true;
    if (startTime && det.includes(startTime)) return true;
    return false;
  });
}

function isExamDeletedInChangelog(dateIso, subject) {
  if (!Array.isArray(CALENDAR_CHANGELOG) || CALENDAR_CHANGELOG.length === 0) return false;
  const ruDate = toRuShortDate(dateIso);
  return CALENDAR_CHANGELOG.some(entry => {
    if (!entry || !entry.action || !entry.detail) return false;
    if (!entry.action.toLowerCase().includes('удален')) return false;
    const det = String(entry.detail);
    if (dateIso && !det.includes(ruDate)) return false;
    if (subject && subjectsMatch(det, subject)) return true;
    return false;
  });
}

// Авто-восстановление базы: возвращает случайно потерянные пары при сбое сканера и подтягивает распознанные кабинеты из логов.
// ВАЖНО: Никогда не восстанавливает намеренно удалённые администратором пары/экзамены!
function healScheduleAndExamsFromLogs() {
  let healed = false;
  let restoredClassDays = 0;
  let recoveredExamRooms = 0;
  let recoveredClassRooms = 0;

  // 1. Проверяем EXAMS: восстанавливаем только если список пуст или экзамен потерян без лога удаления
  if (!Array.isArray(EXAMS) || EXAMS.length === 0) {
    EXAMS = JSON.parse(JSON.stringify(BASELINE_EXAMS_1B));
    healed = true;
  } else {
    BASELINE_EXAMS_1B.forEach(baseEx => {
      const exists = EXAMS.some(e => e.date === baseEx.date && subjectsMatch(e.subject, baseEx.subject));
      if (!exists) {
        if (!isExamDeletedInChangelog(baseEx.date, baseEx.subject)) {
          EXAMS.push(JSON.parse(JSON.stringify(baseEx)));
          healed = true;
        }
      }
    });
  }

  // 2. Проверяем CLASSES на случайно записанные туда утренние экзамены и восстанавливаем затёртые дни
  if (!CLASSES || typeof CLASSES !== 'object') {
    CLASSES = JSON.parse(JSON.stringify(BASELINE_CLASSES_1B));
    healed = true;
  }

  for (const dateIso of Object.keys(BASELINE_CLASSES_1B)) {
    const currentArr = Array.isArray(CLASSES[dateIso]) ? CLASSES[dateIso] : [];
    const baseArr = BASELINE_CLASSES_1B[dateIso] || [];

    const validAfternoon = [];
    for (const item of currentArr) {
      if (isLikelyExamItem(item, dateIso, currentArr.length)) {
        const res = upsertExamRecord({ ...item, date: dateIso });
        if (res.updated) recoveredExamRooms++;
        healed = true;
      } else {
        validAfternoon.push(item);
      }
    }

    // Защита от воскрешения удалённых пар:
    // Восстанавливаем день из baseline ТОЛЬКО если день был полностью стёрт (validAfternoon.length === 0),
    // и эти пары НЕ были намеренно удалены администратором в журнале изменений!
    // Если же в дне есть хотя бы 1 пара (validAfternoon.length > 0), намеренные удаления не отменяются!
    if (validAfternoon.length === 0 && baseArr.length > 0) {
      const survivingBase = baseArr.filter(baseCls => !isClassDeletedInChangelog(dateIso, baseCls.subject, baseCls.start));
      if (survivingBase.length > 0) {
        CLASSES[dateIso] = JSON.parse(JSON.stringify(survivingBase));
        restoredClassDays++;
        healed = true;
      } else if (currentArr.length > 0) {
        CLASSES[dateIso] = [];
        healed = true;
      }
    } else if (validAfternoon.length !== currentArr.length) {
      CLASSES[dateIso] = validAfternoon;
      healed = true;
    }
  }

  CLASSES = sanitizeClassesData(CLASSES);

  // 3. Анализируем журнал истории (CALENDAR_CHANGELOG) от старых записей к новым,
  // чтобы вытащить все ранее распознанные кабинеты экзаменов и пар!
  if (Array.isArray(CALENDAR_CHANGELOG) && CALENDAR_CHANGELOG.length > 0) {
    const chronologicalLogs = [...CALENDAR_CHANGELOG].reverse();
    const lineRegex = /📅\s*<b>(\d{2})\.(\d{2})\.(\d{4}):<\/b>\s*(.*)/i;
    const itemRegex = /(?:^|,\s*)(?:(\d{1,2}[:.]\d{2}))?\s*[–-]\s*(?:(\d{1,2}[:.]\d{2}))?\s*(.+?)\s*\(Каб\s*([^)]+)\)/g;
    const examLogRegex = /🎓\s*<b>(\d{2})\.(\d{2})\.(\d{4})(?:\s*\((\d{1,2}[:.]\d{2})\))?:?<\/b>\s*[^«"]*?[«"]([^»"]+)[»"].*?Каб\s*([^<)]+)/i;

    for (const entry of chronologicalLogs) {
      if (!entry || !entry.detail) continue;
      if (entry.action && entry.action.toLowerCase().includes('удален')) continue; // Не подтягиваем кабинеты для удалений!
      const lines = String(entry.detail).split(/<br\s*\/?>/i);

      // Сначала соберём все распарсенные строки этой записи лога
      const parsedLines = [];
      for (const rawLine of lines) {
        const cleanLine = rawLine.replace(/<\/?b>/gi, match => match.toLowerCase());
        const exMatch = cleanLine.match(examLogRegex);
        if (exMatch) {
          const iso = `${exMatch[3]}-${exMatch[2]}-${exMatch[1]}`;
          const tStr = normalizeTimeToken(exMatch[4] || '');
          const subjStr = exMatch[5].trim();
          const roomStr = cleanRoomString(exMatch[6]);
          if (isValidRoomValue(roomStr) && !isExamDeletedInChangelog(iso, subjStr)) {
            const res = upsertExamRecord({ date: iso, time: tStr, subject: subjStr, room: roomStr });
            if (res.updated) {
              recoveredExamRooms++;
              healed = true;
            }
          }
          continue;
        }

        const m = cleanLine.match(lineRegex);
        if (!m) continue;
        const iso = `${m[3]}-${m[2]}-${m[1]}`;
        const restText = m[4].replace(/<[^>]+>/g, '');
        const items = [];
        let im;
        itemRegex.lastIndex = 0;
        while ((im = itemRegex.exec(restText)) !== null) {
          items.push({
            start: normalizeTimeToken(im[1] || ''),
            end: normalizeTimeToken(im[2] || ''),
            subject: (im[3] || '').trim(),
            room: cleanRoomString(im[4] || '')
          });
        }
        if (items.length > 0) {
          parsedLines.push({ iso, items });
        }
      }

      // Определяем, была ли эта запись в логе сканированием ведомости экзаменов
      const isWholeEntryExamScan = parsedLines.length > 0 && parsedLines.every(pl =>
        pl.items.length === 1 && (
          isLikelyExamItem(pl.items[0], pl.iso, 1) ||
          BASELINE_EXAMS_1B.some(ex => subjectsMatch(ex.subject, pl.items[0].subject))
        )
      );

      for (const pl of parsedLines) {
        for (const it of pl.items) {
          if (!isValidRoomValue(it.room)) continue;
          if (isWholeEntryExamScan || isLikelyExamItem(it, pl.iso, pl.items.length)) {
            if (!isExamDeletedInChangelog(pl.iso, it.subject)) {
              const res = upsertExamRecord({
                date: pl.iso,
                time: it.start,
                subject: it.subject,
                room: it.room
              });
              if (res.updated) {
                recoveredExamRooms++;
                healed = true;
              }
            }
          } else {
            // Это обычная дневная пара — если в CLASSES[pl.iso] сейчас стоит «уточняется», восстанавливаем кабинет из лога!
            const dayArr = CLASSES[pl.iso] || [];
            let targetCls = dayArr.find(c => c.start === it.start && subjectsMatch(c.subject, it.subject));
            if (!targetCls && it.start) {
              targetCls = dayArr.find(c => c.start === it.start);
            }
            if (!targetCls && it.subject) {
              const sameSubj = dayArr.filter(c => subjectsMatch(c.subject, it.subject));
              if (sameSubj.length === 1) targetCls = sameSubj[0];
              else if (sameSubj.length > 1) {
                targetCls = sameSubj.find(c => !isValidRoomValue(c.room)) || sameSubj[0];
              }
            }
            if (targetCls && !isValidRoomValue(targetCls.room)) {
              targetCls.room = it.room;
              recoveredClassRooms++;
              healed = true;
            }
          }
        }
      }
    }
  }

  EXAMS.sort((a, b) => a.date.localeCompare(b.date) || timeToMin(a.time) - timeToMin(b.time));

  if (healed) {
    try {
      localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(CLASSES));
      localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(EXAMS));
    } catch (e) {}
  }

  return { healed, restoredClassDays, recoveredExamRooms, recoveredClassRooms };
}

function manualRecoverFromLogs() {
  const res = healScheduleAndExamsFromLogs();
  saveAllToStorage('Восстановление');
  refreshAllViews();
  const examsWithRooms = EXAMS.filter(e => isValidRoomValue(e.room));
  const examListHtml = EXAMS.map(e => `• <b>${toRuShortDate(e.date)} (${e.time})</b> ${e.subject}: <b>Каб ${e.room}</b>`).join('<br>');
  showSyncMessage(
    `✅ <b>Восстановление расписания и кабинетов экзаменов выполнено!</b><br>` +
    `📚 Учебных дней в сетке пар: <b>${Object.keys(CLASSES).length}</b> (восстановлено дней: ${res.restoredClassDays}, кабинетов пар из логов: ${res.recoveredClassRooms})<br>` +
    `🎓 Кабинетов зачётов/экзаменов заполнено: <b>${examsWithRooms.length} из ${EXAMS.length}</b> (подтянуто из логов: ${res.recoveredExamRooms}):<br>` +
    `<div class="mt-1.5 pl-2 border-l-2 border-emerald-400/50 text-[11px] space-y-0.5">${examListHtml}</div>`
  );
  showToast(`🛠️ База восстановлена! Экзаменов с каб.: ${examsWithRooms.length}/${EXAMS.length}`);
}

function applyJsonPatch() {
  const raw = document.getElementById('jsonPatchInput').value.trim();
  if (!raw) {
    showSyncMessage('⚠️ Вставь JSON-код обновления в текстовое поле.', true);
    return;
  }
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    const res = applySmartScheduleUpdate(parsed, 'auto', 'Импорт JSON', '');
    showSyncMessage(`✅ ${res.summaryHeader}! Обычные пары и зачёты/экзамены аккуратно объединены без потери данных.`);
    showToast(`✅ База успешно обновлена`);
  } catch (e) {
    showSyncMessage('❌ Ошибка формата JSON. Убедись, что скопирован блок от { до }.', true);
  }
}

function exportCurrentScheduleJson() {
  const fullBackup = {
    classes: CLASSES,
    exams: EXAMS,
    shifts: WORK_SHIFTS_24H,
    notes: PERSONAL_NOTES
  };
  const dataStr = JSON.stringify(fullBackup, null, 2);
  document.getElementById('jsonPatchInput').value = dataStr;
  copyTextFallback(dataStr);
  showSyncMessage('📋 Полная база расписания скопирована в буфер обмена!');
}

async function resetToFactorySchedule() {
  localStorage.removeItem(STORAGE_KEY_CLASSES);
  localStorage.removeItem(STORAGE_KEY_EXAMS);
  localStorage.removeItem(STORAGE_KEY_SHIFTS);
  localStorage.removeItem(STORAGE_KEY_NOTES);
  localStorage.removeItem(STORAGE_KEY_STAMP);
  CLASSES = {};
  EXAMS = [];
  WORK_SHIFTS_24H = [];
  PERSONAL_NOTES = {};
  updateStorageBadge();
  refreshAllViews();
  showSyncMessage('⏳ Загружаем чистую базу из schedule.json...');
  const loaded = await pullScheduleFromGithub(true);
  if (loaded) {
    logCalendarChange('Сброс базы', 'База перезагружена из файла schedule.json');
    showSyncMessage('🔄 База успешно перезагружена из schedule.json!');
    showToast('🔄 База перезагружена из schedule.json');
  } else {
    showSyncMessage('⚠️ Локальная память очищена. Убедись, что файл schedule.json доступен.', true);
  }
}


async function scanPhotoWithGemini() {
  const keyInput = document.getElementById('geminiApiKeyInput');
  const apiKey = sanitizeGeminiKey(keyInput.value);
  keyInput.value = apiKey;

  const fileInput = document.getElementById('schedulePhotoInput');
  if (!apiKey) {
    showSyncMessage('⚠️ Введи свой Gemini API Key в поле №1.', true);
    return;
  }
  if (!fileInput.files || !fileInput.files[0]) {
    showSyncMessage('⚠️ Сначала выбери фотографию расписания со стенда (шаг №3).', true);
    return;
  }

  localStorage.setItem(STORAGE_KEY_API, apiKey);
  const btn = document.getElementById('scanPhotoBtn');
  btn.disabled = true;
  btn.textContent = '⏳ ИИ распознаёт фото для группы 1Б...';
  showSyncMessage('🔍 Сжимаем изображение и отправляем в Gemini Vision...');

  try {
    const file = fileInput.files[0];
    const { base64Data, mimeType } = await compressAndConvertImage(file);

    const modeInstruction = currentAiScanMode === 'exams'
      ? 'На этом фото изображено РАСПИСАНИЕ ЗАЧЁТОВ И ЭКЗАМЕНОВ. Извлеки все зачёты и экзамены для группы 1Б строго в массив "exams", а объект "classes" оставь пустым {}.'
      : (currentAiScanMode === 'classes'
        ? 'На этом фото изображено РАСПИСАНИЕ ОБЫЧНЫХ УЧЕБНЫХ ПАР (14:10–20:10). Извлеки все пары для группы 1Б в объект "classes", а массив "exams" оставь пустым [].'
        : 'Определи автоматически, что на фото: расписание обычных дневных/вечерних пар (14:10–15:30, 15:50–17:10, 17:20–18:40, 18:50–20:10) ИЛИ ведомость/график сдачи зачётов и экзаменов (обычно утреннее время 08:00, 09:00, 09:30, 10:00, 11:00 или по одному предмету в день без времени окончания).');

    const prompt = `Ты точный парсер расписания Юридического факультета БГУ для специальности «Политология», 4 курс, заочное отделение, группа 1Б (год 2026).
Извлеки из фото ТОЛЬКО строки, относящиеся к группе "1Б" или общему потоку "1, 1Б" (строки только для группы "1" игнорируй!).
${modeInstruction}

ВАЖНЫЕ ПРАВИЛА РАЗДЕЛЕНИЯ ПАР И ЭКЗАМЕНОВ:
1. Обычные учебные пары (лекции и семинары) всегда идут в слотах 14:10–15:30, 15:50–17:10, 17:20–18:40, 18:50–20:10. Даже если рядом с предметом написано "(зач)" или "(экз)", это просто форма итоговой отчётности — сама пара с временем 14:10–20:10 записывается ТОЛЬКО в "classes"!
2. Сдача зачётов и экзаменов (расписание зачётов и экзаменов) — это отдельные события аттестации (обычно утром: 08:00, 09:30, 11:00, либо указано только время начала без времени конца). Они записываются ТОЛЬКО в массив "exams"!
Известные 7 зачётов/экзаменов этой сессии:
- 2026-10-30 (09:30): Государственная служба (зач, доц. Краснобаева Л.А.)
- 2026-11-03 (09:30): Финансовое право (зач, доц. Пилипенко А.А.)
- 2026-11-06 (09:30): Хозяйственное право (экз, ст. преп. Гавриленко А.В.)
- 2026-11-09 (09:30): Организация избирательных кампаний (зач, доц. Юсупов П.В.)
- 2026-11-10 (08:00): Уголовное право (экз, доц. Федчук И.Л.)
- 2026-11-11 (11:00): Политическая коммуникация (зач, доц. Абраменко Е.Г.)
- 2026-11-12 (09:30): Этнополитология (экз, доц. Слуцкая Л.В.)

Верни СТРОГО валидный JSON-объект без пояснений в следующем формате:
{
  "type": "classes или exams или mixed",
  "classes": {
"2026-10-26": [
  {"start":"14:10","end":"15:30","subject":"Название","control":"экз или зач","teacher":"ФИО","room":"номер кабинета"}
]
  },
  "exams": [
{"date":"2026-10-30","time":"09:30","subject":"Государственная служба","type":"зач","teacher":"доц. Краснобаева Л.А.","room":"номер кабинета"}
  ]
}`;

    const result = await callGeminiWithFallback(apiKey, [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Data } }
      ]
    }], true);

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Модель не вернула JSON-структуру расписания. Попробуй более чёткое фото.');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const res = applySmartScheduleUpdate(parsed, currentAiScanMode, 'AI-сканер фото', result.modelName);

    showSyncMessage(
      `🎉 <b>Готово (${result.modelName})!</b> ${res.summaryHeader}.<br>` +
      `<div class="mt-1.5 text-[11px] space-y-0.5">${res.detailsList.join('<br>')}</div>`
    );
    showToast(`🤖 Успешно обновлено (${result.modelName})`);
  } catch (err) {
    showSyncMessage(`❌ Не удалось распознать фото: <b>${err.message}</b>`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Распознать фото для группы 1Б и обновить расписание';
  }
}

function compressAndConvertImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          base64Data: dataUrl.split(',')[1],
          mimeType: 'image/jpeg'
        });
      };
      img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

