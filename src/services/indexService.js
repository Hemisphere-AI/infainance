// dependency-frames.js
//
// Dependency analysis and framing for UniverSpreadsheet data
// Analyzes formula dependencies and creates hierarchical frames
//
// Usage:
//   const analyzer = new DependencyAnalyzer();
//   const result = analyzer.analyzeSpreadsheetData(spreadsheetData);

// No external dependencies - pure JavaScript

// -----------------------------
// Types / Utilities
// -----------------------------

// Type definitions (for documentation)
// NodeKey: string - "Sheet!A1"
// SheetName: string
// CellNode: { sheet: string, addr: string }
// Graph: { dependents: Map, precedents: Map, allNodes: Set, formulaNodes: Set }

function keyOf(n) {
  return `${n.sheet}!${n.addr}`;
}
function parseKey(k) {
  const idx = k.indexOf("!");
  return { sheet: k.slice(0, idx), addr: k.slice(idx + 1) };
}

// A1 helpers

function stripDollar(a1) {
  return a1.replace(/\$/g, "");
}

function colToNum(col) {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64); // A=1 ... Z=26
  }
  return n;
}
function numToCol(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function a1ToRC(a1) {
  const clean = stripDollar(a1);
  const m = clean.match(/^([A-Z]{1,3})(\d+)$/);
  if (!m) throw new Error(`Bad A1: ${a1}`);
  const [, col, rowStr] = m;
  return { r: parseInt(rowStr, 10), c: colToNum(col) };
}
function rcToA1(r, c) {
  return `${numToCol(c)}${r}`;
}

// Parse A1 with absolute flags, e.g., $H28, H$28, $H$28
function parseA1WithAbs(a1) {
  const m = a1.match(/^(\$?)([A-Z]{1,3})(\$?)(\d+)$/);
  if (!m) throw new Error(`Bad A1: ${a1}`);
  const [, colAbs, col, rowAbs, rowStr] = m;
  return {
    r: parseInt(rowStr, 10),
    c: colToNum(col),
    absRow: rowAbs === '$',
    absCol: colAbs === '$',
  };
}

function tokenForRefCell(sheetName, a1, baseR, baseC) {
  const { r, c, absRow, absCol } = parseA1WithAbs(a1);
  const rToken = absRow ? `RABS:${r}` : `RREL:${r - baseR}`;
  const cToken = absCol ? `CABS:${c}` : `CREL:${c - baseC}`;
  const sToken = `S:${sheetName}`;
  return `${sToken},${rToken},${cToken}`;
}

function computeFormulaSignature(formula, baseR, baseC) {
  if (typeof formula !== 'string' || !formula.startsWith('=')) return null;
  let out = '';
  let last = 0;
  CELL_REF_RE.lastIndex = 0;
  let m;
  while ((m = CELL_REF_RE.exec(formula))) {
    const startIdx = m.index;
    out += formula.slice(last, startIdx);
    const [, sheet1, start, sheet2, end] = m;
    const s1 = sheet1 || 'Sheet1';
    if (end) {
      const s2 = sheet2 || s1;
      const tStart = tokenForRefCell(s1, start, baseR, baseC);
      const tEnd = tokenForRefCell(s2, end, baseR, baseC);
      out += `RANGE(${tStart}->${tEnd})`;
    } else {
      const t = tokenForRefCell(s1, start, baseR, baseC);
      out += `REF(${t})`;
    }
    last = CELL_REF_RE.lastIndex;
  }
  out += formula.slice(last);
  // Normalize case and whitespace
  return out.replace(/\s+/g, '').toUpperCase();
}

// Expand ranges like A1:C3 -> ["A1","B1","C1","A2",...]
function expandRange(start, end) {
  const s = a1ToRC(start);
  const e = a1ToRC(end);
  const rlo = Math.min(s.r, e.r);
  const rhi = Math.max(s.r, e.r);
  const clo = Math.min(s.c, e.c);
  const chi = Math.max(s.c, e.c);
  const out = [];
  for (let r = rlo; r <= rhi; r++) {
    for (let c = clo; c <= chi; c++) {
      out.push(rcToA1(r, c));
    }
  }
  return out;
}

// -----------------------------
// Formula reference parsing
// -----------------------------

// Matches optional quoted sheet, a cell, and optional range end.
// Examples captured: A1, $B$2, 'Other Sheet'!C3, A1:C9, 'S'!A1:'S'!C3, 'S'!A1:C3
const CELL_REF_RE =
  /(?:'([^']+)'!)?(\$?[A-Z]{1,3}\$?\d+)(?:\s*:\s*(?:'([^']+)'!)?(\$?[A-Z]{1,3}\$?\d+))?/g;

function* iterCellRefs(formula) {
  if (typeof formula !== "string" || !formula.startsWith("=")) return;
  let m;
  while ((m = CELL_REF_RE.exec(formula))) {
    const [, sheet1, start, sheet2, end] = m;
    if (end) {
      yield { sheet: sheet1, start, end: { sheet: sheet2, addr: end } };
    } else {
      yield { sheet: sheet1, start };
    }
  }
}

// -----------------------------
// Graph builder for UniverSpreadsheet data
// -----------------------------

