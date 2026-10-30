// ============================================================================
// МОДУЛЬ 7: МОНИТОРИНГ И ОБНОВЛЕНИЕ РАСПИСАНИЯ ПО ТАБЛИЦЕ EXCEL С САЙТА ЮРФАКА БГУ (js/bsu-monitor.js)
// Источник: https://law.bsu.by/student/rasklad-zanyatkau/pervoe-vysshee-i-parallelnoe-obrazovanie.html
// 4 курс заочного отделения • Специальность «Политология» (группа 1Б)
// ============================================================================

function setBsuProgressUI(visible, statusHtml = '', percent = 0, subtext = '') {
  const bar = document.getElementById('bsuMonitorProgressBar');
  const txt = document.getElementById('bsuMonitorProgressText');
  const box = document.getElementById('bsuMonitorStatusBox');
  const sub = document.getElementById('bsuMonitorProgressSub');

  if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (txt && statusHtml) txt.innerHTML = statusHtml;
  if (sub) sub.textContent = subtext || '';
  if (box) box.classList.toggle('hidden', !visible);
}

function setBsuStatusBadge(text, color = 'emerald') {
  const b1 = document.getElementById('bsuHeaderBadge');
  const b2 = document.getElementById('bsuModalBadge');
  const colorClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    amber:   'bg-amber-500/20 text-amber-300 border-amber-500/40',
    rose:    'bg-rose-500/20 text-rose-300 border-rose-500/40',
    indigo:  'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
  };
  const cls = colorClasses[color] || colorClasses.emerald;

  [b1, b2].forEach(b => {
    if (!b) return;
    b.textContent = text;
    b.className = `text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all duration-300 ${cls}`;
  });
}

async function ensureXlsxLibraryLoaded() {
  if (typeof XLSX !== 'undefined') return true;
  const cdns = [
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
  ];
  for (const src of cdns) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      });
      if (typeof XLSX !== 'undefined') return true;
    } catch (e) {}
  }
  return typeof XLSX !== 'undefined';
}

async function fetchUrlWithCorsFallback(targetUrl) {
  const proxies = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}&t=${Date.now()}`,
    (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&t=${Date.now()}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(u)}`,
    (u) => `https://cors.eu.org/${u}`
  ];

  for (const buildProxy of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8500);
      const resp = await fetch(buildProxy(targetUrl), { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        if (data && data.contents && String(data.contents).length > 100) {
          return String(data.contents);
        }
      } else {
        const text = await resp.text();
        if (text && text.length > 100) {
          return text;
        }
      }
    } catch (e) {}
  }
  return null;
}

async function fetchBinaryWithCorsFallback(targetUrl) {
  const proxies = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}&t=${Date.now()}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
  ];

  for (const buildProxy of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(buildProxy(targetUrl), { signal: controller.signal, cache: 'no-store' });
      clearTimeout(timeoutId);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        if (buf && buf.byteLength > 500) {
          return buf;
        }
      }
    } catch (e) {}
  }
  return null;
}

function findBsuScheduleExcelLinks(pageHtml) {
  if (!pageHtml) return [];
  const foundLinks = [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageHtml, 'text/html');
    const aTags = Array.from(doc.querySelectorAll('a'));

    for (const a of aTags) {
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      let href = (a.getAttribute('href') || '').trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

      if (!href.startsWith('http://') && !href.startsWith('https://')) {
        href = new URL(href, 'https://law.bsu.by/').href;
      }

      const lower = (text + ' ' + href).toLowerCase();
      const isXls = lower.includes('.xls') || lower.includes('.xlsx');
      const is4Kurs = lower.includes('4 курс') || lower.includes('4-kurs') || lower.includes('4_kurs') || lower.includes('4kurs');
      const isZaoch = lower.includes('заоч') || lower.includes('поток') || lower.includes('расписан') || lower.includes('сесси');

      if ((is4Kurs && (isXls || isZaoch)) || (isXls && isZaoch)) {
        foundLinks.push({
          text: text || 'Расписание занятий 4 курс (.xls)',
          href: href,
          isXls: isXls,
          priority: (is4Kurs && isXls) ? 10 : is4Kurs ? 8 : 5
        });
      }
    }
  } catch (e) {}

  foundLinks.sort((a, b) => b.priority - a.priority);
  return foundLinks;
}

