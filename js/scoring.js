// Подсчёт. Чистые функции, без DOM.

// Правильные ответы (логика/критическое/внимательность): % верных.
export function scoreCorrect(answers, block) {
  let correct = 0;
  for (const q of block) {
    const idx = answers[q.id];
    if (idx != null && q.options[idx] && q.options[idx].correct) correct++;
  }
  return Math.round((correct / block.length) * 100);
}

// Шкала согласия 1..5 с перевёртышами (reverse). Нормируем в %.
export function scoreScale(answers, block) {
  const n = block.length;
  let sum = 0;
  for (const q of block) {
    const idx = answers[q.id];
    let v = (idx != null && q.options[idx]) ? q.options[idx].v : 3; // нет ответа → нейтрально
    if (q.reverse) v = 6 - v;
    sum += v;
  }
  const min = n * 1, max = n * 5;
  return Math.round(((sum - min) / (max - min)) * 100);
}

export function scoreBelbin(answers, block) {
  const counts = {};
  for (const q of block) {
    const a = answers[q.id];
    const idxs = Array.isArray(a) ? a : (a != null ? [a] : []);
    for (const idx of idxs) {
      if (q.options[idx]) {
        const role = q.options[idx].role;
        counts[role] = (counts[role] || 0) + 1;
      }
    }
  }
  const ordered = Object.entries(counts).map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);
  return { counts, ordered, top3: ordered.slice(0, 3) };
}

export function scoreMotivation(rankOrder, choiceAnswers, choiceBlock, motives) {
  const points = {};
  motives.forEach(m => { points[m] = 0; });
  const n = motives.length;
  (rankOrder || []).forEach((m, i) => { if (points[m] != null) points[m] += (n - i); });
  for (const q of choiceBlock) {
    const idx = choiceAnswers[q.id];
    if (idx != null && q.options[idx]) {
      const m = q.options[idx].motive;
      if (points[m] != null) points[m] += 2;
    }
  }
  const ordered = Object.entries(points).map(([motive, pts]) => ({ motive, pts }))
    .sort((a, b) => b.pts - a.pts);
  return { points, ordered, top3: ordered.slice(0, 3).map(x => x.motive) };
}

// Надёжность ответов: lie-шкала («слишком идеально») + проверка инструкции (imc).
export function scoreReliability(answers, relItems) {
  let flags = 0;
  for (const q of relItems) {
    const idx = answers[q.id];
    const opt = (idx != null) ? q.options[idx] : null;
    if (q.lie && opt && opt.v >= 4) flags++;
    if (q.imc && (!opt || opt.t !== q.imc)) flags++;
  }
  const level = flags >= 2 ? 'Низкая' : flags === 1 ? 'Средняя' : 'Высокая';
  return { flags, level };
}

export function levelOf(pct) {
  return pct >= 70 ? 'Высокий' : pct >= 40 ? 'Средний' : 'Низкий';
}

export function overall(...vals) {
  const score = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const band = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  return { score, band };
}

export function buildResult(meta, answers, banks) {
  const logic = scoreCorrect(answers, banks.LOGIC);
  const critical = scoreCorrect(answers, banks.CRITICAL);
  const attention = scoreCorrect(answers, banks.ATTENTION);
  const persistence = scoreScale(answers, banks.PERSISTENCE);
  const adaptability = scoreScale(answers, banks.ADAPTABILITY);
  const belbin = scoreBelbin(answers, banks.BELBIN);
  const motivation = scoreMotivation(answers.M1, answers, banks.MOTIVATION_CHOICES, banks.MOTIVES);
  const reliability = scoreReliability(answers, banks.RELIABILITY);
  const total = overall(logic, critical, attention, persistence, adaptability);
  return {
    fio: meta.fio, vacancy: meta.vacancy, phone: meta.phone, resume: meta.resume || '', ref: meta.ref || '', ts: meta.ts,
    logic, critical, attention, persistence, adaptability,
    overall: total.score, band: total.band,
    levels: {
      logic: levelOf(logic), critical: levelOf(critical), attention: levelOf(attention),
      persistence: levelOf(persistence), adaptability: levelOf(adaptability),
    },
    reliability: reliability.level, reliabilityFlags: reliability.flags,
    belbinTop3: belbin.top3, belbinCounts: belbin.counts,
    motivationTop3: motivation.top3, motivationPoints: motivation.points,
  };
}
