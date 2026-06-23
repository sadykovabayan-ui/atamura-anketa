import * as Q from './questions.js';
import { buildResult } from './scoring.js';

// ▼▼▼ ВСТАВЬТЕ СЮДА URL ВЕБ-ПРИЛОЖЕНИЯ GOOGLE APPS SCRIPT (см. README, шаг 1) ▼▼▼
const ENDPOINT = 'https://script.google.com/macros/s/AKfycby2fd3DNvk-nNt7dRLfvD_OMJvuub_QDsWS22U63trlUcdEfVAH2ZaydFZxMBaxxLg/exec';

const banks = { CRITICAL: Q.CRITICAL, ATTENTION: Q.ATTENTION, PERSISTENCE: Q.PERSISTENCE,
  ADAPTABILITY: Q.ADAPTABILITY, BELBIN: Q.BELBIN, MOTIVATION_CHOICES: Q.MOTIVATION_CHOICES, MOTIVES: Q.MOTIVES };

// Перемешиваем варианты в каждом вопросе один раз за сессию, чтобы позиция ответа
// ничего не подсказывала (правильный/«лучший» вариант не стоит всегда на одном месте).
// Метки (correct/score/role/motive) едут вместе с вариантом, поэтому подсчёт не ломается.
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
[Q.CRITICAL, Q.ATTENTION, Q.PERSISTENCE, Q.ADAPTABILITY, Q.BELBIN, Q.MOTIVATION_CHOICES]
  .forEach(block => block.forEach(q => shuffle(q.options)));

// Flatten into an ordered list of "steps". The motivation ranking (M1) comes right
// before the motivation choice questions. Block names are intentionally NOT shown to
// the candidate — only neutral numbering — so answers cannot be gamed.
const steps = [];
for (const b of Q.SINGLE_BLOCKS) {
  if (b.key === 'motivationChoices') steps.push({ kind: 'rank', q: Q.MOTIVATION_RANK });
  // Белбин — множественный выбор (можно отметить несколько ролей-поведений); остальные — один.
  for (const q of b.items) steps.push({ kind: 'single', q, multi: b.key === 'belbin' });
}
const TOTAL = steps.length;
const pad2 = (n) => String(n).padStart(2, '0');

const meta = {};
const answers = {};          // questionId -> chosen index; M1 -> ranked array
let rankOrder = [...Q.MOTIVES];
let cur = 0;
let startMs = 0;
let timerId = null;

const $ = (id) => document.getElementById(id);
const show = (id) => { ['screen-start','screen-quiz','screen-done'].forEach(s => { $(s).hidden = s !== id; }); };

$('btn-start').addEventListener('click', () => {
  const fio = $('in-fio').value.trim(), vacancy = $('in-vacancy').value.trim(), phone = $('in-phone').value.trim();
  if (!fio || !vacancy || !phone) { $('start-error').hidden = false; return; }
  meta.fio = fio; meta.vacancy = vacancy; meta.phone = phone;
  answers.M1 = rankOrder;
  startMs = Date.now();
  tick(); timerId = setInterval(tick, 1000);
  show('screen-quiz'); render();
});

function tick() {
  const s = Math.floor((Date.now() - startMs) / 1000);
  $('timer').textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

function render() {
  const step = steps[cur];
  $('kicker').textContent = `ВОПРОС ${pad2(cur + 1)} / ${TOTAL}`;
  $('sheet-no').textContent = `ЛИСТ ${pad2(cur + 1)} · ${TOTAL}`;
  $('dim-left').textContent = `${pad2(cur + 1)} / ${TOTAL}`;
  $('btn-prev').disabled = cur === 0;
  $('btn-next').textContent = cur === TOTAL - 1 ? 'ЗАВЕРШИТЬ' : 'ДАЛЕЕ →';
  renderDim();

  if (step.kind === 'single') { renderSingle(step.q, step.multi); $('options').hidden = false; $('rank-area').hidden = true; }
  else { renderRank(step.q); $('options').hidden = true; $('rank-area').hidden = false; $('multi-hint').hidden = true; }
}

function renderDim() {
  const dim = $('dim'); dim.innerHTML = '';
  for (let i = 0; i < TOTAL; i++) {
    const t = document.createElement('span');
    t.className = 'tick' + (i < cur ? ' done' : i === cur ? ' now' : '');
    dim.appendChild(t);
  }
}

function renderSingle(q, multi) {
  $('q-text').textContent = q.text;
  $('multi-hint').hidden = !multi;
  const box = $('options'); box.innerHTML = '';
  const cur = answers[q.id];
  q.options.forEach((opt, idx) => {
    const sel = multi ? (Array.isArray(cur) && cur.includes(idx)) : (cur === idx);
    const el = document.createElement('div');
    el.className = 'option' + (sel ? ' selected' : '');
    el.innerHTML = `<span class="box">${sel ? '✓' : ''}</span><span>${opt.t}</span>`;
    el.addEventListener('click', () => {
      if (multi) {
        const arr = Array.isArray(answers[q.id]) ? answers[q.id].slice() : [];
        const at = arr.indexOf(idx);
        if (at >= 0) arr.splice(at, 1); else arr.push(idx);
        answers[q.id] = arr;
      } else {
        answers[q.id] = idx;
      }
      render();
    });
    box.appendChild(el);
  });
}

// Ranking with up/down buttons — reliable on both desktop and mobile (no drag-and-drop).
function renderRank(q) {
  $('q-text').textContent = q.text;
  const area = $('rank-area'); area.innerHTML = '';
  const hint = document.createElement('p');
  hint.className = 'rank-hint';
  hint.textContent = 'Стрелками поднимите самое важное наверх (1 — главное).';
  area.appendChild(hint);
  rankOrder.forEach((label, i) => {
    const el = document.createElement('div');
    el.className = 'rank-item';
    el.innerHTML = `<span class="num">${i + 1}</span><span>${label}</span>
      <span class="handle">
        <button class="rank-btn" data-dir="up" data-i="${i}" aria-label="Выше" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="rank-btn" data-dir="down" data-i="${i}" aria-label="Ниже" ${i === rankOrder.length - 1 ? 'disabled' : ''}>▼</button>
      </span>`;
    area.appendChild(el);
  });
  area.querySelectorAll('.rank-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.i), dir = btn.dataset.dir;
      const j = dir === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= rankOrder.length) return;
      [rankOrder[i], rankOrder[j]] = [rankOrder[j], rankOrder[i]];
      answers.M1 = rankOrder;
      renderRank(q);
    });
  });
}

$('btn-prev').addEventListener('click', () => { if (cur > 0) { cur--; render(); } });
$('btn-next').addEventListener('click', () => {
  const step = steps[cur];
  if (step.kind === 'single') {
    const a = answers[step.q.id];
    const answered = step.multi ? (Array.isArray(a) && a.length > 0) : (a != null);
    if (!answered) { flashNext(); return; }
  }
  if (step.kind === 'rank') answers.M1 = rankOrder; // ranking always has a default order
  if (cur === TOTAL - 1) { finish(); return; }
  cur++; render();
});
function flashNext() { const b = $('btn-next'); const prev = b.textContent; b.textContent = 'ВЫБЕРИТЕ ОТВЕТ'; setTimeout(() => { b.textContent = prev; }, 900); }

async function finish() {
  clearInterval(timerId);
  const result = buildResult({ ...meta, ts: new Date().toISOString() }, answers, banks);
  show('screen-done');
  try {
    await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(result) });
  } catch (e) { /* кандидат уже видит «спасибо»; ошибку показывать не нужно */ }
}
