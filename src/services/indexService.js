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

function buildDependencyGraphFromSpreadsheetData(spreadsheetData) {
  const dependents = new Map();
  const precedents = new Map();
  const allNodes = new Set();
  const formulaNodes = new Set();
  const referencedNodes = new Set(); // Track cells that are referenced by formulas

  // First pass: identify formula cells and their references
  for (let rowIndex = 0; rowIndex < spreadsheetData.length; rowIndex++) {
    const row = spreadsheetData[rowIndex];
    if (!row) continue;
    
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cell = row[colIndex];
      if (!cell) continue;
      
      const cellAddr = rcToA1(rowIndex + 1, colIndex + 1);
      const nodeK = keyOf({ sheet: "Sheet1", addr: cellAddr });

      // Check if this cell contains a formula
      const cellValue = String(cell?.value || '');
      if (cellValue.startsWith('=')) {
        formulaNodes.add(nodeK);
        allNodes.add(nodeK);
        
        // Extract cell references from the formula
        for (const refObj of iterCellRefs(cellValue)) {
          const startSheet = refObj.sheet || "Sheet1";
          if (refObj.end) {
            const endSheet = refObj.end.sheet || startSheet;
            if (endSheet !== startSheet) {
              // Fallback: treat only the start cell to be conservative
              const srcK = keyOf({ sheet: startSheet, addr: stripDollar(refObj.start) });
              referencedNodes.add(srcK);
              allNodes.add(srcK);
              addEdge(srcK, nodeK, dependents, precedents);
            } else {
              for (const a1 of expandRange(stripDollar(refObj.start), stripDollar(refObj.end.addr))) {
                const srcK = keyOf({ sheet: startSheet, addr: a1 });
                referencedNodes.add(srcK);
                allNodes.add(srcK);
                addEdge(srcK, nodeK, dependents, precedents);
              }
            }
          } else {
            const srcK = keyOf({ sheet: startSheet, addr: stripDollar(refObj.start) });
            referencedNodes.add(srcK);
            allNodes.add(srcK);
            addEdge(srcK, nodeK, dependents, precedents);
          }
        }
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

  return { dependents, precedents, allNodes: finalNodes, formulaNodes };
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
// Main DependencyAnalyzer class
// -----------------------------

class DependencyAnalyzer {
  constructor() {
    this.dependents = new Map();
    this.precedents = new Map();
    this.allNodes = new Set();
    this.formulaNodes = new Set();
  }

  analyzeSpreadsheetData(spreadsheetData) {
    const graph = buildDependencyGraphFromSpreadsheetData(spreadsheetData);
    const layers = forwardTopoLayers(graph);
    const frames = framesForLayers(layers);
    
    return {
      layers,
      frames,
      graph
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

// Export for use in other modules
export { DependencyAnalyzer };

