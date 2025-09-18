// A1 address conversion utilities for Excel-like cell references

export const A1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Convert Excel address (e.g., "B4") to row/column coordinates
 * @param {string} addr - Excel address like "B4" or "$B$4"
 * @returns {object} - {r: row, c: col} (1-indexed)
 */
export function addrToRC(addr) {
  const m = addr.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) throw new Error(`Bad address: ${addr}`);
  const col = m[1].split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
  const row = parseInt(m[2], 10);
  return { r: row, c: col };
}

/**
 * Convert row/column coordinates to Excel address
 * @param {number} r - Row number (1-indexed)
 * @param {number} c - Column number (1-indexed)
 * @returns {string} - Excel address like "B4"
 */
export function rcToAddr(r, c) {
  let col = "";
  let n = c;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return `${col}${r}`;
}

/**
 * Extract a range of cells from a 2D grid
 * @param {Array} grid - 2D array of data
 * @param {string} range - Excel range like "A1:D20"
 * @returns {Array} - 2D array of the specified range
 */
export function sliceRange(grid, range) {
  const [a, b] = range.split(":");
  const { r: r1, c: c1 } = addrToRC(a);
  const { r: r2, c: c2 } = addrToRC(b);
  const rr1 = Math.min(r1, r2), rr2 = Math.max(r1, r2);
  const cc1 = Math.min(c1, c2), cc2 = Math.max(c1, c2);
  const out = [];
  for (let r = rr1; r <= rr2; r++) {
    const row = [];
    for (let c = cc1; c <= cc2; c++) {
      row.push(grid[r-1]?.[c-1] ?? null);
    }
    out.push(row);
  }
  return out;
}

/**
 * Check if a string is a valid Excel address
 * @param {string} addr - String to check
 * @returns {boolean} - True if valid Excel address
 */
export function isValidAddress(addr) {
  return /^[A-Z]+[0-9]+$/i.test(addr);
}

/**
 * Get column letter from column index (0-indexed)
 * @param {number} index - Column index (0-indexed)
 * @returns {string} - Column letter(s)
 */
export function getColumnLetter(index) {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}

/**
 * Get column index from column letter
 * @param {string} letter - Column letter(s)
 * @returns {number} - Column index (0-indexed)
 */
export function getColumnIndex(letter) {
  return letter.split('').reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0) - 1;
}