function buildDependencyGraphFromSpreadsheetData(spreadsheetData, allSheetsData = {}) {
  const dependents = new Map();
  const precedents = new Map();
  const allNodes = new Set();
  const formulaNodes = new Set();
  const referencedNodes = new Set(); // Track cells that are referenced by formulas
  const dateNodes = new Set(); // Track cells that contain dates
  const nodeMeta = new Map(); // nodeK -> { r, c, formula, refOffsets: [{dr,dc}], adjOffset: {dr,dc}|null, isDate: boolean }
  
  // Helper function to get cell data from any sheet
  const getCellFromSheet = (sheetName, rowIndex, colIndex) => {
    if (sheetName === "Sheet1") {
      return spreadsheetData[rowIndex]?.[colIndex];
    } else {
      const sheetData = allSheetsData[sheetName];
      if (sheetData && sheetData.spreadsheetData) {
        return sheetData.spreadsheetData[rowIndex]?.[colIndex];
      }
    }
    return null;
  };

  // Helper function to detect if a cell is formatted as a date
  const isDateFormatted = (cell) => {
    if (!cell) return false;
    
    // First check if the cell has a value (not empty, null, or undefined)
    const hasValue = cell.value !== null && 
                    cell.value !== undefined && 
                    cell.value !== '' && 
                    String(cell.value).trim() !== '';
    
    if (!hasValue) return false;
    
    // Check if the cell has explicit date formatting properties
    if (cell.isDate === true) return true;
    if (cell.cellType === 'date') return true;
    
    // Check for specific date number formats (not currency)
    if (cell.numberFormat) {
      const format = cell.numberFormat.toLowerCase();
      // Look for specific date format patterns, not just any 'd', 'm', 'y'
      if (format.includes('mm/dd/yyyy') || 
          format.includes('dd/mm/yyyy') || 
          format.includes('yyyy-mm-dd') ||
          format.includes('mm/dd/yy') ||
          format.includes('dd/mm/yy') ||
          format.includes('m/d/yyyy') ||
          format.includes('d/m/yyyy') ||
          format.includes('mmm dd, yyyy') ||
          format.includes('mmmm dd, yyyy') ||
          format.includes('dd-mmm-yy') ||
          format.includes('dd-mmm-yyyy') ||
          format.includes('date')) {
        return true;
      }
      
      // Exclude currency formats that might contain 'd', 'm', 'y'
      if (format.includes('€') || 
          format.includes('$') || 
          format.includes('currency') ||
          format.includes('money') ||
          format.includes('euro') ||
          format.includes('dollar')) {
        return false;
      }
    }
    
    // Check if the display value looks like a date (strict patterns only)
    const displayValue = cell.displayValue || cell.value;
    if (typeof displayValue === 'string') {
      const trimmed = displayValue.trim();
      // Only check for clear date patterns, not currency symbols
      if (trimmed.includes('€') || trimmed.includes('$') || trimmed.includes('currency')) {
        return false;
      }
      
      // Check for common date display patterns
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed) || // MM/DD/YYYY
          /^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed) || // YYYY-MM-DD
          /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(trimmed) || // MM-DD-YYYY
          /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(trimmed) || // MM.DD.YYYY
          /^\d{1,2}\/\d{1,2}$/.test(trimmed) || // MM/DD
          /^\d{1,2}-\d{1,2}$/.test(trimmed)) { // MM-DD
        return true;
      }
    }
    
    // Check if it's a Date object
    if (displayValue instanceof Date) return !isNaN(displayValue.getTime());
    
    return false;
  };

  // Additional validation: check if values in a pattern actually look like dates
  const validateDatePattern = (startRow, endRow, startCol, endCol, spreadsheetData) => {
    let dateCount = 0;
    let totalCount = 0;
    
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = spreadsheetData[r]?.[c];
        if (!cell) continue;
        
        totalCount++;
        
        // Check if the cell is formatted as a date
        if (isDateFormatted(cell)) {
          dateCount++;
        }
      }
    }
    
    // At least 50% of cells should be formatted as dates, and we need at least 2 cells
    return totalCount >= 2 && (dateCount / totalCount) >= 0.5;
  };

  // Enhanced function to detect date patterns with more flexible criteria
  const detectDatePatternEnhanced = (rowIndex, colIndex, spreadsheetData) => {
    const patterns = [];
    const cell = spreadsheetData[rowIndex]?.[colIndex];
    if (!cell) return patterns;
    
    // Check if this cell is formatted as a date
    if (!isDateFormatted(cell)) return patterns;
    
    // Check horizontal patterns (same row)
    let startCol = colIndex;
    let endCol = colIndex;
    
    // Expand left
    while (startCol > 0) {
      const leftCell = spreadsheetData[rowIndex]?.[startCol - 1];
      const leftValue = leftCell?.value;
      if (leftValue === null || leftValue === undefined || leftValue === '') break;
      
      const couldBeDateLeft = isDateFormatted(leftCell);
      
      if (!couldBeDateLeft) break;
      startCol--;
    }
    
    // Expand right
    while (endCol < (spreadsheetData[rowIndex]?.length || 0) - 1) {
      const rightCell = spreadsheetData[rowIndex]?.[endCol + 1];
      const rightValue = rightCell?.value;
      if (rightValue === null || rightValue === undefined || rightValue === '') break;
      
      const couldBeDateRight = isDateFormatted(rightCell);
      
      if (!couldBeDateRight) break;
      endCol++;
    }
    
    if (endCol > startCol && validateDatePattern(rowIndex, rowIndex, startCol, endCol, spreadsheetData)) {
      patterns.push({
        type: 'horizontal',
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: startCol,
        endCol: endCol,
        range: `${rcToA1(rowIndex + 1, startCol + 1)}:${rcToA1(rowIndex + 1, endCol + 1)}`
      });
    }
    
    // Check vertical patterns (same column)
    let startRow = rowIndex;
    let endRow = rowIndex;
    
    // Expand up
    while (startRow > 0) {
      const upCell = spreadsheetData[startRow - 1]?.[colIndex];
      const upValue = upCell?.value;
      if (upValue === null || upValue === undefined || upValue === '') break;
      
      const couldBeDateUp = isDateFormatted(upCell);
      
      if (!couldBeDateUp) break;
      startRow--;
    }
    
    // Expand down
    while (endRow < spreadsheetData.length - 1) {
      const downCell = spreadsheetData[endRow + 1]?.[colIndex];
      const downValue = downCell?.value;
      if (downValue === null || downValue === undefined || downValue === '') break;
      
      const couldBeDateDown = isDateFormatted(downCell);
      
      if (!couldBeDateDown) break;
      endRow++;
    }
    
    if (endRow > startRow && validateDatePattern(startRow, endRow, colIndex, colIndex, spreadsheetData)) {
      patterns.push({
        type: 'vertical',
        startRow: startRow,
        endRow: endRow,
        startCol: colIndex,
        endCol: colIndex,
        range: `${rcToA1(startRow + 1, colIndex + 1)}:${rcToA1(endRow + 1, colIndex + 1)}`
      });
    }
    
    return patterns;
  };


  // First pass: identify formula cells, date cells, and their references
  for (let rowIndex = 0; rowIndex < spreadsheetData.length; rowIndex++) {
    const row = spreadsheetData[rowIndex];
    if (!row) continue;

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex];
      if (!cell) continue;

      const cellAddr = rcToA1(rowIndex + 1, colIndex + 1);
      const nodeK = keyOf({ sheet: "Sheet1", addr: cellAddr });
      const cellValue = String(cell?.value || '');
      
      // Check if this cell is formatted as a date
      const isDate = isDateFormatted(cell);
      
      if (isDate) {
        dateNodes.add(nodeK);
        allNodes.add(nodeK);
      }

      // Check if this cell contains a formula
      if (cellValue.startsWith('=')) {
        formulaNodes.add(nodeK);
        allNodes.add(nodeK);

        // Track reference offsets relative to this cell
        const refOffsets = [];

        // Extract cell references from the formula
        for (const refObj of iterCellRefs(cellValue)) {
          const startSheet = refObj.sheet || "Sheet1";
          if (refObj.end) {
            const endSheet = refObj.end.sheet || startSheet;
            if (endSheet !== startSheet) {
              // Fallback: treat only the start cell to be conservative
              const srcAddr = stripDollar(refObj.start);
              const srcK = keyOf({ sheet: startSheet, addr: srcAddr });
              referencedNodes.add(srcK);
              allNodes.add(srcK);
              addEdge(srcK, nodeK, dependents, precedents);
              const rc = a1ToRC(srcAddr);
              refOffsets.push({ dr: rc.r - (rowIndex + 1), dc: rc.c - (colIndex + 1) });
            } else {
              for (const a1 of expandRange(stripDollar(refObj.start), stripDollar(refObj.end.addr))) {
                const srcK = keyOf({ sheet: startSheet, addr: a1 });
                referencedNodes.add(srcK);
                allNodes.add(srcK);
                addEdge(srcK, nodeK, dependents, precedents);
                const rc = a1ToRC(a1);
                refOffsets.push({ dr: rc.r - (rowIndex + 1), dc: rc.c - (colIndex + 1) });
              }
            }
          } else {
            const srcAddr = stripDollar(refObj.start);
            const srcK = keyOf({ sheet: startSheet, addr: srcAddr });
            referencedNodes.add(srcK);
            allNodes.add(srcK);
            addEdge(srcK, nodeK, dependents, precedents);
            const rc = a1ToRC(srcAddr);
            refOffsets.push({ dr: rc.r - (rowIndex + 1), dc: rc.c - (colIndex + 1) });
            
            // Use getCellFromSheet to validate the referenced cell exists
            const referencedCell = getCellFromSheet(startSheet, rc.r - 1, rc.c - 1);
            if (referencedCell) {
              // Cell exists and can be referenced
            }
          }
        }

        // Compute single adjacent offset if applicable (one referenced cell and adjacent only)
        let adjOffset = null;
        if (refOffsets.length === 1) {
          const off = refOffsets[0];
          const manhattan = Math.abs(off.dr) + Math.abs(off.dc);
          if (manhattan === 1) adjOffset = off; // up/down/left/right
        }

        nodeMeta.set(nodeK, {
          r: rowIndex + 1,
          c: colIndex + 1,
          formula: cellValue,
          refOffsets,
          adjOffset,
          signature: computeFormulaSignature(cellValue, rowIndex + 1, colIndex + 1),
          isDate: false
        });
      } else if (isDate) {
        // Store metadata for date cells
        nodeMeta.set(nodeK, {
          r: rowIndex + 1,
          c: colIndex + 1,
          formula: null,
          refOffsets: [],
          adjOffset: null,
          signature: null,
          isDate: true,
          dateValue: cell?.value
        });
      }
    }
  }

  // Second pass: detect date patterns and group them
  const datePatterns = new Map(); // patternId -> { ranges: [], type: 'horizontal'|'vertical', layer: number }
  const processedCells = new Set();
  
  for (let rowIndex = 0; rowIndex < spreadsheetData.length; rowIndex++) {
    const row = spreadsheetData[rowIndex];
    if (!row) continue;

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex];
      if (!cell) continue;

      const cellAddr = rcToA1(rowIndex + 1, colIndex + 1);
      const nodeK = keyOf({ sheet: "Sheet1", addr: cellAddr });
      
      if (isDateFormatted(cell) && !processedCells.has(nodeK)) {
        const patterns = detectDatePatternEnhanced(rowIndex, colIndex, spreadsheetData);
        
        patterns.forEach((pattern) => {
          // Mark all cells in this pattern as processed
          for (let r = pattern.startRow; r <= pattern.endRow; r++) {
            for (let c = pattern.startCol; c <= pattern.endCol; c++) {
              const patternCellAddr = rcToA1(r + 1, c + 1);
              const patternNodeK = keyOf({ sheet: "Sheet1", addr: patternCellAddr });
              processedCells.add(patternNodeK);
            }
          }
          
          const patternId = `date_${rowIndex}_${colIndex}_${Math.random()}`;
          datePatterns.set(patternId, {
            ranges: [pattern.range],
            type: pattern.type,
            layer: 0, // Date patterns get layer 0 (highest priority, green color)
            cells: []
          });
        });
      }
    }
  }

  // Only include nodes that are either formula cells or are referenced by formulas
  // This ensures we don't include empty cells like B10 that have no formula and are not referenced
  const finalNodes = new Set();
  for (const node of allNodes) {
    if (formulaNodes.has(node) || referencedNodes.has(node)) {
      finalNodes.add(node);
    }
  }

  // ensure every final node exists in maps
  for (const k of finalNodes) {
    if (!dependents.has(k)) dependents.set(k, new Set());
    if (!precedents.has(k)) precedents.set(k, new Set());
  }

  return { 
    dependents, 
    precedents, 
    allNodes: finalNodes, 
    formulaNodes, 
    dateNodes,
    datePatterns,
    nodeMeta 
  };
}

