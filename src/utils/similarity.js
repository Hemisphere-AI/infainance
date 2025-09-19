// Robust similarity scoring for fuzzy matching
// Uses Jaro-Winkler + token sort for normalized, bounded scoring (0..1)

function jaroWinkler(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase(); 
  b = b.toLowerCase();
  const m = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  let matchesA = new Array(a.length).fill(false);
  let matchesB = new Array(b.length).fill(false);
  let matches = 0, transpositions = 0;

  // Count matches
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - m);
    const end = Math.min(i + m + 1, b.length);
    for (let j = start; j < end; j++) {
      if (!matchesB[j] && a[i] === b[j]) {
        matchesA[i] = true; 
        matchesB[j] = true; 
        matches++; 
        break;
      }
    }
  }
  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (matchesA[i]) {
      while (!matchesB[k]) k++;
      if (a[i] !== b[k]) transpositions++;
      k++;
    }
  }
  transpositions = transpositions / 2;

  const j = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
  // Winkler prefix bonus
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

function normalizeForTokens(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenSortJaroWinkler(a, b) {
  const A = normalizeForTokens(a).split(" ").sort().join(" ");
  const B = normalizeForTokens(b).split(" ").sort().join(" ");
  return jaroWinkler(A, B);
}
