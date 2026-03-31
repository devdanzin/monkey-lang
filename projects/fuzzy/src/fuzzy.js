// Levenshtein distance + fuzzy matching

export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
      else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

export function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export function fuzzyMatch(query, target, { caseSensitive = false } = {}) {
  const q = caseSensitive ? query : query.toLowerCase();
  const t = caseSensitive ? target : target.toLowerCase();
  let qi = 0;
  const indices = [];
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { indices.push(ti); qi++; }
  }
  return qi === q.length ? { match: true, score: indices.length / t.length, indices } : { match: false, score: 0, indices: [] };
}

export function fuzzySearch(query, items, { key, caseSensitive = false, threshold = 0 } = {}) {
  return items
    .map(item => {
      const text = key ? item[key] : item;
      const result = fuzzyMatch(query, text, { caseSensitive });
      return { item, ...result };
    })
    .filter(r => r.match && r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}

export function closestMatch(query, candidates) {
  let best = null, bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein(query, c);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return { match: best, distance: bestDist };
}

export function damerauLevenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
      if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i-2][j-2] + cost);
      }
    }
  }
  return dp[m][n];
}
