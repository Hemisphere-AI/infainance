import OpenAI from 'openai';
import { tools, SYSTEM_PROMPT } from '../utils/tools.js';
import { addrToRC, rcToAddr, sliceRange, getColumnIndex } from '../utils/a1Helpers.js';
import { tokenSortJaroWinkler } from '../utils/similarity.js';

// Initialize OpenAI client
const apiKey = import.meta.env.VITE_OPENAI_KEY;
if (!apiKey || apiKey === 'your_openai_api_key_here') {
  console.warn('OpenAI API key not set. Please set VITE_OPENAI_KEY in your .env file.');
}

const openai = new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: true // Note: In production, this should be handled by a backend
});

/**
 * LLM Service for spreadsheet interaction
 */
export class LLMService {
  constructor(spreadsheetData, onDataChange, onToolCall = null) {
    this.spreadsheetData = spreadsheetData;
    this.onDataChange = onDataChange;
    this.onToolCall = onToolCall; // Callback for tool call visibility
    this.conversationHistory = [];
  }

  /**
   * Update the spreadsheet data reference
   */
  updateSpreadsheetData(newData) {
    this.spreadsheetData = newData;
  }

  /**
   * Find a cell by hint and also check adjacent cells for values
   */
  findCell(hint, strategy = "header_row_first") {
    console.log(`Searching for: "${hint}" in spreadsheet data:`, this.spreadsheetData);
    
    // 1) exact address?
    if (/^[A-Z]+[0-9]+$/i.test(hint)) {
      return { address: hint.toUpperCase() };
    }

    const results = this.fuzzySearch(hint, strategy);
    console.log(`Found ${results.length} matches:`, results);

    // Return the best match (header row first, then first match)
    if (results.length > 0) {
      const headerMatch = results.find(r => r.location.includes('header'));
      return headerMatch || results[0];
    }

    return { address: null, message: `No cells found containing "${hint}"` };
  }

  /**
   * Enhanced fuzzy search that tries multiple variations of the search term
   */
  fuzzySearch(hint, strategy = "header_row_first") {
    const results = [];
    
    // Generate search variations
    const searchVariations = this.generateSearchVariations(hint);
    console.log(`Search variations for "${hint}":`, searchVariations);
    
    // 2) header row scan
    const headerRow = 0;
    if (strategy === "header_row_first" && this.spreadsheetData[headerRow]) {
      for (let c = 0; c < this.spreadsheetData[headerRow].length; c++) {
        const cell = this.spreadsheetData[headerRow][c];
        const cellValue = String(cell?.value ?? "").toLowerCase();
        
        for (const variation of searchVariations) {
          if (cellValue.includes(variation.toLowerCase())) {
            const result = {
              address: rcToAddr(1, c + 1),
              value: cell?.value,
              match: cellValue,
              searchTerm: variation,
              location: `header row, column ${c + 1}`,
              adjacentCells: this.getAdjacentCells(0, c)
            };
            results.push(result);
            break; // Found a match, no need to check other variations for this cell
          }
        }
      }
    }

    // 3) anywhere in the spreadsheet
    for (let r = 0; r < this.spreadsheetData.length; r++) {
      for (let c = 0; c < (this.spreadsheetData[r]?.length ?? 0); c++) {
        const cell = this.spreadsheetData[r][c];
        const cellValue = String(cell?.value ?? "").toLowerCase();
        
        for (const variation of searchVariations) {
          if (cellValue.includes(variation.toLowerCase())) {
            const result = {
              address: rcToAddr(r + 1, c + 1),
              value: cell?.value,
              match: cellValue,
              searchTerm: variation,
              location: `row ${r + 1}, column ${c + 1}`,
              adjacentCells: this.getAdjacentCells(r, c)
            };
            results.push(result);
            break; // Found a match, no need to check other variations for this cell
          }
        }
      }
    }

    return results;
  }

  /**
   * Generate multiple search variations for fuzzy matching
   */
  generateSearchVariations(hint) {
    const variations = [hint]; // Start with original
    const lowerHint = hint.toLowerCase();
    
    // Split into words and try different combinations
    const words = lowerHint.split(/\s+/);
    
    // Add individual words (only meaningful words)
    words.forEach(word => {
      if (word.length > 2 && !['the', 'and', 'for', 'of', 'in', 'at', 'to', 'is', 'are', 'was', 'were'].includes(word)) {
        variations.push(word);
      }
    });
    
    // Add singular/plural variations for each word
    words.forEach(word => {
      if (word.length > 2) {
        if (word.endsWith('s') && word.length > 3) {
          // Remove 's' for singular
          variations.push(word.slice(0, -1));
        } else {
          // Add 's' for plural
          variations.push(word + 's');
        }
      }
    });
    
    // Add trimmed variations (remove common prefixes/suffixes)
    const trimmed = lowerHint
      .replace(/^(number of|count of|total|sum of)\s+/i, '') // Remove prefixes
      .replace(/\s+(number|count|total|sum)$/i, '') // Remove suffixes
      .trim();
    
    if (trimmed && trimmed !== lowerHint) {
      variations.push(trimmed);
    }
    
    // Add variations with common synonyms (dynamic, not hard-coded)
    const synonymMap = {
      'number': ['count', 'total', 'sum', 'amount'],
      'count': ['number', 'total', 'sum', 'amount'],
      'total': ['number', 'count', 'sum', 'amount'],
      'client': ['customer', 'account'],
      'customer': ['client', 'account'],
      'agent': ['representative', 'rep', 'staff'],
      'representative': ['agent', 'rep', 'staff'],
      'staff': ['agent', 'representative', 'rep']
    };
    
    // Generate synonym variations
    words.forEach(word => {
      if (synonymMap[word]) {
        synonymMap[word].forEach(synonym => {
          const synonymVariation = lowerHint.replace(word, synonym);
          variations.push(synonymVariation);
        });
      }
    });
    
    // Remove duplicates and return
    return [...new Set(variations)];
  }