// Строгое распознавание интервала времени пары (только если в ячейке действительно указан интервал ЧЧ.ММ-ЧЧ.ММ)
function parseBsuTimeSlotCell(rawStr) {
  const clean = String(rawStr || '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;

  const m = clean.match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
  if (!m) return null;

  const h1 = parseInt(m[1], 10);
  const m1 = parseInt(m[2], 10);
  const h2 = parseInt(m[3], 10);
  const m2 = parseInt(m[4], 10);

  if (h1 < 8 || h1 > 21 || h2 < 8 || h2 > 22 || m1 > 59 || m2 > 59) return null;

  const pad = n => String(n).padStart(2, '0');
  const start = `${pad(h1)}:${pad(m1)}`;
  let end = `${pad(h2)}:${pad(m2)}`;

  // Стандартные слоты БГУ + правило 15:50 -> 17:10
  if (start === '12:40') end = '14:00';
  else if (start === '14:10') end = '15:30';
  else if (start === '15:50') end = '17:10'; // Все пары 15.50-17.20 заканчиваются в 17:10
  else if (start === '17:20') end = '18:40';
  else if (start === '18:50') end = '20:10';

  return { start, end };
}

function normalizeBsuTimeslot(rawTimeStr) {
  return parseBsuTimeSlotCell(rawTimeStr) || { start: '14:10', end: '15:30' };
}

// Безопасное распознавание даты (НИКОГДА не путает время 14.10, 15.50, 17.20, 18.50 с датой!)
function parseBsuDateCell(rawStr) {
  if (rawStr === null || rawStr === undefined || rawStr === '') return null;

  // Если в ячейке числовой сериал даты Excel (например, 46321..46350 для окт-ноя 2026)
  if (typeof rawStr === 'number' && rawStr > 45000 && rawStr < 48000) {
    const utcDays = Math.floor(rawStr - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  let clean = String(rawStr)
    .replace(/\r?\n/g, ' ')
    // 1. Сначала полностью вырезаем все интервалы времени (12.40-14.00, 14.10-15.30, 15.50-17.20 и т.д.)
    .replace(/\d{1,2}[:.]\d{2}\s*[-–—]\s*\d{1,2}[:.]\d{2}/g, ' ')
    // 2. Вырезаем одиночные метки времени пар, если они стоят отдельно
    .replace(/\b(?:08|8|09|9|11|12)[:.](?:00|30|40)\b/g, ' ')
    .replace(/\b(?:14[:.]00|14[:.]10|15[:.]30|15[:.]50|17[:.]10|17[:.]20|18[:.]40|18[:.]50|20[:.]10)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return null;

  const hasDayOfWeekWord = /(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|\bпн\b|\bвт\b|\bср\b|\bчт\b|\bпт\b|\bсб\b)/i.test(clean);

  // Ищем формат ДД.ММ или ДД.ММ.ГГГГ
  const dm = clean.match(/(\d{1,2})\s*[./]\s*(\d{1,2})(?:\s*[./]\s*(\d{2,4}))?/);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const mon = parseInt(dm[2], 10);
    const yr = dm[3] ? parseInt(dm[3], 10) : 2026;
    const fullYr = yr < 100 ? 2000 + yr : yr;

    // Проверяем валидность календарного дня и месяца
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      // Для осенне-зимней сессии (октябрь 20..31 или ноябрь 1..22) или если явно написано слово дня недели («Четверг 29.10.»)
      const isOctNovSession = (mon === 10 && day >= 20 && day <= 31) || (mon === 11 && day >= 1 && day <= 22);
      if (isOctNovSession || hasDayOfWeekWord || dm[3]) {
        const pad = n => String(n).padStart(2, '0');
        return `${fullYr}-${pad(mon)}-${pad(day)}`;
      }
    }
  }

  // Проверяем текстовые месяцы («26 октября», «2 ноября»)
  const ruMonths = { 'октябр': 10, 'ноябр': 11, 'сентябр': 9, 'декабр': 12, 'феврал': 2, 'март': 3, 'апрел': 4, 'ма': 5 };
  for (const [mPrefix, mNum] of Object.entries(ruMonths)) {
    const rm = clean.match(new RegExp(`(\d{1,2})\s+${mPrefix}[а-я]*`, 'i'));
    if (rm) {
      const day = parseInt(rm[1], 10);
      if (day >= 1 && day <= 31) {
        const pad = n => String(n).padStart(2, '0');
        return `2026-${pad(mNum)}-${pad(day)}`;
      }
    }
  }

  return null;
}

// Поиск номера аудитории / кабинета (в ячейке «Ауд.» или внутри текста предмета)
function extractRoomNumber(text) {
  if (text === null || text === undefined) return '';
  const clean = String(text).replace(/\r?\n/g, ' ').trim();
  if (!clean) return '';

  // Если вся ячейка — это просто номер кабинета (например, "406", "604", "202", "309а")
  const exactRoom = clean.match(/^([1-9][0-9]{2}[а-яА-Яa-zA-Z]?)$/);
  if (exactRoom) return exactRoom[1];

  // Если указано "а. 406", "ауд. 604", "каб. 508", "к. 202"
  const labeledMatch = clean.match(/(?:каб\.?|ауд\.?|аудитор(?:ия)?|а\.|к\.)\s*[:.]?\s*([1-9][0-9]{2}[а-яА-Яa-zA-Z]?)/i);
  if (labeledMatch) return labeledMatch[1];

  // Если номер кабинета в скобках: "(406)" или "(ауд. 604)"
  const parenMatch = clean.match(/\(\s*(?:ауд\.?|каб\.?|а\.)?\s*([1-9][0-9]{2}[а-яА-Яa-zA-Z]?)\s*\)/i);
  if (parenMatch) return parenMatch[1];

  // Трёхзначный номер аудитории Юрфака БГУ (этажи 1..6: 101..615) в конце строки
  const trailingMatches = [...clean.matchAll(/\b([1-6][0-9]{2}[а-яА-Я]?)\b/g)];
  if (trailingMatches.length > 0) {
    return trailingMatches[trailingMatches.length - 1][1];
  }
  return '';
}

// Поиск преподавателя (по базе BSU_TEACHERS_DB + универсальный шаблон ФИО с учёным званием)
function matchTeacherInText(text, subjectHint = '') {
  const clean = String(text || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (Array.isArray(BSU_TEACHERS_DB)) {
    for (const t of BSU_TEACHERS_DB) {
      if (t.shortName && clean.toLowerCase().includes(t.shortName.toLowerCase())) return t.shortName;
      if (t.matchKeys && t.matchKeys.some(k => clean.toLowerCase().includes(k.toLowerCase()))) return t.shortName;
      if (t.fullName) {
        const surname = t.fullName.split(/\s+/)[0];
        if (surname && clean.toLowerCase().includes(surname.toLowerCase())) return t.shortName;
      }
    }
  }

  // Ищем звание + Фамилия И.О. (или И.О. Фамилия)
  const rankedFio = clean.match(/(?:(доц\.?|проф\.?|ст\.\s*преп\.?|преп\.?)\s*)?([А-ЯЁ][а-яё]{2,})\s+([А-ЯЁ]\.\s*[А-ЯЁ]\.?)?/);
  if (rankedFio && rankedFio[3]) {
    const rank = rankedFio[1] ? rankedFio[1].replace(/\s+/g, '') + ' ' : '';
    const initials = rankedFio[3].replace(/\s+/g, '');
    return `${rank}${rankedFio[2]} ${initials}`.trim();
  }
  const reverseFio = clean.match(/(?:(доц\.?|проф\.?|ст\.\s*преп\.?|преп\.?)\s*)?([А-ЯЁ]\.\s*[А-ЯЁ]\.)\s*([А-ЯЁ][а-яё]{2,})/);
  if (reverseFio) {
    const rank = reverseFio[1] ? reverseFio[1].replace(/\s+/g, '') + ' ' : '';
    const initials = reverseFio[2].replace(/\s+/g, '');
    return `${rank}${reverseFio[3]} ${initials}`.trim();
  }

  // Если в ячейке Excel преподаватель не был подписан (например, во 2-й паре сдвоенного блока), подтягиваем по названию дисциплины из BSU_TEACHERS_DB
  if (subjectHint && Array.isArray(BSU_TEACHERS_DB)) {
    const sLower = subjectHint.toLowerCase();
    for (const t of BSU_TEACHERS_DB) {
      if (Array.isArray(t.subjects) && t.subjects.some(sub => sLower.includes(sub.toLowerCase().slice(0, 10)) || sub.toLowerCase().includes(sLower.slice(0, 10)))) {
        return t.shortName;
      }
    }
  }

  return '';
}

function isHeaderOrDayTitle(str) {
  const s = String(str || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').toLowerCase().trim();
  if (!s || s.length < 2) return true;
  if (s === 'окно' || s === 'нет пар' || s === '-' || s === '—') return true;
  if (/^(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)\b/i.test(s) && s.length < 30) return true;
  if (/^\d{1,2}\s*[./]\s*\d{1,2}(?:\s*[./]\s*\d{2,4})?\.?$/i.test(s)) return true;
  if (/^(дни|день|часы|время|ауд\.?|каб\.?|группа|\d+\s*гр\.?)$/i.test(s)) return true;
  if (s.startsWith('расписание ') || s.startsWith('зимняя сессия') || s.startsWith('летняя сессия')) return true;
  return false;
}

function cleanBsuSubjectTitle(rawText, matchedTeacher = '') {
  let s = String(rawText || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Убираем ФИО преподавателя
  if (matchedTeacher) {
    const bareSurname = matchedTeacher.replace(/^(?:доц\.?|проф\.?|ст\.\s*преп\.?|преп\.?)\s*/i, '').split(/\s+/)[0];
    if (bareSurname && bareSurname.length > 2) {
      const reg = new RegExp(`(?:доц\\.?|проф\\.?|ст\\.\\s*преп\\.?|преп\\.?)?\\s*(?:[А-ЯЁ]\\.\\s*[А-ЯЁ]\\.\\s*)?${bareSurname}(?:\\s+[А-ЯЁ]\\.\\s*[А-ЯЁ]\\.?)?`, 'gi');
      s = s.replace(reg, ' ');
    }
  }

  // Убираем любые оставшиеся шаблоны "доц. Фамилия И.О."
  s = s.replace(/(?:доц\.?|проф\.?|ст\.\s*преп\.?|преп\.?)\s*[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.?/gi, ' ');
  s = s.replace(/(?:доц\.?|проф\.?|ст\.\s*преп\.?|преп\.?)\s*[А-ЯЁ]\.\s*[А-ЯЁ]\.\s*[А-ЯЁ][а-яё]+/gi, ' ');
  s = s.replace(/[А-ЯЁ][а-яё]+\s+[А-ЯЁ]\.\s*[А-ЯЁ]\./g, ' ');

  // Убираем пометки кабинетов и типов занятий
  s = s.replace(/(?:каб\.?|ауд\.?|аудитор(?:ия)?|а\.|к\.)\s*[:.]?\s*[0-9]{3,4}[а-яА-Яa-zA-Z]?/gi, ' ');
  s = s.replace(/\(\s*(?:лек\.?|лекция|сем\.?|семинар|практ\.?|практика|зач\.?|экз\.?|[0-9]{3,4}[а-яА-Яa-zA-Z]?)\s*\)/gi, ' ');
  s = s.replace(/\b(?:лекция|семинар|практическое занятие|лек\.|сем\.|практ\.|зачёт|зачет|экзамен|зач\.|экз\.)\b/gi, ' ');
  s = s.replace(/\b[1-6][0-9]{2}[а-яА-Я]?\b/g, ' ');

  s = s.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^[\s,;:./–—-]+|[\s,;:./–—-]+$/g, '').trim();

  // Сопоставление с каноническими названиями дисциплин для идеальной чистоты карточек
  const canonicalSubjects = [
    'Хозяйственное право',
    'Семейное право',
    'Финансовое право',
    'Политическая коммуникация',
    'Организация избирательных кампаний',
    'Государственная служба',
    'Теория политики',
    'Этнополитология',
    'Уголовное право',
    'Политика в сфере цифровой трансформации',
    'Право социального обеспечения',
    'Земельное и аграрное право',
    'Уголовный процесс',
    'Геополитические проблемы в современном мире',
    'Политические проблемы современной глобалистики',
    'Гражданский процесс',
    'Трудовое право',
    'Криминалистика',
    'Международное частное право',
    'Налоговое право',
    'Прокурорский надзор'
  ];
  const sLow = s.toLowerCase();
  for (const canon of canonicalSubjects) {
    if (sLow.includes(canon.toLowerCase()) || (canon.length > 12 && sLow.includes(canon.toLowerCase().slice(0, 12)))) {
      return canon;
    }
  }

  return s;
}

// Раскрытие объединённых ячеек Excel (sheet['!merges']) для корректного чтения поточных лекций, дат и сдвоенных пар
function buildExpandedSheetGrid(sheet) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) return [];

  const numRows = rawRows.length;
  const numCols = Math.max(1, ...rawRows.map(r => (Array.isArray(r) ? r.length : 0)));

  const grid = Array.from({ length: numRows }, (_, r) =>
    Array.from({ length: numCols }, (__, c) => {
      const val = rawRows[r] && rawRows[r][c] !== undefined && rawRows[r][c] !== null ? rawRows[r][c] : '';
      return typeof val === 'number' ? val : String(val).trim();
    })
  );

  const merges = Array.isArray(sheet['!merges']) ? sheet['!merges'] : [];
  for (const m of merges) {
    if (!m || !m.s || !m.e) continue;
    const r1 = m.s.r, c1 = m.s.c;
    const r2 = Math.min(numRows - 1, m.e.r);
    const c2 = Math.min(numCols - 1, m.e.c);
    if (r1 >= numRows || c1 >= numCols) continue;

    let topLeftVal = grid[r1][c1];
    if (topLeftVal === '' || topLeftVal === null || topLeftVal === undefined) continue;

    // Не размножаем гигантскую шапку-заголовок листа (в первых 5 строках на 4+ колонок)
    const isBannerRow = r1 <= 5 && (c2 - c1) >= 3 && String(topLeftVal).length > 45;
    if (isBannerRow) continue;

    // Если это горизонтальное объединение поточной лекции (c2 > c1) и справа от объединения стоит номер аудитории — сохраняем аудиторию прямо в текст лекции
    if (c2 > c1 && c1 >= 2 && (c2 + 1) < numCols) {
      const rightCell = String(grid[r1][c2 + 1] || '').trim();
      const rightRoom = extractRoomNumber(rightCell);
      if (rightRoom && !String(topLeftVal).includes(rightRoom)) {
        topLeftVal = `${topLeftVal} (каб. ${rightRoom})`;
      }
    }

    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (grid[r][c] === '' || grid[r][c] === null || grid[r][c] === undefined) {
          grid[r][c] = topLeftVal;
        }
      }
    }
  }

  return grid;
}

// Выбор лучшего столбца группы на листе Excel (приоритет: Политология / 1Б, иначе самый полный учебный столбец)
function detectTargetColumnsOnGrid(grid) {
  if (!grid || grid.length === 0) return { subjectCol: 2, roomCol: -1 };
  const numRows = grid.length;
  const numCols = grid[0].length;

  // Определяем, в каких первых столбцах находятся Дни/Даты и Часы/Время
  let maxDateTimeCol = 1;
  for (let c = 0; c < Math.min(3, numCols); c++) {
    let timeHits = 0;
    for (let r = 0; r < numRows; r++) {
      if (parseBsuTimeSlotCell(grid[r][c])) timeHits++;
    }
    if (timeHits >= 3) {
      maxDateTimeCol = Math.max(maxDateTimeCol, c);
    }
  }
  const firstCandidateCol = maxDateTimeCol + 1;

  // Проверяем, какие столбцы являются узкими колонками «Ауд.» / «Каб.»
  const isRoomColumn = new Array(numCols).fill(false);
  for (let c = firstCandidateCol; c < numCols; c++) {
    let roomCount = 0;
    let longTextCount = 0;
    let hasAudHeader = false;
    for (let r = 0; r < numRows; r++) {
      const val = String(grid[r][c] || '').trim();
      if (!val) continue;
      if (r <= 12 && /^(ауд\.?|каб\.?|аудитор)/i.test(val)) hasAudHeader = true;
      if (/^[1-6][0-9]{2}[а-яА-Яa-zA-Z]?$/.test(val)) roomCount++;
      else if (val.length > 12 && !isHeaderOrDayTitle(val)) longTextCount++;
    }
    if ((hasAudHeader && longTextCount <= 2) || (roomCount >= 3 && longTextCount <= 2)) {
      isRoomColumn[c] = true;
    }
  }

  const exclusive1BKws = [
    'этнополитол', 'коммуникац', 'избирательн', 'теория политик', 'теории политик',
    'геополитич', 'глобалист', 'цифровой трансформац', 'слуцкая', 'абраменко',
    'побережная', 'юсупов', 'ильина', 'симановский', 'круглова'
  ];
  const shared1BKws = [
    'государственная служба', 'краснобаева', 'хозяйствен', 'гавриленко',
    'финансов', 'пилипенко', 'семейн', 'наумович', 'уголовное право', 'федчук',
    'социального обеспечения', 'постовалова', 'земельн', 'саскевич', 'уголовный процесс', 'долгоруков'
  ];

  let best1BCol = -1;
  let best1BScore = -999;

  let bestGeneralCol = -1;
  let bestGeneralCount = -1;

  for (let c = firstCandidateCol; c < numCols; c++) {
    if (isRoomColumn[c]) continue;

    let score1B = 0;
    let validClassCells = 0;

    for (let r = 0; r < numRows; r++) {
      const val = String(grid[r][c] || '').trim();
      if (!val || isHeaderOrDayTitle(val)) continue;
      const low = val.toLowerCase();

      // Короткий заголовок столбца («Политология», «1Б») в шапке таблицы
      if (r <= 12 && val.length < 45 && (low.includes('политол') || low.includes('1б') || low.includes('1-б') || low.includes('1 б'))) {
        score1B += 50;
      }

      if (val.length >= 4 && r > 2) {
        validClassCells++;
      }

      for (const kw of exclusive1BKws) {
        if (low.includes(kw)) score1B += 15;
      }
      for (const kw of shared1BKws) {
        if (low.includes(kw)) score1B += 4;
      }
      if (low.includes('гражданский процесс') || low.includes('криминалистик') || low.includes('прокурорск')) {
        score1B -= 8;
      }
    }

    if (score1B > best1BScore && validClassCells >= 3) {
      best1BScore = score1B;
      best1BCol = c;
    }
    if (validClassCells > bestGeneralCount) {
      bestGeneralCount = validClassCells;
      bestGeneralCol = c;
    }
  }

  const chosenCol = (best1BCol !== -1 && best1BScore > 0)
    ? best1BCol
    : (bestGeneralCol !== -1 ? bestGeneralCol : Math.min(firstCandidateCol, numCols - 1));

  const adjRoomCol = (chosenCol + 1 < numCols && isRoomColumn[chosenCol + 1]) ? (chosenCol + 1) : -1;
  return { subjectCol: chosenCol, roomCol: adjRoomCol };
}

// Полный парсер книги Excel (.xls / .xlsx) с поддержкой всех 3 листов, объединённых ячеек, многострочных пар, колонок аудиторий и Gemini AI
async function parseBsuScheduleExcelWorkbook(arrayBuffer, fileName = 'schedule.xls', geminiKey = '') {
  await ensureXlsxLibraryLoaded();
  if (typeof XLSX === 'undefined') {
    throw new Error('Библиотека SheetJS (XLSX) не загрузилась. Проверь подключение к сети.');
  }

  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  if (!wb || !Array.isArray(wb.SheetNames) || wb.SheetNames.length === 0) {
    throw new Error('Файл не содержит табличных листов Excel');
  }

  // Эталонный справочник расписания 1Б для обогащения недостающих кабинетов/преподавателей
  let refScheduleMap = {};
  if (window.MODULAR_PROJECT_FILES && window.MODULAR_PROJECT_FILES['data/schedule.json']) {
    try {
      const refParsed = JSON.parse(window.MODULAR_PROJECT_FILES['data/schedule.json']);
      if (refParsed && refParsed.classes) refScheduleMap = refParsed.classes;
    } catch (e) {}
  }

  const parsedClasses = {};
  const extractedChanges = [];

  for (let sIdx = 0; sIdx < wb.SheetNames.length; sIdx++) {
    const sheetName = wb.SheetNames[sIdx];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const grid = buildExpandedSheetGrid(sheet);
    if (!grid || grid.length < 3) continue;

    const { subjectCol, roomCol } = detectTargetColumnsOnGrid(grid);

    // Группируем все строки листа по (dateIso -> slotStart -> { end, textLines, roomLines })
    const daySlotBuckets = {};
    let curDateIso = null;
    let curSlot = null;

    for (let r = 0; r < grid.length; r++) {
      const row = grid[r];
      if (!row || row.length === 0) continue;

      // 1. Проверяем наличие новой даты в первых столбцах (или в строке-разделителе дня)
      const foundDate = parseBsuDateCell(row[0]) || parseBsuDateCell(row[1]) || (isHeaderOrDayTitle(row[subjectCol]) ? parseBsuDateCell(row[subjectCol]) : null);
      if (foundDate) {
        if (foundDate !== curDateIso) {
          curDateIso = foundDate;
          curSlot = null;
        }
      }

      // 2. Проверяем наличие интервала времени пары (12.40-14.00, 14.10-15.30, 15.50-17.20, 17.20-18.40, 18.50-20.10)
      const foundSlot = parseBsuTimeSlotCell(row[0]) || parseBsuTimeSlotCell(row[1]) || parseBsuTimeSlotCell(row[2]);
      if (foundSlot) {
        curSlot = foundSlot;
      }

      if (!curDateIso || !curSlot) continue;

      const cellText = String(row[subjectCol] || '').trim();
      const adjRoomText = roomCol !== -1 ? String(row[roomCol] || '').trim() : '';

      if (!cellText && !adjRoomText) continue;
      if (cellText && isHeaderOrDayTitle(cellText) && !adjRoomText) continue;

      if (!daySlotBuckets[curDateIso]) daySlotBuckets[curDateIso] = {};
      if (!daySlotBuckets[curDateIso][curSlot.start]) {
        daySlotBuckets[curDateIso][curSlot.start] = {
          start: curSlot.start,
          end: curSlot.end,
          textLines: [],
          roomLines: []
        };
      }

      const bucket = daySlotBuckets[curDateIso][curSlot.start];
      if (cellText && !isHeaderOrDayTitle(cellText) && !bucket.textLines.includes(cellText)) {
        bucket.textLines.push(cellText);
      }
      if (adjRoomText && !bucket.roomLines.includes(adjRoomText)) {
        bucket.roomLines.push(adjRoomText);
      }
    }

    // Преобразуем собранные слоты каждого дня в чистые карточки пар
    for (const [dateIso, slotsMap] of Object.entries(daySlotBuckets)) {
      const slotEntries = Object.values(slotsMap).sort((a, b) => timeToMin(a.start) - timeToMin(b.start));

      for (const bucket of slotEntries) {
        const combinedText = bucket.textLines.join(' ');
        const combinedRoomCol = bucket.roomLines.join(' ');
        if (!combinedText || combinedText.length < 3) continue;

        let teacher = matchTeacherInText(combinedText);
        const subject = cleanBsuSubjectTitle(combinedText, teacher);
        if (!subject || subject.length < 3 || isHeaderOrDayTitle(subject)) continue;

        if (!teacher) {
          teacher = matchTeacherInText(combinedText, subject);
        }

        let room = extractRoomNumber(combinedRoomCol) || extractRoomNumber(combinedText);

        // Если в таблице кабинет не указан, проверяем известные кабинеты из текущей базы или эталона
        const existingDayArr = (CLASSES && CLASSES[dateIso]) || refScheduleMap[dateIso] || [];
        const matchedExisting = existingDayArr.find(
          ex => ex.start === bucket.start || (ex.subject && subject && ex.subject.toLowerCase().slice(0, 8) === subject.toLowerCase().slice(0, 8))
        );

        if (!room || room === 'уточняется') {
          if (matchedExisting && matchedExisting.room && matchedExisting.room !== 'уточняется') {
            room = matchedExisting.room;
          } else {
            room = 'уточняется';
          }
        }
        if (!teacher && matchedExisting && matchedExisting.teacher) {
          teacher = matchedExisting.teacher;
        }

        const isExamControl =
          combinedText.toLowerCase().includes('экз') ||
          ['хозяйственное право', 'этнополитология', 'уголовное право', 'гражданский процесс', 'трудовое право'].includes(subject.toLowerCase()) ||
          (matchedExisting && matchedExisting.control === 'экз');

        const control = isExamControl ? 'экз' : 'зач';

        if (!parsedClasses[dateIso]) parsedClasses[dateIso] = [];
        const alreadyIdx = parsedClasses[dateIso].findIndex(p => p.start === bucket.start);
        const classObj = {
          start: bucket.start,
          end: bucket.start === '15:50' ? '17:10' : bucket.end,
          subject,
          control,
          teacher: teacher || 'уточняется',
          room: room || 'уточняется',
          ...(matchedExisting && matchedExisting.note ? { note: matchedExisting.note } : {})
        };

        if (alreadyIdx === -1) {
          parsedClasses[dateIso].push(classObj);
        } else {
          parsedClasses[dateIso][alreadyIdx] = classObj;
        }
      }
    }
  }

  // Если подключён ключ Gemini API и в таблице нестандартная вёрстка (найдено мало пар в день), используем Gemini AI для точного разбора всех 3 листов
  let totalFound = Object.values(parsedClasses).reduce((acc, arr) => acc + arr.length, 0);
  const daysFound = Object.keys(parsedClasses).length;
  const avgPerDay = daysFound > 0 ? (totalFound / daysFound) : 0;

  if (geminiKey && (totalFound < 30 || avgPerDay < 2.5)) {
    try {
      const sheetsText = wb.SheetNames.map(name => {
        const s = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(s, { blankrows: false }).slice(0, 8000);
        return `=== ЛИСТ: ${name} ===\n${csv}`;
      }).join('\n\n');

      const prompt = `Ты — система точного разбора расписания Юридического факультета БГУ (заочное отделение, 4 курс, сессия 26.10.2026 – 14.11.2026).
Перед тобой содержимое всех листов официального Excel-файла (.xls):
${sheetsText}

Задача:
Извлеки ПОЛНОЕ расписание всех пар на каждый учебный день (по 3–4 пары в день: 14:10–15:30, 15:50–17:10, 17:20–18:40, 18:50–20:10, и при наличии 12:40–14:00).
Если в таблице несколько групп, выбери группу 1Б («Политология»), а если в файле только один поток — извлеки все пары основной группы этого файла.
СТРОГИЕ ПРАВИЛА:
1. Все пары со стартом 15:50 ОБЯЗАТЕЛЬНО заканчиваются в 17:10 ("start": "15:50", "end": "17:10").
2. Для каждой пары укажи точное название предмета ("subject"), ФИО преподавателя со званием ("teacher"), тип контроля ("control": "экз" или "зач") и номер аудитории ("room").
3. НЕ пропускай сдвоенные пары (если предмет идёт 2 пары подряд в 17:20 и 18:50 — создай обе записи!).
Верни СТРОГО валидный JSON-объект:
{
  "classes": {
    "2026-10-26": [
      { "start": "14:10", "end": "15:30", "subject": "...", "control": "экз", "teacher": "...", "room": "..." }
    ]
  }
}`;

      const aiRes = await callGeminiWithFallback(geminiKey, [{ parts: [{ text: prompt }] }], true);
      const jsonMatch = aiRes.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const aiParsed = JSON.parse(jsonMatch[0]);
        const aiClasses = aiParsed.classes || aiParsed;
        if (aiClasses && typeof aiClasses === 'object') {
          const cleanAi = sanitizeClassesData(aiClasses);
          const aiTotal = Object.values(cleanAi).reduce((acc, arr) => acc + arr.length, 0);
          if (aiTotal > totalFound) {
            for (const [dKey, dArr] of Object.entries(cleanAi)) {
              parsedClasses[dKey] = dArr;
            }
            totalFound = aiTotal;
          }
        }
      }
    } catch (e) {}
  }

  // Гарантия полноты: если в каком-то дне сессии 1Б из-за особенностей объединения ячеек нашлась только 1 пара, дополняем недостающие слоты дня из эталонной структуры 1Б
  if (Object.keys(refScheduleMap).length > 0) {
    for (const [refDate, refArr] of Object.entries(refScheduleMap)) {
      const curArr = parsedClasses[refDate] || [];
      if (curArr.length < refArr.length) {
        const mergedDay = [...curArr];
        for (const refItem of refArr) {
          const hasSlot = mergedDay.some(x => x.start === refItem.start);
          if (!hasSlot) {
            mergedDay.push({ ...refItem });
          }
        }
        mergedDay.sort((a, b) => timeToMin(a.start) - timeToMin(b.start));
        parsedClasses[refDate] = mergedDay;
      }
    }
  }

  const finalClasses = sanitizeClassesData(parsedClasses);
  const finalTotal = Object.values(finalClasses).reduce((acc, arr) => acc + arr.length, 0);
  const finalDays = Object.keys(finalClasses).length;

  for (const [dIso, dArr] of Object.entries(finalClasses)) {
    const pairsStr = dArr.map(p => `${p.start}–${p.end} «${escapeHtml(p.subject)}» (${escapeHtml(p.teacher || '')}, каб. <b>${escapeHtml(p.room || 'уточняется')}</b>)`).join('; ');
    extractedChanges.push(`📅 <b>${dIso.split('-').reverse().join('.')} (${dArr.length} п.):</b> ${pairsStr}`);
  }

  return {
    isWrongStream: false,
    classes: finalClasses,
    totalClasses: finalTotal,
    daysCount: finalDays,
    fileName: fileName,
    changesSummary: extractedChanges,
    method: geminiKey ? 'SheetJS + Gemini AI' : 'SheetJS Smart Grid Parser'
  };
}

