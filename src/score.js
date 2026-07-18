// localStorage high-score table: top 10, 3-initial entries.

const KEY = 'wedge-hiscores';

export function loadScores() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}

export function saveScore(initials, score) {
  const s = loadScores();
  s.push({ initials, score });
  s.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(KEY, JSON.stringify(s.slice(0, 10))); } catch (e) { /* private mode */ }
}

export function qualifies(score) {
  if (score <= 0) return false;
  const s = loadScores();
  return s.length < 10 || score > s[s.length - 1].score;
}