  /**
   * Get adjacent cells (right, below, left, above) for a given position
   */
  getAdjacentCells(row, col) {
    const adjacent = {};
    
    // Right cell (next column)
    if (this.spreadsheetData[row] && this.spreadsheetData[row][col + 1]) {
      adjacent.right = {
        address: rcToAddr(row + 1, col + 2),
        value: this.spreadsheetData[row][col + 1]?.value,
        isFormula: String(this.spreadsheetData[row][col + 1]?.value || '').startsWith('=')
      };
    }
    
    // Below cell (next row)
    if (this.spreadsheetData[row + 1] && this.spreadsheetData[row + 1][col]) {
      adjacent.below = {
        address: rcToAddr(row + 2, col + 1),
        value: this.spreadsheetData[row + 1][col]?.value,
        isFormula: String(this.spreadsheetData[row + 1][col]?.value || '').startsWith('=')
      };
    }
    
    // Left cell (previous column)
    if (col > 0 && this.spreadsheetData[row] && this.spreadsheetData[row][col - 1]) {
      adjacent.left = {
        address: rcToAddr(row + 1, col),
        value: this.spreadsheetData[row][col - 1]?.value,
        isFormula: String(this.spreadsheetData[row][col - 1]?.value || '').startsWith('=')
      };
    }
    
    // Above cell (previous row)
    if (row > 0 && this.spreadsheetData[row - 1] && this.spreadsheetData[row - 1][col]) {
      adjacent.above = {
        address: rcToAddr(row, col + 1),
        value: this.spreadsheetData[row - 1][col]?.value,
        isFormula: String(this.spreadsheetData[row - 1][col]?.value || '').startsWith('=')
      };
    }
    
    return adjacent;
  }

  /**
   * Find a label and return both the label cell and its associated value from adjacent cells
   */
  findLabelValue(label) {
    console.log(`Searching for label-value pair: "${label}"`);
    
    const searchLabel = label.toLowerCase();
    const results = [];

    // Search through the spreadsheet
    for (let r = 0; r < this.spreadsheetData.length; r++) {
      for (let c = 0; c < (this.spreadsheetData[r]?.length ?? 0); c++) {
        const cell = this.spreadsheetData[r][c];
        const cellValue = String(cell?.value ?? "").toLowerCase();
        
        if (cellValue.includes(searchLabel)) {
          const adjacentCells = this.getAdjacentCells(r, c);
          
          // Look for a value in adjacent cells
          let foundValue = null;
          let valueLocation = null;
          
          // Check right cell first (most common pattern)
          if (adjacentCells.right && adjacentCells.right.value !== undefined && adjacentCells.right.value !== '') {
            foundValue = adjacentCells.right;
            valueLocation = 'right';
          }
          // Check below cell
          else if (adjacentCells.below && adjacentCells.below.value !== undefined && adjacentCells.below.value !== '') {
            foundValue = adjacentCells.below;
            valueLocation = 'below';
          }
          // Check left cell
          else if (adjacentCells.left && adjacentCells.left.value !== undefined && adjacentCells.left.value !== '') {
            foundValue = adjacentCells.left;
            valueLocation = 'left';
          }
          // Check above cell
          else if (adjacentCells.above && adjacentCells.above.value !== undefined && adjacentCells.above.value !== '') {
            foundValue = adjacentCells.above;
            valueLocation = 'above';
          }
          
          const result = {
            label: {
              address: rcToAddr(r + 1, c + 1),
              value: cell?.value,
              location: `row ${r + 1}, column ${c + 1}`
            },
            value: foundValue,
            valueLocation: valueLocation,
            allAdjacentCells: adjacentCells
          };
          
          results.push(result);
        }
      }
    }

    console.log(`Found ${results.length} label-value pairs:`, results);

    // Return the best match
    if (results.length > 0) {
      // Prefer results that have a value
      const withValue = results.filter(r => r.value !== null);
      if (withValue.length > 0) {
        return withValue[0];
      }
      return results[0];
    }

    return { 
      label: null, 
      value: null, 
      message: `No label-value pair found for "${label}"` 
    };
  }

  /**
   * Find the intersection of two labels with enhanced axis disambiguation and value type validation
   */
  findIntersection(label1, label2, options = {}) {
    console.log(`Searching for intersection of "${label1}" and "${label2}" with options:`, options);
    
    const {
      label1_role = "auto",
      label2_role = "auto", 
      prefer_header_row = true,
      prefer_first_column = true,
      value_type = "any"
    } = options;
    
    // Find candidates for each label with scoring
    const label1Candidates = this.rankLabelMatches(label1, label1_role, prefer_header_row, prefer_first_column);
    const label2Candidates = this.rankLabelMatches(label2, label2_role, prefer_header_row, prefer_first_column);
    
    console.log(`Label1 "${label1}" candidates:`, label1Candidates);
    console.log(`Label2 "${label2}" candidates:`, label2Candidates);
    
    const tried = [];
    
    // Try intersections from top candidates
    for (const L1 of label1Candidates.slice(0, 5)) {
      for (const L2 of label2Candidates.slice(0, 5)) {
        // Try cross-intersection assuming L1 as column header, L2 as row label
        const intersectionAddr = rcToAddr(L2.r, L1.c);
        const cell = this.readCell(intersectionAddr);
        const isValid = this.validateValueType(cell.value, value_type);
        
        const candidate = {
          row: rcToAddr(L2.r, 1),
          col: rcToAddr(1, L1.c),
          addr: intersectionAddr,
          value: cell.value,
          ok: isValid,
          reason: isValid ? "valid" : `not ${value_type}`
        };
        
        tried.push(candidate);
        
        if (isValid) {
          console.log(`Found valid intersection: ${intersectionAddr} = ${cell.value}`);
          return {
            address: intersectionAddr,
            value: cell.value,
            valueType: this.getValueType(cell.value),
            label1: { text: label1, address: rcToAddr(1, L1.c) },
            label2: { text: label2, address: rcToAddr(L2.r, 1) },
            rowHeader: { address: rcToAddr(L2.r, 1), value: this.spreadsheetData[L2.r-1]?.[0]?.value },
            columnHeader: { address: rcToAddr(1, L1.c), value: this.spreadsheetData[0]?.[L1.c-1]?.value },
            neighbors: this.getNeighbors(L2.r-1, L1.c-1),
            candidatesTried: tried
          };
        }
      }
    }
    
    return { 
      address: null, 
      reason: "No valid intersection found", 
      candidatesTried: tried,
      label1Candidates,
      label2Candidates
    };
  }