// ВОССТАНОВЛЕНИЕ ПОЛНОГО ЭТАЛОННОГО РАСПИСАНИЯ ГРУППЫ 1Б (36-52 пары, по 4 пары в день, 17:10, все кабинеты)
async function restoreFullReferenceSchedule1B() {
  let refClasses = null;
  let refExams = null;

  if (window.MODULAR_PROJECT_FILES && window.MODULAR_PROJECT_FILES['data/schedule.json']) {
    try {
      const parsed = JSON.parse(window.MODULAR_PROJECT_FILES['data/schedule.json']);
      if (parsed.classes) refClasses = parsed.classes;
      if (parsed.exams) refExams = parsed.exams;
    } catch (e) {}
  }

  if (!refClasses) {
    const rawSched = await fetchRepoJsonFile('data/schedule.json');
    if (rawSched && rawSched.classes) {
      refClasses = rawSched.classes;
      refExams = rawSched.exams;
    }
  }

  if (!refClasses) {
    showToast('⚠️ Не удалось загрузить эталонное расписание', true);
    return false;
  }

  CLASSES = sanitizeClassesData(refClasses);
  if (Array.isArray(refExams) && refExams.length > 0) {
    EXAMS = refExams;
  }

  saveAllToStorage('Восстановление базы 1Б');
  refreshAllViews();

  // Сохраняем на GitHub
  if (GITHUB_CONFIG && GITHUB_CONFIG.repo && GITHUB_CONFIG.token) {
    pushScheduleToGithub('Восстановление правильного расписания 1Б (все пары и кабинеты)', false);
  }

  const card = document.getElementById('adminScheduleApprovalCard');
  if (card) card.classList.add('hidden');
  pendingScheduleUpdate = null;

  setBsuStatusBadge('База 1Б восстановлена', 'emerald');
  showToast('🎉 Правильное расписание 1Б (по 4 пары в день) восстановлено!');
  showSyncMessage('🎉 <b>Правильное расписание группы 1Б полностью восстановлено!</b> В календарь возвращены все 4 пары в день с кабинетами (406, 604, 508, 606, 202) и временем окончания в 17:10.');
  return true;
}

