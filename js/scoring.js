// Pure scoring functions. No DOM. Answers shape documented in the plan header.

export function scoreCorrect(answers, block) {
  let correct = 0;
  for (const q of block) {
    const idx = answers[q.id];
    if (idx != null && q.options[idx] && q.options[idx].correct) correct++;
  }
  return Math.round((correct / block.length) * 100);
}

export function scoreScale(answers, block) {
  let sum = 0;
  for (const q of block) {
    const idx = answers[q.id];
    sum += (idx != null && q.options[idx]) ? q.options[idx].score : 0;
  }
  return Math.round(sum / block.length);
}

export function scoreBelbin(answers, block) {
  const counts = {};
  for (const q of block) {
    const idx = answers[q.id];
    if (idx != null && q.options[idx]) {
      const role = q.options[idx].role;
      counts[role] = (counts[role] || 0) + 1;
    }
  }
  const ordered = Object.entries(counts)
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);
  return { counts, ordered, top3: ordered.slice(0, 3) };
}

export function scoreMotivation(rankOrder, choiceAnswers, choiceBlock, motives) {
  const points = {};
  motives.forEach(m => { points[m] = 0; });
  // Ranking: 1st place = N points, last = 1 (N = number of motives)
  const n = motives.length;
  (rankOrder || []).forEach((m, i) => { if (points[m] != null) points[m] += (n - i); });
  // Choices: +2 each to the picked motive
  for (const q of choiceBlock) {
    const idx = choiceAnswers[q.id];
    if (idx != null && q.options[idx]) {
      const m = q.options[idx].motive;
      if (points[m] != null) points[m] += 2;
    }
  }
  const ordered = Object.entries(points)
    .map(([motive, pts]) => ({ motive, pts }))
    .sort((a, b) => b.pts - a.pts);
  return { points, ordered, top3: ordered.slice(0, 3).map(x => x.motive) };
}

export function overall(critical, attention, persistence, adaptability) {
  const score = Math.round((critical + attention + persistence + adaptability) / 4);
  const band = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  return { score, band };
}

export function buildResult(meta, answers, banks) {
  const critical = scoreCorrect(answers, banks.CRITICAL);
  const attention = scoreCorrect(answers, banks.ATTENTION);
  const persistence = scoreScale(answers, banks.PERSISTENCE);
  const adaptability = scoreScale(answers, banks.ADAPTABILITY);
  const belbin = scoreBelbin(answers, banks.BELBIN);
  const motivation = scoreMotivation(answers.M1, answers, banks.MOTIVATION_CHOICES, banks.MOTIVES);
  const total = overall(critical, attention, persistence, adaptability);
  return {
    fio: meta.fio, vacancy: meta.vacancy, phone: meta.phone, ts: meta.ts,
    critical, attention, persistence, adaptability,
    overall: total.score, band: total.band,
    belbinTop3: belbin.top3, belbinCounts: belbin.counts,
    motivationTop3: motivation.top3, motivationPoints: motivation.points,
  };
}