  /**
   * Rank label matches with scoring based on role and preferences
   */
  rankLabelMatches(label, role, preferHeaderRow, preferFirstColumn) {
      const searchLabel = label.toLowerCase();
    const matches = [];
      
      for (let r = 0; r < this.spreadsheetData.length; r++) {
      for (let c = 0; c < (this.spreadsheetData[r]?.length || 0); c++) {
          const cell = this.spreadsheetData[r][c];
          const cellValue = String(cell?.value ?? "").toLowerCase();
          
          if (cellValue.includes(searchLabel)) {
          let score = 0;
          
          // Header row bonus for column role
          if (role !== "row" && r === 0 && preferHeaderRow) {
            score += 3;
          }
          
          // First column bonus for row role  
          if (role !== "column" && c === 0 && preferFirstColumn) {
            score += 3;
          }
          
          // Corner penalty (A1 is usually not a data label)
          if (r === 0 && c === 0) {
            score -= 1;
          }
          
          // Exact match bonus
          if (cellValue === searchLabel) {
            score += 2;
          }
          
          matches.push({
            addr: rcToAddr(r + 1, c + 1),
            r: r + 1,
            c: c + 1,
            score,
            value: cell?.value
                      });
                    }
                  }
                }
    
    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }

  /**
   * Validate if a value matches the expected type
   */
  validateValueType(value, expectedType) {
    if (expectedType === "any") return true;
    
    switch (expectedType) {
      case "number":
        return this.isNumericCell(value);
      case "text":
        return typeof value === "string";
      case "date":
        return this.isDateCell(value);
      default:
        return true;
    }
  }