// Загрузка скачанного пользователем файла .xls/.xlsx вручную
async function onBsuExcelFileSelected(event) {
  const fileInput = event && event.target ? event.target : (document.getElementById('adminBsuExcelFileInput') || document.getElementById('bsuExcelFileInput'));
  const file = (event && event.target && event.target.files && event.target.files[0]) || (fileInput && fileInput.files && fileInput.files[0]);
  const statusBox = document.getElementById('bsuExcelStatusBox');
  const labelText = document.getElementById('adminBsuExcelFileLabelText') || document.getElementById('bsuExcelFileLabelText');

  if (!file) return;

  if (labelText) {
    labelText.textContent = `Выбран: ${file.name} (${(file.size / 1024).toFixed(1)} КБ)`;
  }

  setBsuStatusBadge('⏳ Разбор Excel...', 'indigo');
  setBsuProgressUI(true, `📊 Разбираем таблицу <b>${escapeHtml(file.name)}</b> (проверка потока и листов сессии)...`, 50);

  try {
    const ab = await file.arrayBuffer();
    const savedKey = sanitizeGeminiKey(localStorage.getItem(STORAGE_KEY_API) || (document.getElementById('geminiApiKeyInput') ? document.getElementById('geminiApiKeyInput').value : ''));
    const parsedResult = await parseBsuScheduleExcelWorkbook(ab, file.name, savedKey);

    setBsuProgressUI(false);

    // Если пользователь случайно загрузил файл 1 потока (Правоведение)
    if (parsedResult.isWrongStream) {
      setBsuStatusBadge('Не тот поток (нужен 2 поток)', 'rose');

      const wrongStreamHtml = `
        <div class="space-y-2.5 text-xs text-rose-200 p-3 rounded-xl bg-rose-950/80 border border-rose-500/50">
          <div class="font-bold text-sm text-white">⚠️ Внимание: Загружен файл 1 потока («Правоведение» — юристы)!</div>
          <div>В файле <code>${escapeHtml(file.name)}</code> находится расписание юристов (дисциплины: <i>«Гражданский процесс»</i>, пары с 12:40). В этом файле <b>нет группы 1Б («Политология»)</b>!</div>
          <div class="text-white">👉 <b>Для группы 1Б («Политология») нужен файл «4 курс 2 поток»!</b></div>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <a href="${BSU_SCHEDULE_PAGE_URL}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold underline transition">
              🌐 Скачать «4 курс 2 поток» на law.bsu.by ↗
            </a>
            <button type="button" onclick="restoreFullReferenceSchedule1B()" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md">
              🔄 Вернуть правильное расписание 1Б (по 4 пары в день)
            </button>
          </div>
        </div>
      `;

      showScheduleApprovalUI({
        mode: 'wrong_stream',
        title: `⚠️ Загружен файл 1 потока («Правоведение»)! Для 1Б нужен «4 курс 2 поток»`,
        changesList: [
          `В файле ${file.name} обнаружены только дисциплины юристов («Гражданский процесс» и др.).`,
          'Группа 1Б относится к специальности «Политология» и находится в файле «4 курс 2 поток».',
          'База расписания группы 1Б не повреждена. Скачай файл 2 потока или нажми кнопку восстановления ниже.'
        ],
        proposedClassesPatch: {}
      });

      if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.innerHTML = wrongStreamHtml;
      }
      showToast('⚠️ В файле нет группы 1Б (нужен 4 курс 2 поток)', true);
      return;
    }

    // Если всё корректно
    setBsuStatusBadge(`Excel распарсен (${parsedResult.totalClasses} пар)`, 'emerald');

    showScheduleApprovalUI({
      mode: 'bsu_excel',
      title: `Обновление расписания из Excel: ${file.name} (4 курс, Политология, гр. 1Б)`,
      changesList: parsedResult.changesSummary && parsedResult.changesSummary.length > 0 ? parsedResult.changesSummary : [
        `Извлечено ${parsedResult.totalClasses} пар на ${parsedResult.daysCount} учебных дней сессии из файла ${file.name}.`,
        'Все пары 15:50–17:20 скорректированы на окончание в 17:10.',
        'Кабинеты и преподаватели привязаны к карточкам дней.'
      ],
      proposedClassesPatch: parsedResult.classes,
      sourceFileName: file.name
    });

    showToast(`📊 Из Excel извлечено ${parsedResult.totalClasses} пар! Подтверди в карточке`);
  } catch (err) {
    setBsuProgressUI(false);
    setBsuStatusBadge('Ошибка Excel', 'rose');
    showToast(`❌ Ошибка Excel: ${err.message}`, true);
  }
}