function addEdge(srcK, dstK, dependents, precedents) {
  if (!dependents.has(srcK)) dependents.set(srcK, new Set());
  if (!precedents.has(dstK)) precedents.set(dstK, new Set());
  dependents.get(srcK).add(dstK);
  precedents.get(dstK).add(srcK);
}

// -----------------------------
// Layering (forward topological from inputs)
// -----------------------------

function forwardTopoLayers(graph) {
  const remaining = new Set(graph.allNodes);
  const precedents = new Map();
  for (const k of remaining) precedents.set(k, new Set(graph.precedents.get(k)));

  const layers = [];

  while (remaining.size > 0) {
    // sources = nodes with no precedents (inputs)
    const sources = [];
    for (const k of remaining) {
      if ((precedents.get(k) || new Set()).size === 0) sources.push(k);
    }
    let layer;
    if (sources.length === 0) {
      // cycle or closed group: pick nodes with minimal in-degree
      let min = Infinity;
      for (const k of remaining) {
        const deg = (precedents.get(k) || new Set()).size;
        if (deg < min) min = deg;
      }
      layer = [...remaining].filter((k) => (precedents.get(k) || new Set()).size === min);
    } else {
      layer = sources;
    }

    layer.sort(); // stable output
    layers.push(layer);

    // remove layer
    for (const s of layer) remaining.delete(s);
    for (const k of remaining) {
      const set = precedents.get(k);
      for (const s of layer) set.delete(s);
    }
  }
  return layers;
}


