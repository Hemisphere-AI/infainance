import { addrToRC, rcToAddr, sliceRange, getColumnIndex } from '../utils/a1Helpers.js';
import { tokenSortJaroWinkler } from '../utils/similarity.js';
import { updateUserCell } from '../api/sheets.js';

/**
 * LLM Spreadsheet Service
 * Handles all spreadsheet-specific LLM operations and data manipulation
 */
export class LLMSpreadsheetService {
  constructor(spreadsheetData, onDataChange, onToolCall = null, user = null, googleSheetsConfig = null) {
    this.spreadsheetData = spreadsheetData;
    this.onDataChange = onDataChange;
    this.onToolCall = onToolCall; // Callback for tool call visibility
    this.user = user; // Store user information
    this.googleSheetsConfig = googleSheetsConfig; // Google Sheets configuration for sync
  }

  /**
   * Update the spreadsheet data reference
   */
  updateSpreadsheetData(newData) {
    this.spreadsheetData = newData;
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
    trace.push({ step: "analysis()", label1, label2 });

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
  conclude(answer, confidence, sources = [], acceptanceCriteria = '', status = 'unknown') {
    console.log(`Concluding analysis with answer: ${answer}, confidence: ${confidence}, status: ${status}`);
    
    return {
      answer: answer,
      confidence: confidence,
      sources: sources,
      acceptance_criteria: acceptanceCriteria,
      status: status,
      timestamp: new Date().toISOString()
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
      formatting: cell.formatting || null,
      originalFormat: cell.originalFormat || null
    };
  }

  /**
   * Update a cell value
   */
  async updateCell(address, newValue) {
    const { r, c } = addrToRC(address);
    
    // Ensure the row exists
    if (!this.spreadsheetData[r-1]) {
      this.spreadsheetData[r-1] = [];
    }
    
    // Ensure the cell exists
    if (!this.spreadsheetData[r-1][c-1]) {
      this.spreadsheetData[r-1][c-1] = { value: "", className: "" };
    }
    
    // Get the existing cell to preserve formatting properties
    const existingCell = this.spreadsheetData[r-1][c-1];
    
    // Determine if this is a formula
    const stringValue = String(newValue || '');
    const isFormula = stringValue.startsWith('=');
    
    // If the cell is a percentage and the new value contains a % symbol, strip it and convert to decimal
    let processedValue = newValue;
    if (existingCell.isPercentage && typeof newValue === 'string' && newValue.includes('%')) {
      // Strip the % symbol and convert to decimal (e.g., "80%" -> 0.8)
      const numericValue = parseFloat(newValue.replace('%', ''));
      if (!isNaN(numericValue)) {
        processedValue = numericValue / 100; // Convert percentage to decimal
        console.log(`Converting percentage: ${newValue} -> ${processedValue}`);
      }
    }
    
    console.log(`Updating cell ${address}:`, {
      before: existingCell,
      newValue: newValue,
      processedValue: processedValue,
      newValueType: typeof newValue,
      isPercentage: existingCell.isPercentage,
      decimalPlaces: existingCell.decimalPlaces,
      isFormula: isFormula
    });
    
    // Update the cell with proper type and rawValue handling
    this.spreadsheetData[r-1][c-1] = {
      ...existingCell,
      value: processedValue,
      cellType: isFormula ? 'formula' : 'text',
      isFormula: isFormula
    };
    
    console.log(`After update:`, this.spreadsheetData[r-1][c-1]);
    
    // Trigger data change callback with a deep copy to ensure reference change
    if (this.onDataChange) {
      const newData = JSON.parse(JSON.stringify(this.spreadsheetData));
      console.log('Triggering data change with new reference:', newData[r-1][c-1]);
      this.onDataChange(newData);
      
      // If this is a formula, we need to trigger recalculation
      // The spreadsheet component will handle the recalculation queue
      if (isFormula) {
        console.log('Formula detected, triggering recalculation for cell:', address);
        // The spreadsheet component will detect the data change and trigger recalculation
        // We don't need to do anything special here as the component handles it
      }
    }

    // Sync to Google Sheets if configured
    await this.syncToGoogleSheets(address, processedValue, r-1, c-1);
    
    return { 
      address, 
      newValue, 
      success: true, 
      message: `Cell ${address} successfully updated to ${JSON.stringify(processedValue)}` 
    };
  }

  /**
   * Sync cell update to Google Sheets via service account
   */
  async syncToGoogleSheets(address, value, rowIndex, colIndex) {
    // Check if user is available for service account sync
    if (!this.user?.id) {
      console.log('No user ID available for Google Sheets sync, skipping')
      return
    }

    try {
      console.log(`🔄 Syncing cell ${address} to Google Sheets via service account:`, value)
      
      const result = await updateUserCell(
        this.user.id,
        rowIndex,
        colIndex,
        value
      )

      if (result.success) {
        console.log(`✅ Successfully synced cell ${address} to Google Sheets`)
      } else {
        console.warn(`⚠️ Failed to sync cell ${address} to Google Sheets:`, result.error)
      }
    } catch (error) {
      console.error(`❌ Error syncing cell ${address} to Google Sheets:`, error)
    }
  }

  /**
   * Update Google Sheets configuration
   */
  updateGoogleSheetsConfig(config) {
    this.googleSheetsConfig = config
  }

  /**
   * Trigger recalculation
   */
  recalc() {
    // Force a data change to trigger recalculation in the spreadsheet
    if (this.onDataChange) {
      // Create a new reference to trigger React re-render
      const newData = JSON.parse(JSON.stringify(this.spreadsheetData));
      this.onDataChange(newData);
    }
    
    return { 
      changed: 1, 
      message: "Recalculation triggered - all formulas will be re-evaluated" 
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