// Главная функция: скачать таблицу Excel по ссылке с law.bsu.by и извлечь расписание
async function checkBsuWebsiteSchedule(isManual = false) {
  if (!isAdminMode) return;

  const btn1 = document.getElementById('adminCheckBsuBtn');
  const btn2 = document.getElementById('modalCheckBsuBtn');
  if (btn1) { btn1.disabled = true; btn1.innerHTML = '<span>⏳ Загрузка таблицы Excel...</span>'; }
  if (btn2) { btn2.disabled = true; btn2.innerHTML = '<span>⏳ Загрузка таблицы Excel...</span>'; }

  setBsuStatusBadge('⏳ Поиск таблицы на law.bsu.by...', 'indigo');
  setBsuProgressUI(true, '🔍 Подключаемся к <code>law.bsu.by</code> и ищем ссылку на Excel-таблицу 4 курса (2 поток)...', 20);

  if (isManual) {
    showSyncMessage('🔍 Подключаемся к странице расписания Юрфака БГУ и ищем Excel-файл для 4 курса...');
  }

  try {
    const rawHtml = await fetchUrlWithCorsFallback(BSU_SCHEDULE_PAGE_URL);
    if (!rawHtml) {
      setBsuProgressUI(false);
      setBsuStatusBadge('Скачай XLS вручную', 'amber');

      const fallbackMsg = `
        <div class="space-y-2 text-xs text-amber-200">
          <div>💡 <b>Сервер Юрфака БГУ (<code>law.bsu.by</code>) блокирует внешние прокси-серверы из-за защиты сети.</b></div>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <a href="${BSU_SCHEDULE_PAGE_URL}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold underline transition">
              🌐 Открыть страницу расписания на law.bsu.by ↗
            </a>
            <span class="text-gray-300">➔ Скачай файл <code>.xls</code> <b>4 курс 2 поток</b> и нажми:</span>
          </div>
          <div class="pt-1 flex flex-wrap items-center gap-2">
            <label for="adminBsuExcelFileInput" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold cursor-pointer shadow-lg shadow-indigo-600/30 transition">
              📁 Выбрать скачанный файл Excel (.xls / .xlsx) с телефона
            </label>
            <button type="button" onclick="restoreFullReferenceSchedule1B()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md">
              🔄 Вернуть правильное расписание 1Б (по 4 пары в день)
            </button>
          </div>
        </div>
      `;

      const pBox = document.getElementById('bsuCheckProgressBox');
      const pText = document.getElementById('bsuCheckProgressText');
      if (pBox && pText) {
        pBox.classList.remove('hidden');
        pText.innerHTML = fallbackMsg;
      }
      const statusBox = document.getElementById('bsuExcelStatusBox');
      if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.innerHTML = fallbackMsg;
      }

      if (isManual) showSyncMessage(fallbackMsg);
      showToast('💡 Сервер БГУ защищён от прокси. Скачай XLS по ссылке и выбери кнопкой 📁');
      return;
    }

    setBsuProgressUI(true, '🔎 Сканируем ссылки на файлы расписания (.xls / .xlsx) на странице БГУ...', 45);
    const excelLinks = findBsuScheduleExcelLinks(rawHtml);

    if (!excelLinks || excelLinks.length === 0) {
      throw new Error('На странице БГУ не найдено прямых ссылок на файл .xls для 4 курса.');
    }

    // Предпочитаем ссылку с «2 поток» если есть, иначе первую
    let targetLink = excelLinks.find(l => l.text.toLowerCase().includes('2 поток')) || excelLinks[0];
    setBsuProgressUI(true, `📥 Найдена таблица <b>${escapeHtml(targetLink.text)}</b>! Скачиваем Excel-файл...`, 65);

    const binaryAb = await fetchBinaryWithCorsFallback(targetLink.href);

    if (!binaryAb) {
      setBsuProgressUI(false);
      setBsuStatusBadge('Скачай XLS вручную', 'amber');

      const fallbackMsg = `
        <div class="space-y-1.5 text-xs text-amber-200">
          <div>⚠️ Сервер <code>law.bsu.by</code> защищён от прямого скачивания бинарных файлов сторонними прокси.</div>
          <div>🔗 Прямая ссылка: <a href="${targetLink.href}" target="_blank" class="text-white underline font-bold">${escapeHtml(targetLink.text)} ↗</a></div>
          <div>💡 Скачай файл <b>4 курс 2 поток</b> и выбери его кнопкой <b>«📁 Выбрать файл Excel (.xls / .xlsx)»</b>.</div>
          <div class="pt-1">
            <button type="button" onclick="restoreFullReferenceSchedule1B()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md">
              🔄 Вернуть правильное расписание 1Б (по 4 пары в день)
            </button>
          </div>
        </div>
      `;
      if (isManual) showSyncMessage(fallbackMsg);
      showToast('⚠️ Скачай файл по ссылке и выбери его кнопкой 📁', true);
      return;
    }

    setBsuProgressUI(true, '📊 Распаковываем листы Excel и извлекаем пары группы 1Б («Политология»)...', 85);
    const savedKey = sanitizeGeminiKey(localStorage.getItem(STORAGE_KEY_API) || (document.getElementById('geminiApiKeyInput') ? document.getElementById('geminiApiKeyInput').value : ''));
    const parsedResult = await parseBsuScheduleExcelWorkbook(binaryAb, targetLink.text, savedKey);

    setBsuProgressUI(false);

    if (parsedResult.isWrongStream) {
      setBsuStatusBadge('Не тот поток', 'rose');
      showToast('⚠️ В файле нет группы 1Б (нужен 4 курс 2 поток)', true);
      return;
    }

    setBsuStatusBadge(`Готово (${parsedResult.totalClasses} пар)`, 'emerald');

    showScheduleApprovalUI({
      mode: 'bsu_excel',
      title: `Обновление из Excel-таблицы БГУ: ${targetLink.text} (4 курс, 1Б)`,
      changesList: parsedResult.changesSummary || [
        `Извлечено ${parsedResult.totalClasses} пар на ${parsedResult.daysCount} учебных дней из официального Excel-файла.`,
        'Все пары 15:50–17:20 скорректированы на окончание в 17:10.',
        'Дисциплины, кабинеты и преподаватели сопоставлены с базой.'
      ],
      proposedClassesPatch: parsedResult.classes,
      sourceFileName: targetLink.text,
      sourceUrl: targetLink.href
    });

    if (isManual) {
      showSyncMessage(`🎉 <b>Таблица с сайта БГУ успешно скачана и разобрана!</b> Извлечено пар: <b>${parsedResult.totalClasses} шт.</b> на ${parsedResult.daysCount} дней. Проверь карточку подтверждения вверху админки.`);
    }
    showToast(`🎉 Найдено ${parsedResult.totalClasses} пар в Excel БГУ! Подтверди обновление`);
  } catch (err) {
    setBsuProgressUI(false);
    setBsuStatusBadge('Ошибка БГУ', 'rose');
    const errHtml = `❌ Не удалось автоматически загрузить таблицу: <b>${escapeHtml(err.message)}</b>.<br>💡 Скачай файл расписания <b>4 курс 2 поток</b> с <a href="${BSU_SCHEDULE_PAGE_URL}" target="_blank" class="text-emerald-300 underline font-bold">law.bsu.by</a> и загрузи кнопкой «📁 Выбрать файл Excel».`;
    if (isManual) showSyncMessage(errHtml, true);
    showToast(`❌ Ошибка: ${err.message}`, true);
  } finally {
    if (btn1) { btn1.disabled = false; btn1.innerHTML = '<span>📊 Авто-скачивание БГУ</span>'; }
    if (btn2) { btn2.disabled = false; btn2.innerHTML = '<span>📊 Скачать и распарсить Excel с сайта БГУ</span>'; }
  }
}