// -----------------------------
// Frames (merge contiguous)
// -----------------------------

function contiguousRangesSameRow(addrs) {
  const byRow = new Map();
  for (const a of addrs) {
    const { r, c } = a1ToRC(a);
    const arr = byRow.get(r) || [];
    arr.push(c);
    byRow.set(r, arr);
  }
  const frames = [];
  for (const [r, cols] of byRow.entries()) {
    cols.sort((a, b) => a - b);
    let start = cols[0];
    let prev = start;
    for (let i = 1; i < cols.length; i++) {
      const c = cols[i];
      if (c === prev + 1) {
        prev = c;
      } else {
        frames.push(start === prev ? rcToA1(r, start) : `${rcToA1(r, start)}:${rcToA1(r, prev)}`);
        start = prev = c;
      }
    }
    frames.push(start === prev ? rcToA1(r, start) : `${rcToA1(r, start)}:${rcToA1(r, prev)}`);
  }
  return frames;
}

function contiguousRangesSameCol(addrs) {
  const byCol = new Map();
  for (const a of addrs) {
    const { r, c } = a1ToRC(a);
    const arr = byCol.get(c) || [];
    arr.push(r);
    byCol.set(c, arr);
  }
  const frames = [];
  for (const [c, rows] of byCol.entries()) {
    rows.sort((a, b) => a - b);
    let start = rows[0];
    let prev = start;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r === prev + 1) {
        prev = r;
      } else {
        frames.push(start === prev ? rcToA1(start, c) : `${rcToA1(start, c)}:${rcToA1(prev, c)}`);
        start = prev = r;
      }
    }
    frames.push(start === prev ? rcToA1(start, c) : `${rcToA1(start, c)}:${rcToA1(prev, c)}`);
  }
  return frames;
}

function framesForLayers(layers) {
  // Return: [{ layer, horizontal: [...], vertical: [...] }, ...]
  return layers.map((layer, idx) => {
    const addrs = layer.map((k) => parseKey(k).addr);
    return {
      layer: idx,
      horizontal: contiguousRangesSameRow(addrs),
      vertical: contiguousRangesSameCol(addrs),
    };
  });
}


// -----------------------------
// Adjacent replicated formulas grouping
// -----------------------------

function computeReplicatedFormulaGroups(graph) {
  // Union-Find helpers
  const parent = new Map();
  function find(x) {
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)));
    }
    return parent.get(x);
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    // Simple lexical choose stable root
    const root = ra < rb ? ra : rb;
    const other = ra < rb ? rb : ra;
    parent.set(other, root);
  }

  // Initialize parent for every node we might touch
  for (const k of graph.allNodes) parent.set(k, k);

  // Build coordinate index for formula nodes
  const coordToNode = new Map(); // key "r,c" -> nodeK
  for (const k of graph.formulaNodes) {
    const meta = graph.nodeMeta?.get(k);
    if (!meta) continue;
    coordToNode.set(`${meta.r},${meta.c}`, k);
  }

  // Connect adjacent replicated formulas with the same canonical signature
  for (const k of graph.formulaNodes) {
    const meta = graph.nodeMeta?.get(k);
    if (!meta) continue;
    const neighbors = [
      [meta.r + 1, meta.c],
      [meta.r - 1, meta.c],
      [meta.r, meta.c + 1],
      [meta.r, meta.c - 1],
    ];
    for (const [nr, nc] of neighbors) {
      const neighbor = coordToNode.get(`${nr},${nc}`);
      if (!neighbor) continue;
      const nmeta = graph.nodeMeta?.get(neighbor);
      if (!nmeta) continue;
      if (nmeta.signature && meta.signature && nmeta.signature === meta.signature) {
        union(k, neighbor);
      }
    }
  }

  // Build groups: ensure all nodes (including non-formula, referenced-only) exist
  const groupByNode = new Map();
  for (const k of graph.allNodes) {
    if (!parent.has(k)) parent.set(k, k);
    groupByNode.set(k, find(k));
  }

  // Normalize group ids to a canonical representative (lexicographically smallest member)
  const membersByGroup = new Map();
  for (const [node, root] of groupByNode.entries()) {
    const g = membersByGroup.get(root) || new Set();
    g.add(node);
    membersByGroup.set(root, g);
  }
  const canonicalByRoot = new Map();
  for (const [root, memSet] of membersByGroup.entries()) {
    const arr = [...memSet];
    arr.sort();
    canonicalByRoot.set(root, arr[0]);
    membersByGroup.set(root, new Set(arr));
  }

  // Remap groupByNode to canonical group ids
  for (const [node, root] of groupByNode.entries()) {
    groupByNode.set(node, canonicalByRoot.get(root));
  }
  const membersByCanonical = new Map();
  for (const [root, memSet] of membersByGroup.entries()) {
    const canon = canonicalByRoot.get(root);
    membersByCanonical.set(canon, memSet);
  }

  return { groupByNode, membersByGroup: membersByCanonical };
}

