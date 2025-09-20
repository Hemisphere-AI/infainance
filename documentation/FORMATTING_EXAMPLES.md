# Excel Formatting Extraction Examples

This document shows examples of the formatting information that can now be extracted from Excel files.

## Supported Formatting Types

### 1. Date and Time Formats
- **mm/dd/yyyy** - US date format (e.g., "12/25/2023")
- **dd/mm/yyyy** - UK date format (e.g., "25/12/2023") 
- **yyyy-mm-dd** - ISO date format (e.g., "2023-12-25")
- **h:mm** - Time format (e.g., "14:30")
- **hh:mm** - 24-hour time format (e.g., "14:30")

### 2. Number Formats
- **Currency** - Dollar format (e.g., "$1,234.56")
- **Percentage** - Percentage format (e.g., "15.5%")
- **Decimal places** - Custom decimal precision (e.g., "123.45" with 2 decimals)
- **Thousands separator** - Comma-separated numbers (e.g., "1,234,567")

### 3. Cell Types
- **Date cells** - Automatically detected and formatted
- **Number cells** - Numeric values with formatting
- **Text cells** - String values
- **Formula cells** - Excel formulas (e.g., "=SUM(A1:A10)")
- **Boolean cells** - True/False values

## Cell Structure

Each cell now contains enhanced formatting information:

```javascript
{
  value: "12/25/2023",           // Formatted display value
  className: "",                 // CSS class for styling
  numberFormat: "mm/dd/yyyy",    // Original Excel format string
  cellType: "date",              // Detected cell type
  isDate: true,                  // Boolean flag for date cells
  decimalPlaces: null,           // Number of decimal places
  isFormula: false,              // Whether cell contains formula
  formula: null,                 // The actual formula (if any)
  originalFormat: {              // Complete formatting metadata
    numberFormat: "mm/dd/yyyy",
    cellType: "d",
    isFormula: false,
    formula: null,
    style: {...}
  }
}
```

## Usage Examples

### Reading a Cell with Formatting
```javascript
// The LLM service now returns enhanced cell information
const cellInfo = llmService.readCell("A1");
console.log(cellInfo);
// Output:
// {
//   address: "A1",
//   value: "$1,234.56",
//   isFormula: false,
//   isDate: false,
//   decimalPlaces: 2,
//   cellType: "number",
//   numberFormat: "$#,##0.00",
//   originalFormat: {...}
// }
```

### Date Formatting
```javascript
// Excel serial date 44927 (December 25, 2023) with format "mm/dd/yyyy"
// Will be displayed as "12/25/2023"
```

### Currency Formatting
```javascript
// Number 1234.56 with format "$#,##0.00"
// Will be displayed as "$1,234.56"
```

### Percentage Formatting
```javascript
// Number 0.155 with format "0.00%"
// Will be displayed as "15.50%"
```

## Debug Information

When uploading an Excel file, check the browser console for:
- **Original data**: Raw cell values from Excel
- **Spreadsheet format**: Processed cells with formatting
- **Cell formats extracted**: Number of rows with formatting information
- **Formatting examples**: Sample formatting information extracted

## Benefits

1. **Preserves Excel formatting** - Dates, currencies, percentages maintain their original appearance
2. **Better data analysis** - LLM can understand cell types and formats
3. **Improved user experience** - Data looks exactly as it did in Excel
4. **Enhanced tool capabilities** - Tools can work with properly formatted data
5. **Formula preservation** - Excel formulas are maintained and can be executed

## Technical Implementation

The formatting extraction works by:
1. Reading Excel files with the XLSX library
2. Extracting cell formatting metadata (cell.z, cell.t, cell.f, cell.s)
3. Analyzing format strings to determine cell types
4. Applying appropriate JavaScript formatting
5. Storing all formatting information for future reference

This ensures that when you upload an Excel file, all the formatting information including date/time formats, number formats, and cell types are preserved and can be used by the LLM for better analysis.
