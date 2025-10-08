import React from 'react'
import PropTypes from 'prop-types'

// Minimal read-only spreadsheet grid
// - Renders a 2D array with row/column headers
// - All editing/formatting/export logic removed
// - TODO: Add tabs UI when sheet names are available

const ReactSpreadsheet = ({ data = [], allSheetsData = {}, currentSheetName = 'Sheet1', onTabChange = () => {} }) => {
  const columnCount = data[0]?.length || 0
  const rowCount = data.length || 0

  const getColumnLetter = (index) => {
    let result = ''
    while (index >= 0) {
      result = String.fromCharCode(65 + (index % 26)) + result
      index = Math.floor(index / 26) - 1
    }
    return result
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/**
       * TODO: Tabs UI (requires sheet names in data)
       * <div className="border-b border-gray-200 bg-white px-2 py-1 flex gap-2 overflow-x-auto">
       *   {Object.keys(allSheetsData).map((name) => (
       *     <button
       *       key={name}
       *       className={`text-xs px-2 py-1 rounded ${name === currentSheetName ? 'bg-gray-200 text-gray-900' : 'bg-white text-gray-600 border'}`}
       *       onClick={() => onTabChange(name)}
       *     >
       *       {name}
       *     </button>
       *   ))}
       * </div>
       */}

      <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
        <table className="excel-grid w-full border-collapse">
          <thead className="sticky top-0 bg-white z-30">
            <tr>
              <th className="bg-gray-100 border border-gray-300 text-center text-xs font-medium text-gray-700 py-2" />
              {Array.from({ length: columnCount }, (_, colIndex) => (
                <th key={colIndex} className="bg-gray-100 border border-gray-300 text-center text-xs font-medium text-gray-700 py-2">
                  {getColumnLetter(colIndex)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, r) => (
              <tr key={r}>
                <td className="sticky left-0 bg-gray-50 border border-gray-300 text-center text-xs font-medium text-gray-700 py-1">{r + 1}</td>
                {Array.from({ length: columnCount }, (_, c) => {
                  const cell = data[r]?.[c]
                  const value = cell?.displayValue ?? cell?.computedValue ?? cell?.value ?? ''
                  const isNumeric = value !== '' && !isNaN(parseFloat(value))
                  return (
                    <td key={c} className={`border border-gray-300 text-xs py-1 px-2 ${isNumeric ? 'text-right' : 'text-center'} hover:bg-gray-50`}>
                      <span className="truncate block">{String(value)}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

ReactSpreadsheet.propTypes = {
  data: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.object)),
  allSheetsData: PropTypes.object,
  currentSheetName: PropTypes.string,
  onTabChange: PropTypes.func
}

export default ReactSpreadsheet