function compressGraphByGroups(graph, groups) {
  const gDependents = new Map();
  const gPrecedents = new Map();
  const gAllNodes = new Set();
  const gFormulaNodes = new Set();

  function ensureNode(k) {
    if (!gDependents.has(k)) gDependents.set(k, new Set());
    if (!gPrecedents.has(k)) gPrecedents.set(k, new Set());
    gAllNodes.add(k);
  }

  // Prepare group membership for all nodes
  const groupOf = (nodeK) => groups.groupByNode.get(nodeK) || nodeK;

  for (const src of graph.dependents.keys()) {
    const srcG = groupOf(src);
    ensureNode(srcG);
    for (const dst of graph.dependents.get(src)) {
      const dstG = groupOf(dst);
      ensureNode(dstG);
      if (srcG === dstG) continue;
      gDependents.get(srcG).add(dstG);
      gPrecedents.get(dstG).add(srcG);
    }
  }

  // Formula groups: any group that contains at least one formula node
  for (const g of gAllNodes) {
    const members = groups.membersByGroup.get(g) || new Set([g]);
    for (const m of members) {
      if (graph.formulaNodes.has(m)) {
        gFormulaNodes.add(g);
        break;
      }
    }
  }

  return {
    dependents: gDependents,
    precedents: gPrecedents,
    allNodes: gAllNodes,
    formulaNodes: gFormulaNodes,
  };
}

function expandGroupLayersToNodes(groupLayers, groups) {
  // Flatten each group back to node keys; keep stable sorted order within groups
  const layers = [];
  for (const layer of groupLayers) {
    const expanded = [];
    for (const g of layer) {
      const memSet = groups.membersByGroup.get(g);
      if (!memSet) {
        expanded.push(g);
        continue;
      }
      const arr = [...memSet];
      arr.sort();
      expanded.push(...arr);
    }
    layers.push(expanded);
  }
  return layers;
}

function reverseGraph(graph) {
  // Swap dependents and precedents
  const dependents = new Map();
  const precedents = new Map();
  for (const k of graph.allNodes) {
    dependents.set(k, new Set(graph.precedents.get(k) || []));
    precedents.set(k, new Set(graph.dependents.get(k) || []));
  }
  return { dependents, precedents, allNodes: new Set(graph.allNodes), formulaNodes: new Set(graph.formulaNodes) };
}


// -----------------------------
// Main DependencyAnalyzer class
// -----------------------------

class DependencyAnalyzer {
  constructor() {
    this.dependents = new Map();
    this.precedents = new Map();
    this.allNodes = new Set();
    this.formulaNodes = new Set();
    this.textIndexer = new TextLabelIndexer();
  }

  analyzeSpreadsheetData(spreadsheetData, allSheetsData = {}) {
    // Step 1: Build text/label index
    this.textIndexer.buildTextIndex(spreadsheetData);
    this.textIndexer.detectSectionHeaders();
    this.textIndexer.detectGlobalDateHeader();
    
    const graph = buildDependencyGraphFromSpreadsheetData(spreadsheetData, allSheetsData);

    // Group adjacent replicated formulas so they share the same depth layer
    const groups = computeReplicatedFormulaGroups(graph);
    const compressed = compressGraphByGroups(graph, groups);

    // Compute layers from outputs backward: nodes feeding same outputs share distance from outputs
    const reversed = reverseGraph(compressed);
    const groupLayers = forwardTopoLayers(reversed);
    const layers = expandGroupLayersToNodes(groupLayers, groups);
    const frames = framesForLayers(layers);
    
    // Step 2: Label frames with text/label information
    const labeledFrames = frames.map(frame => {
      const labels = this.textIndexer.labelFrame(frame, spreadsheetData, graph.dateFrames);
      return {
        ...frame,
        labels: labels
      };
    });
    
    // Add date patterns as special frames with green color
    const dateFrames = [];
    if (graph.datePatterns) {
      graph.datePatterns.forEach((pattern) => {
        pattern.ranges.forEach(range => {
          dateFrames.push({
            range: range,
            color: '#22c55e', // Green color for dates
            type: pattern.type,
            layer: 0, // Date patterns are layer 0 (highest priority)
            depthFromInput: 0,
            isDatePattern: true
          });
        });
      });
    }
    
    return {
      layers,
      frames: labeledFrames,
      dateFrames,
      graph,
      spreadsheetData,
      textIndex: {
        textCells: this.textIndexer.textCells,
        sectionHeaders: this.textIndexer.sectionHeaders,
        globalDateHeader: this.textIndexer.globalDateHeader
      }
    };
  }


  // Export results to CSV format (matching the expected output)
  exportToCSV(result) {
    const layersCSV = [];
    const framesCSV = [];
    
    // Generate layers CSV
    layersCSV.push("layer,sheet,addr");
    result.layers.forEach((layer, layerIndex) => {
      layer.forEach(nodeKey => {
        const { sheet, addr } = parseKey(nodeKey);
        layersCSV.push(`${layerIndex},${sheet},${addr}`);
      });
    });
    
    // Generate frames CSV
    framesCSV.push("layer,frame_type,span");
    result.frames.forEach(frame => {
      frame.horizontal.forEach(span => {
        framesCSV.push(`${frame.layer},horizontal_frames,${span}`);
      });
      frame.vertical.forEach(span => {
        framesCSV.push(`${frame.layer},vertical_frames,${span}`);
      });
    });
    
    return {
      layers: layersCSV.join('\n'),
      frames: framesCSV.join('\n')
    };
  }
}

// Text/Label Indexing System for Dependency Analyzer
class TextLabelIndexer {
  constructor() {
    this.textCells = [];
    this.textIndexByRC = new Map();
    this.sectionHeaders = [];
    this.globalDateHeader = null;
    this.maxGapCols = 10; // Increased to allow searching up to 10 columns to the left
    this.maxGapRows = 30; // Increased to allow searching up to 30 rows (G30 to G3)
    this.whiteRowTolerance = 3;
  }

  /**
   * Convert column letter to number (A=1, B=2, etc.)
   */
  colToNum(col) {
    let n = 0;
    for (let i = 0; i < col.length; i++) {
      n = n * 26 + (col.charCodeAt(i) - 64); // A=1 ... Z=26
    }
    return n;
  }

  /**
   * Check if a cell contains text (non-empty, not formula, not date, not number)
   */
  isTextCell(cell) {
    if (!cell) return false;
    if (cell.value == null) return false;
    const s = String(cell.value).trim();
    if (!s) return false;
    
    // Exclude formulas
    if (String(cell.value).startsWith('=')) return false;
    
    // Exclude dates
    if (this.isDateFormatted(cell)) return false;
    
    // Exclude obvious numbers/currency
    if (!isNaN(Number(s.replace(/[.,\s]/g, '')))) return false;
    
    // Exclude cells that look like currency values (€30, $50, etc.)
    if (/^[€$£¥]\d+/.test(s)) return false;
    
    // Exclude cells that are just numbers with currency symbols
    if (/^\d+[€$£¥]/.test(s)) return false;
    
    // Exclude currency values with spaces (€ 37,500, $ 100, etc.)
    if (/^[€$£¥]\s*[\d,]+/.test(s) || /[\d,]+[€$£¥]/.test(s)) return false;
    
    return true;
  }

