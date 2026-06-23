import * as Q from './questions.js';
import { buildResult } from './scoring.js';

// ▼▼▼ ВСТАВЬТЕ СЮДА URL ВЕБ-ПРИЛОЖЕНИЯ GOOGLE APPS SCRIPT (см. README) ▼▼▼
const ENDPOINT = 'https://script.google.com/macros/s/AKfycby2fd3DNvk-nNt7dRLfvD_OMJvuub_QDsWS22U63trlUcdEfVAH2ZaydFZxMBaxxLg/exec';

const banks = {
  LOGIC: Q.LOGIC, CRITICAL: Q.CRITICAL, ATTENTION: Q.ATTENTION,
  PERSISTENCE: Q.PERSISTENCE, ADAPTABILITY: Q.ADAPTABILITY, BELBIN: Q.BELBIN,
  MOTIVATION_CHOICES: Q.MOTIVATION_CHOICES, MOTIVES: Q.MOTIVES, RELIABILITY: Q.RELIABILITY,
};

// Перемешиваем варианты только в вопросах с выбором/мультивыбором (шкалу — нет, она упорядочена).
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
for (const s of Q.SECTIONS) {
  if (s.type === 'choice' || s.type === 'multi') for (const q of s.items) shuffle(q.options);
}

// Список шагов. kind: 'choice' | 'scale' | 'multi' | 'rank'.
const steps = [];
for (const s of Q.SECTIONS) {
  if (s.rankFirst) steps.push({ kind: 'rank', q: Q.MOTIVATION_RANK });
  for (const q of s.items) steps.push({ kind: s.type, q });
}
const TOTAL = steps.length;
const pad2 = (n) => String(n).padStart(2, '0');

const meta = {};
const answers = {};
let rankOrder = [...Q.MOTIVES];
let cur = 0;
let startMs = 0;
let timerId = null;
let qTimerId = null;

const $ = (id) => document.getElementById(id);
const show = (id) => { ['screen-start', 'screen-quiz', 'screen-done'].forEach(s => { $(s).hidden = s !== id; }); };

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

function clearQTimer() { if (qTimerId) { clearInterval(qTimerId); qTimerId = null; } }
function startQTimer(seconds) {
  clearQTimer();
  let left = seconds;
  const el = $('qtimer');
  const showLeft = () => { el.textContent = `⏱ 0:${pad2(left)}`; el.classList.toggle('low', left <= 10); };
  el.hidden = false; showLeft();
  qTimerId = setInterval(() => {
    left--;
    if (left <= 0) { clearQTimer(); el.hidden = true; goNext(true); return; }
    showLeft();
  }, 1000);
}

function render() {
  clearQTimer();
  const step = steps[cur];
  $('kicker').textContent = `ВОПРОС ${pad2(cur + 1)} / ${TOTAL}`;
  $('sheet-no').textContent = `ЛИСТ ${pad2(cur + 1)} · ${TOTAL}`;
  $('dim-left').textContent = `${pad2(cur + 1)} / ${TOTAL}`;
  $('btn-prev').disabled = cur === 0;
  $('btn-next').textContent = cur === TOTAL - 1 ? 'ЗАВЕРШИТЬ' : 'ДАЛЕЕ →';
  $('qtimer').hidden = true;
  renderDim();

  if (step.kind === 'rank') {
    renderRank(step.q); $('options').hidden = true; $('rank-area').hidden = false; $('multi-hint').hidden = true;
  } else {
    renderSingle(step.q, step.kind === 'multi'); $('options').hidden = false; $('rank-area').hidden = true;
  }
  if (step.q.timed) startQTimer(step.q.timed);
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
  const cur2 = answers[q.id];
  q.options.forEach((opt, idx) => {
    const sel = multi ? (Array.isArray(cur2) && cur2.includes(idx)) : (cur2 === idx);
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

function goNext(force) {
  const step = steps[cur];
  if (!force) {
    if (step.kind === 'multi') {
      const a = answers[step.q.id];
      if (!(Array.isArray(a) && a.length > 0)) { flashNext(); return; }
    } else if (step.kind !== 'rank') {
      if (answers[step.q.id] == null) { flashNext(); return; }
    }
  }
  if (step.kind === 'rank') answers.M1 = rankOrder;
  clearQTimer();
  if (cur === TOTAL - 1) { finish(); return; }
  cur++; render();
}

$('btn-prev').addEventListener('click', () => { if (cur > 0) { cur--; render(); } });
$('btn-next').addEventListener('click', () => goNext(false));
function flashNext() { const b = $('btn-next'); const p = b.textContent; b.textContent = 'ВЫБЕРИТЕ ОТВЕТ'; setTimeout(() => { b.textContent = p; }, 900); }

async function finish() {
  clearInterval(timerId); clearQTimer();
  const result = buildResult({ ...meta, ts: new Date().toISOString() }, answers, banks);
  show('screen-done');
  try {
    await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(result) });
  } catch (e) { /* кандидат уже видит «спасибо» */ }
}