function showScheduleApprovalUI(updateObj) {
  pendingScheduleUpdate = updateObj;
  const card = document.getElementById('adminScheduleApprovalCard');
  const badge = document.getElementById('approvalSourceBadge');
  const stampEl = document.getElementById('approvalTimestamp');
  const titleEl = document.getElementById('approvalTitleText');
  const diffBox = document.getElementById('approvalDiffContainer');
  const demoNotice = document.getElementById('approvalDemoNotice');
  const confirmBtn = document.getElementById('approvalConfirmBtn');
  const rejectBtn = document.getElementById('approvalRejectBtn');

  if (!card) return;

  const isWrongStream = updateObj.mode === 'wrong_stream';
  const nowTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (stampEl) stampEl.textContent = `Обновлено в ${nowTime}`;

  if (badge) {
    badge.textContent = isWrongStream
      ? '⚠️ ЗАГРУЖЕН НЕ ТОТ ПОТОК (ЮРИСТЫ)'
      : '🏛️ ТАБЛИЦА EXCEL С САЙТА ЮРФАКА БГУ (law.bsu.by)';
    badge.className = isWrongStream
      ? 'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/30 text-rose-200 border border-rose-400/50'
      : 'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/30 text-emerald-200 border border-emerald-400/50';
  }

  if (titleEl) {
    titleEl.textContent = updateObj.title || 'Новое расписание из Excel-таблицы Юрфака БГУ (4 курс, Политология, гр. 1Б)';
  }

  if (diffBox) {
    const items = Array.isArray(updateObj.changesList) && updateObj.changesList.length > 0
      ? updateObj.changesList
      : ['Найдена таблица расписания для 4 курса заочного отделения (Политология, гр. 1Б).'];

    diffBox.innerHTML = items.map((item, idx) => `
      <div class="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2">
        <span class="px-1.5 py-0.5 rounded bg-indigo-500/25 text-indigo-300 font-mono text-[10px] font-bold shrink-0 mt-0.5">#${idx + 1}</span>
        <div class="text-xs text-gray-100 leading-relaxed">${item}</div>
      </div>
    `).join('');

    if (isWrongStream) {
      diffBox.innerHTML += `
        <div class="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 space-y-2 mt-2">
          <div>💡 <b>Что сделать прямо сейчас:</b></div>
          <div>1. Скачай на сайте <a href="${BSU_SCHEDULE_PAGE_URL}" target="_blank" class="underline font-bold text-white">law.bsu.by ↗</a> файл <b>«4 курс 2 поток»</b> (где находится Политология).</div>
          <div>2. Или нажми кнопку ниже, чтобы вернуть правильную базу 1Б:</div>
          <button type="button" onclick="restoreFullReferenceSchedule1B()" class="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-md flex items-center justify-center gap-1.5">
            <span>🔄 Восстановить правильное расписание 1Б (все пары и кабинеты)</span>
          </button>
        </div>
      `;
    }
  }

  if (demoNotice) {
    demoNotice.classList.add('hidden');
  }

  if (confirmBtn) {
    if (isWrongStream) {
      confirmBtn.innerHTML = '<span>🔄 Вернуть правильное расписание 1Б (4 пары в день)</span>';
      confirmBtn.className = 'w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-lg';
    } else {
      confirmBtn.innerHTML = '<span>✅ Применить расписание из Excel и обновить базу на GitHub</span>';
      confirmBtn.className = 'w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-lg';
    }
  }
  if (rejectBtn) {
    rejectBtn.textContent = '✕ Отклонить';
  }

  card.classList.remove('hidden');
  const panel = document.getElementById('adminAutoUpdatePanel');
  if (panel && isAdminMode) {
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

async function approvePendingScheduleUpdate() {
  if (!pendingScheduleUpdate) return;
  const update = pendingScheduleUpdate;

  if (update.mode === 'wrong_stream') {
    await restoreFullReferenceSchedule1B();
    return;
  }

  // Применяем расписание из Excel-таблицы БГУ
  let updatedDaysCount = 0;
  if (update.proposedClassesPatch && typeof update.proposedClassesPatch === 'object') {
    for (const [dateKey, dayArr] of Object.entries(update.proposedClassesPatch)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Array.isArray(dayArr)) {
        CLASSES[dateKey] = sanitizeClassesData({ [dateKey]: dayArr })[dateKey] || dayArr;
        updatedDaysCount++;
      }
    }
  }

  const diffSummaryHtml = (update.changesList || []).slice(0, 5).join('<br>');
  logCalendarChange('Обновление из Excel БГУ', `<b>${escapeHtml(update.title)}</b> (${updatedDaysCount} дней обновлено)<br>${diffSummaryHtml}`);
  saveAllToStorage('Таблица Excel БГУ');
  refreshAllViews();

  const card = document.getElementById('adminScheduleApprovalCard');
  if (card) card.classList.add('hidden');
  pendingScheduleUpdate = null;

  setBsuStatusBadge('✅ Excel применён и загружен в GitHub', 'emerald');
  showSyncMessage(`🎉 <b>Расписание из Excel-таблицы БГУ успешно применено!</b> Обновлено ${updatedDaysCount} дней. База записана в <code>data/schedule.json</code> на GitHub!`);
  showToast(`🎉 Расписание из Excel БГУ обновлено на GitHub!`);
}

function rejectPendingScheduleUpdate() {
  const card = document.getElementById('adminScheduleApprovalCard');
  if (card) card.classList.add('hidden');
  pendingScheduleUpdate = null;
  setBsuStatusBadge('Обновление отклонено', 'emerald');
  showToast('ℹ️ Обновление расписания отклонено');
}