  /**
   * Check if a cell value is numeric
   */
  isNumericCell(value) {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') {
      const cleaned = value.replace(/[,$\s]/g, '');
      const parsed = parseFloat(cleaned);
      return !isNaN(parsed) && Number.isFinite(parsed);
    }
    return false;
  }

  /**
   * Check if a cell value is a date
   */
  isDateCell(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    return false;
  }

  /**
   * Get the type of a cell value
   */
  getValueType(value) {
    if (this.isNumericCell(value)) return "number";
    if (this.isDateCell(value)) return "date";
    if (typeof value === "string") return "text";
    return "unknown";
  }

  /**
   * Get neighboring cells for context
   */
  getNeighbors(row, col) {
    const neighbors = {};
    
    // Left
    if (col > 0) {
      neighbors.left = rcToAddr(row + 1, col);
    }
    
    // Right
    if (this.spreadsheetData[row] && this.spreadsheetData[row][col + 1]) {
      neighbors.right = rcToAddr(row + 1, col + 2);
    }
    
    // Above
    if (row > 0) {
      neighbors.above = rcToAddr(row, col + 1);
    }
    
    // Below
    if (this.spreadsheetData[row + 1] && this.spreadsheetData[row + 1][col]) {
      neighbors.below = rcToAddr(row + 2, col + 1);
    }
    
    return neighbors;
  }

  /**
   * Find labels and create a sub-frame of their intersection area
   * Follows systematic workflow: find variables -> find entities -> create subframe -> expand -> conclude
   */
  findSubFrame(label1, label2) {
    // label1 = metric (e.g., "agents"), label2 = entity axis (e.g., "client")
    const trace = [];
    trace.push({ step: "find_subframe()", label1, label2 });

    // Step 1: Find variables - fuzzy search both labels anywhere
    const metricHits = this.findLabelPositions(label1);
    const entityHits = this.findLabelPositions(label2);
    
    if (metricHits.length) {
      trace.push({ 
        step: "find_value", 
        message: `Metric "${label1}" found in ${metricHits.length} location(s)`, 
        hits: metricHits.slice(0, 3).map(h => ({ 
          address: h.address, 
          value: h.value, 
          similarity: h.similarity,
          coordinates: `row ${h.row + 1}, col ${h.col + 1}`
        }))
      });
    }
    
    if (entityHits.length) {
      trace.push({ 
        step: "find_value", 
        message: `Entity "${label2}" found in ${entityHits.length} location(s)`, 
        hits: entityHits.slice(0, 5).map(h => ({ 
          address: h.address, 
          value: h.value, 
          similarity: h.similarity,
          coordinates: `row ${h.row + 1}, col ${h.col + 1}`
        }))
      });
    }

    // Step 2: Analyze findings - use metric coordinates as seed, find closest entity
    const seedMetric = metricHits.find(h => h.row === 0) || metricHits[0];
    const seedEntity = entityHits.find(h => h.col === 0) || entityHits[0];

    if (!seedMetric && !seedEntity) {
      return { error: `Could not find either "${label1}" or "${label2}" labels in the spreadsheet`, trace };
    }

    // Use metric coordinates as primary seed, fallback to entity coordinates
    let seedRow, seedCol;
    if (seedMetric) {
      seedRow = seedMetric.row;
      seedCol = seedMetric.col;
      trace.push({ 
        step: "analyze_findings", 
        message: `Using metric "${label1}" coordinates as seed: row ${seedRow + 1}, col ${seedCol + 1}` 
      });
    } else {
      // Fallback: use entity coordinates
      seedRow = seedEntity.row;
      seedCol = seedEntity.col;
      trace.push({ 
        step: "analyze_findings", 
        message: `Using entity "${label2}" coordinates as seed: row ${seedRow + 1}, col ${seedCol + 1}` 
      });
    }

    // If no metric found, try header detection
    if (!seedMetric) {
      const hc = this.detectHeaderColumn(label1);
      if (hc !== -1) { 
        seedCol = hc; 
        trace.push({ 
          step: "fallback", 
          message: `Header column detected for "${label1}" at ${rcToAddr(1, hc + 1)}` 
        }); 
      }
    }

    // If no entity found, try row label detection
    if (!seedEntity) {
      const ec = this.detectRowLabelColumn(label2);
      if (ec !== -1) { 
        seedRow = Math.max(1, seedRow); 
        trace.push({ 
          step: "fallback", 
          message: `Row label column detected for "${label2}" at ${rcToAddr(1, ec + 1)}` 
        }); 
      }
    }

    // Step 3: Create subframe - establish subframe by expansion from seed
    trace.push({ 
      step: "create_subframe", 
      message: `Creating subframe from seed coordinates: row ${seedRow + 1}, col ${seedCol + 1}` 
    });
    
    const frame = this._establishSubframeFromSeed(seedRow, seedCol, { maxRows: 100 });
    if (!frame) {
      return { error: `No valid sub-frame found for labels "${label1}" and "${label2}"`, trace };
    }
    
    trace.push({ 
      step: "establish_sub_frame", 
      range: frame.a1Range,
      message: `Subframe established: ${frame.a1Range} (${frame.bottomRight.r - frame.topLeft.r + 1} rows, ${frame.bottomRight.c - frame.topLeft.c + 1} columns)`
    });

    // Step 4: Extract comparison and pick winner
    const cmp = this._extractComparisonFromSubframe(frame, label1, label2);
    if (cmp.error) return { error: cmp.error, trace };

    // Step 5: Final results
    trace.push({ 
      step: "getting", 
      message: `Getting data from ${frame.a1Range}` 
    });
    trace.push({ 
      step: "subframe_found", 
      subframe: frame.a1Range,
      message: `Subframe analysis complete: ${frame.a1Range}`
    });
    trace.push({ 
      step: "winner", 
      message: `Winner found: ${cmp.winnerEntity} has most ${label1} (${cmp.winnerValue})`, 
      winnerAddr: cmp.winnerAddr 
    });

    return {
      pattern: "expanded_subframe",
      range: frame.a1Range,
      metricHeader: cmp.metricHeader,
      entityHeader: cmp.entityHeader,
      resultEntity: cmp.winnerEntity,
      resultValue: cmp.winnerValue,
      resultAddr: cmp.winnerAddr,
      trace
    };
  }

  generateSubFramePatterns(pos1, pos2) {
    const patterns = [];
    
    // Pattern 1: pos1 as column header, pos2 as row header (relaxed)
    if (pos2.col === 0) {
      patterns.push({
        type: 'column_row_headers',
        columnHeader: pos1,
        rowHeader: pos2,
        dataStartRow: Math.min(pos1.row, pos2.row) + 1,
        dataStartCol: pos1.col + 1
      });
    }
    
    // Pattern 2: pos2 as column header, pos1 as row header (relaxed)
    if (pos1.col === 0) {
      patterns.push({
        type: 'column_row_headers',
        columnHeader: pos2,
        rowHeader: pos1,
        dataStartRow: Math.min(pos1.row, pos2.row) + 1,
        dataStartCol: pos2.col + 1
      });
    }
    
    // Pattern 3: dual column headers (shared header row)
    if (pos1.row === pos2.row && pos1.row === 0) {
      patterns.push({
        type: 'dual_column_headers',
        header1: pos1,
        header2: pos2,
        headerRow: pos1.row,
        dataStartRow: pos1.row + 1
      });
    }
    
    // Pattern 4: dual row headers (shared header column)
    if (pos1.col === pos2.col && pos1.col === 0) {
      patterns.push({
        type: 'dual_row_headers',
        header1: pos1,
        header2: pos2,
        headerCol: pos1.col,
        dataStartCol: pos1.col + 1
      });
    }
    
    return patterns;
  }

  createSubFrame(pattern, contextRange, valueType) {
    try {
      let subFrameData = [];
      let context = {};
      
      switch (pattern.type) {
        case 'column_row_headers':
          subFrameData = this.extractColumnRowSubFrame(pattern, valueType);
          context = this.extractContext(pattern.dataStartRow - contextRange, pattern.dataStartCol - contextRange, contextRange);
          break;
          
        case 'dual_column_headers':
          subFrameData = this.extractDualColumnSubFrame(pattern, valueType);
          context = this.extractContext(pattern.dataStartRow - contextRange, 0, contextRange);
          break;
          
        case 'dual_row_headers':
          subFrameData = this.extractDualRowSubFrame(pattern, valueType);
          context = this.extractContext(0, pattern.dataStartCol - contextRange, contextRange);
          break;
          
        default:
          return null;
      }
      
      if (subFrameData.length === 0) {
        return null;
      }
      
      return {
        pattern: pattern,
        subFrameData: subFrameData,
        context: context,
        totalEntries: subFrameData.length,
        maxValue: Math.max(...subFrameData.map(d => d.value)),
        minValue: Math.min(...subFrameData.map(d => d.value))
      };
      
    } catch (error) {
      console.error('Error creating sub-frame:', error);
      return null;
    }
  }

  extractColumnRowSubFrame(pattern, valueType) {
    const data = [];
    const { dataStartRow, dataStartCol } = pattern;
    
    // Determine robust startRow
    let startRow = 1;
    for (let r = 1; r < this.spreadsheetData.length; r++) {
      const rowLabelCellProbe = this.spreadsheetData[r]?.[pattern.rowHeader.col];
      const valueCellProbe = this.spreadsheetData[r]?.[dataStartCol - 1];
      if ((rowLabelCellProbe && String(rowLabelCellProbe.value ?? '').trim() !== '') || (valueCellProbe && String(valueCellProbe.value ?? '').trim() !== '')) {
        startRow = r; break;
      }
    }
    
    for (let row = Math.max(startRow, dataStartRow); row < this.spreadsheetData.length; row++) {
      const cell = this.spreadsheetData[row]?.[dataStartCol - 1];
      const rowLabelCell = this.spreadsheetData[row]?.[pattern.rowHeader.col];
      if (cell && rowLabelCell) {
        const cellValue = cell.value;
        const rowLabel = rowLabelCell.value;
        if (this.validateValueType(cellValue, valueType) && rowLabel) {
          const numericValue = this.parseNumericValue(cellValue);
          if (numericValue !== undefined) {
            data.push({
              row: row + 1,
              column: dataStartCol,
              address: rcToAddr(row + 1, dataStartCol),
              value: numericValue,
              rowLabel: rowLabel,
              rowLabelAddress: rcToAddr(row + 1, pattern.rowHeader.col + 1)
            });
          }
        }
      }
    }
    return data;
  }

  extractDualColumnSubFrame(pattern, valueType) {
    const data = [];
    const { dataStartRow, header1, header2 } = pattern;
    
    // Scan down both columns
    for (let row = dataStartRow; row < this.spreadsheetData.length; row++) {
      const cell1 = this.spreadsheetData[row]?.[header1.col];
      const cell2 = this.spreadsheetData[row]?.[header2.col];
      
      if (cell1 && cell2) {
        const value1 = this.parseNumericValue(cell1.value);
        const value2 = this.parseNumericValue(cell2.value);
        
        if (value1 !== undefined && this.validateValueType(cell1.value, valueType)) {
          data.push({
            row: row + 1,
            column: header1.col + 1,
            address: rcToAddr(row + 1, header1.col + 1),
            value: value1,
            label: header1.value,
            labelAddress: rcToAddr(1, header1.col + 1)
          });
        }
        
        if (value2 !== undefined && this.validateValueType(cell2.value, valueType)) {
          data.push({
            row: row + 1,
            column: header2.col + 1,
            address: rcToAddr(row + 1, header2.col + 1),
            value: value2,
            label: header2.value,
            labelAddress: rcToAddr(1, header2.col + 1)
          });
        }
      }
    }
    
    return data;
  }

  extractDualRowSubFrame(pattern, valueType) {
    const data = [];
    const { dataStartCol, header1, header2 } = pattern;
    
    // Scan across both rows
    for (let col = dataStartCol; col < (this.spreadsheetData[0]?.length || 0); col++) {
      const cell1 = this.spreadsheetData[header1.row]?.[col];
      const cell2 = this.spreadsheetData[header2.row]?.[col];
      
      if (cell1 && cell2) {
        const value1 = this.parseNumericValue(cell1.value);
        const value2 = this.parseNumericValue(cell2.value);
        
        if (value1 !== undefined && this.validateValueType(cell1.value, valueType)) {
          data.push({
            row: header1.row + 1,
            column: col + 1,
            address: rcToAddr(header1.row + 1, col + 1),
            value: value1,
            label: header1.value,
            labelAddress: rcToAddr(header1.row + 1, 1)
          });
        }
        
        if (value2 !== undefined && this.validateValueType(cell2.value, valueType)) {
          data.push({
            row: header2.row + 1,
            column: col + 1,
            address: rcToAddr(header2.row + 1, col + 1),
            value: value2,
            label: header2.value,
            labelAddress: rcToAddr(header2.row + 1, 1)
          });
        }
      }
    }
    
    return data;
  }

  extractContext(startRow, startCol, range) {
    const context = {
      topLeft: null,
      top: null,
      left: null,
      title: null
    };
    
    if (startRow >= 0 && startCol >= 0) {
      const titleCell = this.spreadsheetData[startRow]?.[startCol];
      if (titleCell && titleCell.value) {
        context.title = {
          value: titleCell.value,
          address: rcToAddr(startRow + 1, startCol + 1)
        };
      }
    }
    
    for (let r = Math.max(0, startRow); r < Math.min(this.spreadsheetData.length, startRow + range); r++) {
      for (let c = Math.max(0, startCol); c < Math.min((this.spreadsheetData[r]?.length || 0), startCol + range); c++) {
        const cell = this.spreadsheetData[r]?.[c];
        if (cell && cell.value) {
          const address = rcToAddr(r + 1, c + 1);
          if (r === startRow && c === startCol) {
            context.topLeft = { value: cell.value, address };
          } else if (r === startRow) {
            context.top = { value: cell.value, address };
          } else if (c === startCol) {
            context.left = { value: cell.value, address };
          }
        }
      }
    }
    return context;
  }

  analyzeMultipleSubFrames(subFrames, label1, label2) {
    console.log(`Analyzing ${subFrames.length} sub-frames for labels "${label1}" and "${label2}"`);
    
    // Check if all sub-frames have the same values
    const allValues = subFrames.flatMap(sf => sf.subFrameData.map(d => d.value));
    const uniqueValues = [...new Set(allValues)];
    
    if (uniqueValues.length === 1) {
      // All values are the same, return the first sub-frame
      return {
        ...subFrames[0],
        multipleSubFrames: true,
        allValuesSame: true,
        value: uniqueValues[0],
        message: `Multiple sub-frames found, but all have the same value: ${uniqueValues[0]}`
      };
    }
    
    // Values are different, need to analyze context
    const analysis = subFrames.map((sf, index) => ({
      index,
      pattern: sf.pattern.type,
      context: sf.context,
      maxValue: sf.maxValue,
      minValue: sf.minValue,
      totalEntries: sf.totalEntries,
      subFrameData: sf.subFrameData
    }));
    
    return {
      multipleSubFrames: true,
      allValuesSame: false,
      subFrames: analysis,
      message: `Multiple sub-frames found with different values. Examine context to determine which sub-frame to use.`,
      recommendation: "Use the sub-frame with the most relevant context based on the question asked."
    };
  }

  /**
   * Get all data from a specific row
   */
  getRowData(rowAddress) {
    let rowIndex;
    
    // Parse row address (could be "A5" or just "5")
    if (/^[A-Z]+[0-9]+$/i.test(rowAddress)) {
      const { r } = addrToRC(rowAddress);
      rowIndex = r - 1;
    } else if (/^[0-9]+$/.test(rowAddress)) {
      rowIndex = parseInt(rowAddress) - 1;
    } else {
      return { error: `Invalid row address: ${rowAddress}` };
    }
    
    if (rowIndex < 0 || rowIndex >= this.spreadsheetData.length) {
      return { error: `Row ${rowIndex + 1} is out of range` };
    }
    
    const row = this.spreadsheetData[rowIndex];
    const rowData = row.map((cell, colIndex) => ({
      address: rcToAddr(rowIndex + 1, colIndex + 1),
      value: cell?.value,
      isFormula: String(cell?.value || '').startsWith('=')
    }));
    
    return {
      row: rowIndex + 1,
      data: rowData,
      length: rowData.length
    };
  }

  /**
   * Get all data from a specific column
   */
  getColumnData(columnAddress) {
    let colIndex;
    
    // Handle column-only addresses (like "F") or full addresses (like "F1")
    if (/^[A-Z]+$/i.test(columnAddress)) {
      // Column only (e.g., "F")
      colIndex = getColumnIndex(columnAddress);
    } else if (/^[A-Z]+[0-9]+$/i.test(columnAddress)) {
      // Full address (e.g., "F1")
      const { c } = addrToRC(columnAddress);
      colIndex = c - 1;
    } else {
      return { error: `Invalid column address: ${columnAddress}` };
    }
    
    const columnData = [];
    for (let rowIndex = 0; rowIndex < this.spreadsheetData.length; rowIndex++) {
      const cell = this.spreadsheetData[rowIndex]?.[colIndex];
      if (cell !== undefined) {
        columnData.push({
          address: rcToAddr(rowIndex + 1, colIndex + 1),
          value: cell?.value,
          isFormula: String(cell?.value || '').startsWith('=')
        });
      }
    }
    
    return {
      column: rcToAddr(1, colIndex + 1).replace(/[0-9]/g, ''), // Get column letter
      data: columnData,
      length: columnData.length
    };
  }


  /**
   * Find all positions of a label with fuzzy matching (80% similarity)
   */
  findLabelPositions(label) {
    const searchLabel = label.toLowerCase().trim();
    const positions = [];
    
    for (let r = 0; r < this.spreadsheetData.length; r++) {
      for (let c = 0; c < (this.spreadsheetData[r]?.length ?? 0); c++) {
        const cell = this.spreadsheetData[r][c];
        const cellValue = String(cell?.value ?? "").toLowerCase().trim();
        
        if (cellValue && this.calculateSimilarity(cellValue, searchLabel) >= 0.8) {
          positions.push({ 
            row: r, 
            col: c, 
            address: rcToAddr(r + 1, c + 1), 
            value: cell?.value,
            similarity: this.calculateSimilarity(cellValue, searchLabel)
          });
        }
      }
    }
    
    // Sort by similarity score (highest first)
    positions.sort((a, b) => b.similarity - a.similarity);
    return positions;
  }

  /**
   * Calculate similarity between two strings (0-1 scale)
   */
  calculateSimilarity(str1, str2) {
    return tokenSortJaroWinkler(str1, str2); // ∈ [0,1]
  }

  /**
   * Parse a cell value to extract numeric value
   */
  parseNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    
    // If it's already a number
    if (typeof value === 'number') {
      return value;
    }
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      // Remove common formatting
      const cleaned = value.replace(/[,$\s]/g, '');
      const parsed = parseFloat(cleaned);
      
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    
    return undefined;
  }

  /**
   * Conclude the analysis with a final answer
   */
  conclude(answer, confidence, sources = []) {
    console.log(`Concluding analysis with answer: ${answer}, confidence: ${confidence}`);
    
    return {
      answer: answer,
      confidence: confidence,
      sources: sources,
      timestamp: new Date().toISOString(),
      status: "concluded"
    };
  }

  /**
   * Handle simple responses that don't require spreadsheet analysis
   */
  smallTalk(response) {
    console.log(`Small talk response: ${response}`);
    
    return {
      response: response,
      timestamp: new Date().toISOString(),
      status: "simple_response"
    };
  }


  /**
   * Read a cell by address
   */
  readCell(address) {
    const { r, c } = addrToRC(address);
    const cell = this.spreadsheetData[r-1]?.[c-1] ?? { value: "" };
    const isFormula = typeof cell.value === "string" && String(cell.value).startsWith("=");
    return { 
      address, 
      value: cell.value ?? "", 
      isFormula,
      isDate: cell.isDate || false,
      decimalPlaces: cell.decimalPlaces,
      // Enhanced formatting information
      cellType: cell.cellType || 'text',
      numberFormat: cell.numberFormat || null,
      originalFormat: cell.originalFormat || null
    };
  }

  /**
   * Update a cell value
   */
  updateCell(address, newValue) {
    const { r, c } = addrToRC(address);
    
    // Ensure the row exists
    if (!this.spreadsheetData[r-1]) {
      this.spreadsheetData[r-1] = [];
    }
    
    // Ensure the cell exists
    if (!this.spreadsheetData[r-1][c-1]) {
      this.spreadsheetData[r-1][c-1] = { value: "", className: "" };
    }
    
    // Update the value
    this.spreadsheetData[r-1][c-1].value = newValue;
    
    // Trigger data change callback
    if (this.onDataChange) {
      this.onDataChange([...this.spreadsheetData]);
    }
    
    return { address, newValue };
  }

  /**
   * Trigger recalculation (placeholder for now)
   */
  recalc() {
    // In a real implementation, this would trigger formula evaluation
    // For now, we'll just return a summary
    return { 
      changed: 0, 
      message: "Recalculation triggered (formulas will be evaluated on next render)" 
    };
  }

  /**
   * Read a range of cells
   */
  readSheet(range) {
    if (!range) {
      return { 
        size: { 
          rows: this.spreadsheetData.length, 
          cols: this.spreadsheetData[0]?.length ?? 0 
        } 
      };
    }
    
    try {
      const window = sliceRange(this.spreadsheetData, range);
      return { range, window };
    } catch (error) {
      return { error: `Invalid range: ${range}` };
    }
  }

  /**
   * Debug tool to inspect spreadsheet data
   */
  debugSheet(searchTerm = null) {
    const debugInfo = {
      totalRows: this.spreadsheetData.length,
      totalCols: this.spreadsheetData[0]?.length || 0,
      sampleData: this.spreadsheetData.slice(0, 5).map((row, rowIndex) => 
        row.map((cell, colIndex) => ({
          address: rcToAddr(rowIndex + 1, colIndex + 1),
          value: cell?.value,
          type: typeof cell?.value,
          isFormula: String(cell?.value || '').startsWith('=')
        }))
      )
    };

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matches = [];
      
      for (let r = 0; r < this.spreadsheetData.length; r++) {
        for (let c = 0; c < (this.spreadsheetData[r]?.length || 0); c++) {
          const cell = this.spreadsheetData[r][c];
          const cellValue = String(cell?.value || '').toLowerCase();
          if (cellValue.includes(searchLower)) {
            matches.push({
              address: rcToAddr(r + 1, c + 1),
              value: cell?.value,
              row: r + 1,
              col: c + 1
            });
          }
        }
      }
      
      debugInfo.searchTerm = searchTerm;
      debugInfo.matches = matches;
    }

    return debugInfo;
  }

  /**
   * Execute a tool call
   */
  async execTool(name, args) {
    try {
      switch (name) {
        case "find":
          return this.findCell(args.hint, args.search_strategy);
        case "find_label_value":
          return this.findLabelValue(args.label);
        case "find_subframe":
          return this.findSubFrame(args.label1, args.label2);
        case "conclude":
          return this.conclude(args.answer, args.confidence, args.sources);
        case "small_talk":
          return this.smallTalk(args.response);
        case "read_cell":
          return this.readCell(args.address);
        case "update_cell":
          return this.updateCell(args.address, args.newValue);
        case "recalc":
          return this.recalc();
        case "read_sheet":
          return this.readSheet(args.range);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      return { error: `Tool execution error: ${error.message}` };
    }
  }

  /**
   * Add a message to conversation history
   */
  addToHistory(role, content) {
    this.conversationHistory.push({
      role: role,
      content: content,
      timestamp: new Date()
    });
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Main chat function that handles the conversation with OpenAI
   */
  async chat(userText) {
    try {
      // Check if API key is properly configured
      if (!import.meta.env.VITE_OPENAI_KEY || import.meta.env.VITE_OPENAI_KEY === 'your_openai_api_key_here') {
        throw new Error('OpenAI API key not configured.');
      }

      // Add user message to history
      this.addToHistory("user", userText);

      // Build conversation messages with full history
      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        ...this.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];

      // 1) Ask model with tools
      let response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice: "auto", // Let model choose appropriate tools
        temperature: 0.1 // Lower temperature for more consistent behavior
      });

      // 2) Handle tool calls in a loop
      let finalResponse = response;
      let iterationCount = 0;
      const maxIterations = 5; // Prevent infinite loops
      let toolOutputs = []; // Track tool outputs for protocol validation

      while (response.choices[0]?.message?.tool_calls?.length > 0 && iterationCount < maxIterations) {
        iterationCount++;
        const toolCalls = response.choices[0].message.tool_calls;
        
        console.log(`Tool call iteration ${iterationCount}:`, toolCalls.map(call => ({
          id: call.id,
          function: call.function.name,
          arguments: call.function.arguments
        })));
        
        // Add the assistant's message with tool calls to the conversation
        messages.push(response.choices[0].message);
        
        // Execute all tool calls
        for (const call of toolCalls) {
          const toolArgs = JSON.parse(call.function.arguments);
          
          // Protocol guard: Check if conclude is being called without data read
          if (call.function.name === 'conclude') {
            const usedDataRead = () => toolOutputs.some(t => 
              ["read_cell", "read_sheet", "find_subframe", "find_label_value"].includes(t.tool_name)
            );
            
            if (!usedDataRead()) {
              console.log('Protocol guard: Blocking conclude without data read');
              const errorResult = {
                error: "ProtocolError: You must read spreadsheet data before concluding. Call read_cell (the intersection address) or read_sheet first."
              };
              
              // Add error result to conversation
              messages.push({
                role: "tool",
                tool_call_id: call.id,
                content: JSON.stringify(errorResult)
              });
              
              // Show error in chat if callback is provided
              if (this.onToolCall) {
                this.onToolCall({
                  type: 'tool_result',
                  tool: call.function.name,
                  result: errorResult,
                  iteration: iterationCount
                });
              }
              
              continue; // Skip this tool call
            }
          }
          
          // Show tool call in chat if callback is provided
          if (this.onToolCall) {
            this.onToolCall({
              type: 'tool_call',
              tool: call.function.name,
              arguments: toolArgs,
              iteration: iterationCount
            });
          }
          
          const result = await this.execTool(call.function.name, toolArgs);
          
          console.log(`Tool result for ${call.function.name}:`, result);
          
          // Track tool output for protocol validation
          toolOutputs.push({
            tool_name: call.function.name,
            result: result
          });
          
          // Show tool result in chat if callback is provided
          if (this.onToolCall) {
            this.onToolCall({
              type: 'tool_result',
              tool: call.function.name,
              result: result,
              iteration: iterationCount
            });
          }
          
          // Add tool result to conversation
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });

          // Note: Removed extra tool messages that were causing API errors
          // The tool results already contain all necessary information

          // If conclude tool was called, return the answer immediately
          if (call.function.name === 'conclude') {
            console.log('Conclude tool called, returning answer:', result.answer);
            this.addToHistory("assistant", result.answer);
            return result.answer;
          }

          // If small_talk tool was called, return the simple response immediately
          if (call.function.name === 'small_talk') {
            console.log('Small talk tool called, returning response:', result.response);
            this.addToHistory("assistant", result.response);
            return result.response;
          }
        }

        // Get next response from the model
        response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          tools: tools,
          tool_choice: "auto",
          temperature: 0.1 // Lower temperature for more consistent behavior
        });

        finalResponse = response;
      }

      // 3) Add assistant response to history and return
      const assistantResponse = finalResponse.choices[0]?.message?.content || "No response generated.";
      this.addToHistory("assistant", assistantResponse);
      
      return assistantResponse;

    } catch (error) {
      console.error('LLM Service Error:', error);
      
      // Provide more specific error messages
      if (error.message.includes('tool_call_id')) {
        return `Tool calling error: ${error.message}. This might be a conversation state issue. Please try asking your question again.`;
      } else if (error.message.includes('400')) {
        return `API Error: ${error.message}. Please check your request format.`;
      } else if (error.message.includes('401')) {
        return `Authentication Error: ${error.message}. Please check your OpenAI API key.`;
      } else {
        return `Error: ${error.message}. Please try again or check your OpenAI API key.`;
      }
    }
  }

  // Heuristic helpers with fuzzy matching
  detectHeaderColumn(labelHint) {
    const hint = (labelHint || '').toLowerCase().trim();
    if (!this.spreadsheetData[0]) return -1;
    let bestCol = -1;
    let bestScore = -1;
    
    for (let c = 0; c < (this.spreadsheetData[0]?.length || 0); c++) {
      const v = String(this.spreadsheetData[0]?.[c]?.value ?? '').toLowerCase().trim();
      if (!v) continue;
      
      let score = 0;
      const similarity = this.calculateSimilarity(v, hint);
      
      // Base score from similarity
      if (similarity >= 0.8) score += similarity * 5;
      else if (similarity >= 0.6) score += similarity * 3;
      else if (similarity >= 0.4) score += similarity * 1;
      
      // Bonus for exact match
      if (v === hint) score += 3;
      
      // Bonus for columns with numeric data below (likely metrics)
      let numericBelow = 0;
      for (let r = 1; r < Math.min(this.spreadsheetData.length, 10); r++) {
        const val = this.parseNumericValue(this.spreadsheetData[r]?.[c]?.value);
        if (val !== undefined) numericBelow++;
      }
      score += numericBelow * 0.5;
      
      if (score > bestScore) { 
        bestScore = score; 
        bestCol = c; 
      }
    }
    return bestCol;
  }

  detectRowLabelColumn(labelHint) {
    const hint = (labelHint || '').toLowerCase().trim();
    let bestCol = -1;
    let bestScore = -1;
    const colCount = this.spreadsheetData[0]?.length || 0;
    
    for (let c = 0; c < colCount; c++) {
      let textCount = 0;
      let hintLikeCount = 0;
      let uniqueSet = new Set();
      let totalSimilarity = 0;
      let similarityCount = 0;
      
      for (let r = 1; r < this.spreadsheetData.length; r++) {
        const raw = this.spreadsheetData[r]?.[c]?.value;
        if (raw === undefined || raw === null) continue;
        const s = String(raw).trim();
        if (!s) continue;
        
        const isText = isNaN(Number(s));
        if (isText) {
          textCount++;
          uniqueSet.add(s.toLowerCase());
          
          const lower = s.toLowerCase();
          const similarity = this.calculateSimilarity(lower, hint);
          
          if (similarity >= 0.8) {
            hintLikeCount++;
            totalSimilarity += similarity;
            similarityCount++;
          }
          
          // Boost for client-like patterns
          if (/client[_\- ]?\d+/i.test(s)) hintLikeCount += 2;
        }
      }
      
      const avgSimilarity = similarityCount > 0 ? totalSimilarity / similarityCount : 0;
      const score = hintLikeCount * 3 + textCount + uniqueSet.size * 0.5 + avgSimilarity * 2;
      
      if (score > bestScore) { 
        bestScore = score; 
        bestCol = c; 
      }
    }
    return bestCol;
  }

  // Treat anything "label-like" as text; anything "value-like" as number/date.
  isLikelyHeader(value) {
    const s = String(value ?? "").trim();
    if (!s) return false;
    // Headers are short-ish, mostly letters, occasionally include %/$
    const letterRatio = (s.replace(/[^A-Za-z]/g, "").length) / s.length;
    return letterRatio >= 0.5 && s.length <= 40;
  }

  isLikelyEntity(value) {
    const s = String(value ?? "").trim();
    if (!s) return false;
    // Longer text or id-like strings are treated as entities
    return /\w{3,}/.test(s) && !this.isNumericCell(s);
  }

  // Expand left until you hit the entity/row header column; expand up until column headers.
  // Then expand right/down while values are "value-like" (numbers/dates) and row labels persist.
  _establishSubframeFromSeed(seedRow, seedCol, { maxBlankStreak = 2, maxRows = 100 } = {}) {
    const rows = this.spreadsheetData.length;
    const cols = this.spreadsheetData[0]?.length ?? 0;
    if (!rows || !cols) return null;

    // 1) Go up to find header row
    let top = seedRow;
    while (top > 0 && !this.isLikelyHeader(this.spreadsheetData[top]?.[seedCol]?.value)) {
      top--;
      // stop if we hit an empty wall
      if (top === 0) break;
    }

    // 2) Go left to find entity column
    let left = seedCol;
    while (left > 0 && !this.isLikelyEntity(this.spreadsheetData[seedRow]?.[left]?.value)) {
      left--;
      if (left === 0) break;
    }

    // Snap to the likely header cell if present
    const headerRow = Math.max(0, top);
    const entityCol = Math.max(0, left);

    // 3) Expand right while header cells look like headers (or first row of data is numeric)
    let right = seedCol;
    let blankStreak = 0;
    for (let c = seedCol; c < cols; c++) {
      const headerCell = this.spreadsheetData[headerRow]?.[c];
      const belowCell = this.spreadsheetData[headerRow + 1]?.[c];
      const headerOK = this.isLikelyHeader(headerCell?.value);
      const valuesOK = this.parseNumericValue(belowCell?.value) !== undefined || this.isDateCell(belowCell?.value);
      if (headerOK || valuesOK) {
        right = c;
        blankStreak = 0;
      } else {
        blankStreak++;
        if (blankStreak > maxBlankStreak) break;
      }
    }

    // 4) Expand down while entity labels continue and values exist in metric columns
    let bottom = seedRow;
    blankStreak = 0;
    const maxBottomRow = Math.min(rows - 1, seedRow + maxRows - 1);
    
    for (let r = seedRow; r <= maxBottomRow; r++) {
      const entityCell = this.spreadsheetData[r]?.[entityCol];
      const looksEntity = this.isLikelyEntity(entityCell?.value);
      // Check at least one numeric/date in the row across the metric columns
      let anyValue = false;
      for (let c = entityCol + 1; c <= right; c++) {
        const v = this.spreadsheetData[r]?.[c]?.value;
        if (this.parseNumericValue(v) !== undefined || this.isDateCell(v)) { anyValue = true; break; }
      }
      if (looksEntity && anyValue) {
        bottom = r;
        blankStreak = 0;
      } else {
        blankStreak++;
        if (blankStreak > maxBlankStreak) break;
      }
    }

    // Final safety
    if (right <= entityCol || bottom <= headerRow) return null;

    return {
      headerRow,
      entityCol,
      topLeft: { r: headerRow, c: entityCol },
      bottomRight: { r: bottom, c: right },
      a1Range: `${rcToAddr(headerRow + 1, entityCol + 1)}:${rcToAddr(bottom + 1, right + 1)}`
    };
  }

  // Extract values and compute argmax (client with most agents)
  _extractComparisonFromSubframe(frame, labelHint1) {
    const { headerRow, entityCol, bottomRight } = frame;
    // pick metric column by fuzzy matching header row to labelHint1 (e.g., "agents")
    let bestCol = -1, bestScore = -1;
    for (let c = entityCol + 1; c <= bottomRight.c; c++) {
      const headerVal = this.spreadsheetData[headerRow]?.[c]?.value ?? "";
      const score = this.calculateSimilarity(String(headerVal), String(labelHint1));
      if (score > bestScore) { bestScore = score; bestCol = c; }
    }
    if (bestCol === -1 || bestScore < 0.8) return { error: `Couldn't find a metric column for "${labelHint1}" in header row` };

    // scan entities and pick max
    let maxVal = -Infinity, maxEntity = null, maxAddr = null;
    const rows = this.spreadsheetData.length;
    for (let r = headerRow + 1; r <= bottomRight.r && r < rows; r++) {
      const entity = this.spreadsheetData[r]?.[entityCol]?.value;
      const raw = this.spreadsheetData[r]?.[bestCol]?.value;
      const v = this.parseNumericValue(raw);
      if (entity != null && v !== undefined) {
        if (v > maxVal) { maxVal = v; maxEntity = entity; maxAddr = rcToAddr(r + 1, bestCol + 1); }
      }
    }

    if (maxEntity === null) return { error: "No numeric values found in metric column." };

    return {
      metricHeader: this.spreadsheetData[headerRow]?.[bestCol]?.value,
      entityHeader: this.spreadsheetData[headerRow]?.[entityCol]?.value,
      winnerEntity: maxEntity,
      winnerValue: maxVal,
      winnerAddr: maxAddr,
      metricColA1: rcToAddr(headerRow + 1, bestCol + 1),
      entityColA1: rcToAddr(headerRow + 1, entityCol + 1)
    };
  }
}
