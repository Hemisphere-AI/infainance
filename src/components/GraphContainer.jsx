// TODO: Placeholder GraphContainer until Google Sheets integration is finalized
import React from 'react'
// PropTypes not needed for placeholder

const GraphContainer = () => {
  return (
    <div className="w-full bg-gray-50 p-2">
      <div className="flex items-center justify-center h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">GraphContainer Temporarily Hidden</h3>
          <p className="mt-1 text-sm text-gray-500">TODO: Update for Google Sheets integration</p>
        </div>
      </div>
    </div>
  )
}

// no propTypes for placeholder

export default GraphContainer