  /**
   * Check if a cell is date formatted
   */
  isDateFormatted(cell) {
    if (!cell) return false;
    const value = cell.value;
    if (typeof value === 'string') {
      // Check for common date patterns
      const datePatterns = [
        /^\d{1,2}\/\d{1,2}\/\d{4}$/,
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{1,2}-\d{1,2}-\d{4}$/,
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
        /^(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i
      ];
      return datePatterns.some(pattern => pattern.test(value));
    }
    return false;
  }

  /**
   * Extract style information from cell
   */
  getStyleBits(cell) {
    return {
      bold: cell.bold || false,
      fill: cell.fill || null,
      merged: cell.merged || false,
      borderInfo: cell.borderInfo || null,
      font: cell.font || null
    };
  }

  /**
   * Build text index during first pass
   */
  buildTextIndex(spreadsheetData) {
    this.textCells = [];
    this.textIndexByRC.clear();
    
    for (let rowIndex = 0; rowIndex < spreadsheetData.length; rowIndex++) {
      const row = spreadsheetData[rowIndex];
      if (!row) continue;
      
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex];
        if (this.isTextCell(cell)) {
          const textCell = {
            r: rowIndex + 1,
            c: colIndex + 1,
            text: String(cell.value).trim(),
            rawText: String(cell.value),
            normalizedText: String(cell.value).toLowerCase().replace(/\s+/g, ' ').trim(),
            ...this.getStyleBits(cell),
            isLeftLabel: colIndex <= 2, // Columns A-C
            isTopLabel: rowIndex <= 2   // Rows 1-3
          };
          
          this.textCells.push(textCell);
          this.textIndexByRC.set(`${rowIndex + 1},${colIndex + 1}`, textCell);
        }
      }
    }
    
    console.log(`Built text index with ${this.textCells.length} text cells`);
  }

  /**
   * Find nearest text cell to the left
   */
  nearestLeftText(r, cStart, maxGap = null, spreadsheetData = null) {
    const gap = maxGap || this.maxGapCols;
    console.log(`Searching for row label to the left of row ${r}, column ${cStart}, max gap: ${gap}`);
    
    for (let c = cStart - 1, step = 1; c >= 1 && step <= gap; c--, step++) {
      console.log(`Checking row ${r}, column ${c}, step ${step}`);
      
      // First check the text index
      const hit = this.textIndexByRC.get(`${r},${c}`);
      if (hit) {
        console.log(`Found in text index: ${hit.text}`);
        // Check if this is a reference cell (starts with =) or blank
        const cellValue = String(hit.rawText || hit.text || '');
        if (cellValue.startsWith('=') || cellValue.trim() === '') {
          console.log(`Skipping reference/blank: ${cellValue}`);
          // Skip reference cells and blanks, continue searching
          continue;
        }
        
        // Additional checks for currency values and numbers
        if (/^[€$£¥]\d+/.test(cellValue) || /^\d+[€$£¥]/.test(cellValue)) {
          console.log(`Skipping currency: ${cellValue}`);
          // Skip currency values, continue searching
          continue;
        }
        
        // Skip if it's just a number
        if (!isNaN(Number(cellValue.replace(/[.,\s]/g, '')))) {
          console.log(`Skipping number: ${cellValue}`);
          continue;
        }
        
        console.log(`Found valid text label: ${cellValue}`);
        return { ...hit, gap: step, dir: 'left' };
      }
      
      // If not in text index, check the actual spreadsheet data
      if (spreadsheetData && spreadsheetData[r-1] && spreadsheetData[r-1][c-1]) {
        const cell = spreadsheetData[r-1][c-1];
        const cellValue = String(cell.value || '');
        console.log(`Found in raw data: ${cellValue}`);
        
        // Skip if blank or empty
        if (!cellValue || cellValue.trim() === '') {
          console.log(`Skipping blank: ${cellValue}`);
          continue;
        }
        
        // Skip formulas
        if (cellValue.startsWith('=')) {
          console.log(`Skipping formula: ${cellValue}`);
          continue;
        }
        
        // Skip currency values and numbers
        if (/^[€$£¥]\d+/.test(cellValue) || /^\d+[€$£¥]/.test(cellValue)) {
          console.log(`Skipping currency: ${cellValue}`);
          continue;
        }
        
        // Skip currency values with spaces (€ 37,500, $ 100, etc.)
        if (/^[€$£¥]\s*[\d,]+/.test(cellValue) || /[\d,]+[€$£¥]/.test(cellValue)) {
          console.log(`Skipping currency with space: ${cellValue}`);
          continue;
        }
        
        if (!isNaN(Number(cellValue.replace(/[.,\s]/g, '')))) {
          console.log(`Skipping number: ${cellValue}`);
          continue;
        }
        
        // This looks like a valid text label
        console.log(`Found valid text label in raw data: ${cellValue}`);
        return {
          r: r,
          c: c,
          text: cellValue,
          rawText: cellValue,
          gap: step,
          dir: 'left',
          bold: cell.bold || false,
          merged: cell.merged || false
        };
      } else {
        console.log(`No data found at row ${r}, column ${c}`);
      }
    }
    console.log(`No row label found to the left of row ${r}, column ${cStart}`);
    return null;
  }

  /**
   * Find nearest text cell above
   */
  nearestUpText(rStart, c, maxGap = null, spreadsheetData = null, dateFrames = null) {
    const gap = maxGap || this.maxGapRows;
    console.log(`Searching for column label above row ${rStart}, column ${c}, max gap: ${gap}`);
    
    for (let r = rStart - 1, step = 1; r >= 1 && step <= gap; r--, step++) {
      console.log(`Checking row ${r}, column ${c}, step ${step}`);
      
      // First check the text index
      const hit = this.textIndexByRC.get(`${r},${c}`);
      if (hit) {
        console.log(`Found in text index: ${hit.text}`);
        // Check if this is a reference cell (starts with =) or blank
        const cellValue = String(hit.rawText || hit.text || '');
        if (cellValue.startsWith('=') || cellValue.trim() === '') {
          console.log(`Skipping reference/blank: ${cellValue}`);
          // Skip reference cells and blanks, continue searching
          continue;
        }
        
        // Additional checks for currency values and numbers
        if (/^[€$£¥]\d+/.test(cellValue) || /^\d+[€$£¥]/.test(cellValue)) {
          console.log(`Skipping currency: ${cellValue}`);
          // Skip currency values, continue searching
          continue;
        }
        
        // Skip if it's just a number
        if (!isNaN(Number(cellValue.replace(/[.,\s]/g, '')))) {
          console.log(`Skipping number: ${cellValue}`);
          continue;
        }
        
        console.log(`Found valid text label: ${cellValue}`);
        return { ...hit, gap: step, dir: 'up' };
      }
      
      // If not in text index, check the actual spreadsheet data
      if (spreadsheetData && spreadsheetData[r-1] && spreadsheetData[r-1][c-1]) {
        const cell = spreadsheetData[r-1][c-1];
        const cellValue = String(cell.value || '');
        console.log(`Found in raw data: ${cellValue}`);
        
        // Skip if blank or empty
        if (!cellValue || cellValue.trim() === '') {
          console.log(`Skipping blank: ${cellValue}`);
          continue;
        }
        
        // Skip formulas
        if (cellValue.startsWith('=')) {
          console.log(`Skipping formula: ${cellValue}`);
          continue;
        }
        
        // Skip currency values and numbers
        if (/^[€$£¥]\d+/.test(cellValue) || /^\d+[€$£¥]/.test(cellValue)) {
          console.log(`Skipping currency: ${cellValue}`);
          continue;
        }
        
        // Skip currency values with spaces (€ 37,500, $ 100, etc.)
        if (/^[€$£¥]\s*[\d,]+/.test(cellValue) || /[\d,]+[€$£¥]/.test(cellValue)) {
          console.log(`Skipping currency with space: ${cellValue}`);
          continue;
        }
        
        if (!isNaN(Number(cellValue.replace(/[.,\s]/g, '')))) {
          console.log(`Skipping number: ${cellValue}`);
          continue;
        }
        
        // Check if this cell is in a date range (date frames)
        let isInDateRange = false;
        if (dateFrames) {
          for (const dateFrame of dateFrames) {
            if (dateFrame.range) {
              // Parse the date range (e.g., "G3:J3")
              const rangeMatch = dateFrame.range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
              if (rangeMatch) {
                const [, startCol, startRow, endCol, endRow] = rangeMatch;
                const startColNum = this.colToNum(startCol);
                const endColNum = this.colToNum(endCol);
                const startRowNum = parseInt(startRow);
                const endRowNum = parseInt(endRow);
                
                if (r >= startRowNum && r <= endRowNum && c >= startColNum && c <= endColNum) {
                  console.log(`Cell is in date range: ${dateFrame.range}`);
                  isInDateRange = true;
                  break;
                }
              }
            }
          }
        }
        
        // Accept as valid label if it's text OR if it's in a date range
        if (isInDateRange || cellValue.trim() !== '') {
          console.log(`Found valid text label in raw data: ${cellValue}${isInDateRange ? ' (in date range)' : ''}`);
          return {
            r: r,
            c: c,
            text: cellValue,
            rawText: cellValue,
            gap: step,
            dir: 'up',
            bold: cell.bold || false,
            merged: cell.merged || false,
            isDateRange: isInDateRange
          };
        }
      } else {
        console.log(`No data found at row ${r}, column ${c}`);
      }
    }
    console.log(`No column label found above row ${rStart}, column ${c}`);
    return null;
  }

  /**
   * Detect section headers by scanning columns A and B
   */
  detectSectionHeaders() {
    this.sectionHeaders = [];
    
    // Scan column A (index 0)
    this.scanColumnForSections(0);
    
    // Scan column B (index 1) if it has different content
    this.scanColumnForSections(1);
    
    // Sort by row start
    this.sectionHeaders.sort((a, b) => a.rStart - b.rStart);
    
    console.log(`Detected ${this.sectionHeaders.length} section headers`);
  }

  /**
   * Scan a specific column for section headers
   */
  scanColumnForSections(colIndex) {
    let currentSection = null;
    
    for (let rowIndex = 0; rowIndex < this.textCells.length; rowIndex++) {
      const cell = this.textCells.find(tc => tc.r === rowIndex + 1 && tc.c === colIndex + 1);
      
      if (cell && this.isSectionHeaderCandidate(cell)) {
        if (currentSection) {
          // Close previous section
          currentSection.rEnd = rowIndex;
          this.sectionHeaders.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          label: cell.text,
          rStart: rowIndex + 1,
          rEnd: rowIndex + 1,
          score: this.scoreSectionHeader(cell),
          col: colIndex + 1,
          style: this.getStyleBits(cell)
        };
      } else if (currentSection && this.isSubsectionCandidate(cell)) {
        // Extend current section
        currentSection.rEnd = rowIndex + 1;
      }
    }
    
    // Close final section
    if (currentSection) {
      this.sectionHeaders.push(currentSection);
    }
  }

  /**
   * Check if a cell is a section header candidate
   */
  isSectionHeaderCandidate(cell) {
    if (!cell) return false;
    
    // Must be bold and left-aligned
    if (!cell.bold) return false;
    
    // Must not be a number or date
    if (!isNaN(Number(cell.text))) return false;
    if (this.isDateFormatted({ value: cell.text })) return false;
    
    // Must be in left columns
    if (cell.c > 3) return false;
    
    return true;
  }

  /**
   * Check if a cell is a subsection candidate (indented sublabels)
   */
  isSubsectionCandidate(cell) {
    if (!cell) return false;
    
    // Must be text
    if (!this.isTextCell({ value: cell.text })) return false;
    
    // Must be in left columns
    if (cell.c > 3) return false;
    
    return true;
  }

  /**
   * Score a section header based on styling and position
   */
  scoreSectionHeader(cell) {
    let score = 0.5; // Base score
    
    if (cell.bold) score += 0.2;
    if (cell.merged) score += 0.1;
    if (cell.c === 1) score += 0.1; // Column A
    if (cell.r <= 3) score += 0.1; // Top rows
    
    return Math.min(score, 1.0);
  }

  /**
   * Detect global date header
   */
  detectGlobalDateHeader() {
    this.globalDateHeader = null;
    
    // Look for date patterns in top rows
    for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
      const dateCells = [];
      
      for (let colIndex = 0; colIndex < 20; colIndex++) { // Check first 20 columns
        const cell = this.textIndexByRC.get(`${rowIndex + 1},${colIndex + 1}`);
        if (cell && this.isDateFormatted({ value: cell.text })) {
          dateCells.push(cell);
        }
      }
      
      if (dateCells.length >= 3) { // At least 3 date cells in a row
        this.globalDateHeader = {
          row: rowIndex + 1,
          cells: dateCells,
          range: this.getDateRange(dateCells),
          confidence: this.scoreDateHeader(dateCells)
        };
        break;
      }
    }
    
    if (this.globalDateHeader) {
      console.log(`Detected global date header at row ${this.globalDateHeader.row}`);
    }
  }

  /**
   * Get date range from date cells
   */
  getDateRange(dateCells) {
    if (dateCells.length === 0) return null;
    
    const cols = dateCells.map(cell => cell.c).sort((a, b) => a - b);
    const startCol = cols[0];
    const endCol = cols[cols.length - 1];
    const row = dateCells[0].r;
    
    return `${numToCol(startCol)}${row}:${numToCol(endCol)}${row}`;
  }

  /**
   * Score date header confidence
   */
  scoreDateHeader(dateCells) {
    let score = 0.5; // Base score
    
    // More cells = higher confidence
    score += Math.min(dateCells.length * 0.1, 0.3);
    
    // Check for bold styling
    const boldCount = dateCells.filter(cell => cell.bold).length;
    if (boldCount > 0) score += 0.2;
    
    // Check for merged cells
    const mergedCount = dateCells.filter(cell => cell.merged).length;
    if (mergedCount > 0) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Score a label based on distance, styling, and position
   */
  scoreLabel(hit) {
    let score = 1 / (1 + hit.gap); // Distance score
    
    if (hit.bold) score += 0.2;
    if (hit.merged) score += 0.1;
    if (hit.dir === 'up' && hit.r <= 3) score += 0.1; // Top header row
    if (hit.dir === 'left' && hit.c <= 3) score += 0.1; // Left label column
    
    return Math.min(score, 1.0);
  }

  /**
   * Find section header for a frame
   */
  findSectionForFrame(frame) {
    const frameStartRow = frame.horizontal[0]?.startRow || frame.vertical[0]?.startRow;
    const frameEndRow = frame.horizontal[0]?.endRow || frame.vertical[0]?.endRow;
    
    if (!frameStartRow || !frameEndRow) return null;
    
    // Find section whose range overlaps with frame
    for (const section of this.sectionHeaders) {
      if (section.rStart <= frameEndRow && section.rEnd >= frameStartRow) {
        return {
          text: section.label,
          confidence: section.score,
          source: 'section-header',
          at: `${numToCol(section.col)}${section.rStart}`,
          range: `${numToCol(section.col)}${section.rStart}:${numToCol(section.col)}${section.rEnd}`
        };
      }
    }
    
    return null;
  }

  /**
   * Find date header for a frame
   */
  findDateHeaderForFrame(frame) {
    if (!this.globalDateHeader) return null;
    
    const frameStartCol = frame.horizontal[0]?.startCol || frame.vertical[0]?.startCol;
    const frameEndCol = frame.horizontal[0]?.endCol || frame.vertical[0]?.endCol;
    
    if (!frameStartCol || !frameEndCol) return null;
    
    // Check if frame columns intersect with date header columns
    const dateCols = this.globalDateHeader.cells.map(cell => cell.c);
    const frameCols = [];
    for (let c = frameStartCol; c <= frameEndCol; c++) {
      frameCols.push(c);
    }
    
    const intersection = dateCols.filter(col => frameCols.includes(col));
    if (intersection.length > 0) {
      return {
        range: this.globalDateHeader.range,
        confidence: this.globalDateHeader.confidence,
        source: 'date-global',
        at: `Row ${this.globalDateHeader.row}`
      };
    }
    
    return null;
  }

  /**
   * Label a frame with all available information
   */
  labelFrame(frame, spreadsheetData = null, dateFrames = null) {
    const labels = {
      section: null,
      row: null,
      column: null,
      dateHeader: null
    };
    
    // Find section header
    labels.section = this.findSectionForFrame(frame);
    
    // Find date header
    labels.dateHeader = this.findDateHeaderForFrame(frame);
    
    // Find row and column labels for each span
    const rowLabels = [];
    const columnLabels = [];
    
    // Process horizontal spans
    for (const span of frame.horizontal) {
      for (let r = span.startRow; r <= span.endRow; r++) {
        const leftLabel = this.nearestLeftText(r, span.startCol, null, spreadsheetData);
        if (leftLabel) {
          rowLabels.push({
            ...leftLabel,
            score: this.scoreLabel(leftLabel)
          });
        }
      }
    }
    
    // Process vertical spans
    for (const span of frame.vertical) {
      for (let c = span.startCol; c <= span.endCol; c++) {
        const topLabel = this.nearestUpText(span.startRow, c, null, spreadsheetData, dateFrames);
        if (topLabel) {
          columnLabels.push({
            ...topLabel,
            score: this.scoreLabel(topLabel)
          });
        }
      }
    }
    
    // Choose best row label
    if (rowLabels.length > 0) {
      const bestRowLabel = rowLabels.reduce((best, current) => 
        current.score > best.score ? current : best
      );
      labels.row = {
        text: bestRowLabel.text,
        confidence: bestRowLabel.score,
        source: 'left-scan',
        at: `${numToCol(bestRowLabel.c)}${bestRowLabel.r}`
      };
    }
    
    // Choose best column label
    if (columnLabels.length > 0) {
      const bestColumnLabel = columnLabels.reduce((best, current) => 
        current.score > best.score ? current : best
      );
      labels.column = {
        text: bestColumnLabel.text,
        confidence: bestColumnLabel.score,
        source: 'top-scan',
        at: `${numToCol(bestColumnLabel.c)}${bestColumnLabel.r}`
      };
    }
    
    return labels;
  }
}

// Export for use in other modules
export { DependencyAnalyzer, TextLabelIndexer };


