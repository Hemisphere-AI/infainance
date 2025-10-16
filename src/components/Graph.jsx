// TODO: Placeholder Graph component until Google Sheets integration is finalized
import React from 'react'
import PropTypes from 'prop-types'

const Graph = ({ title }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
      <div className="flex items-center justify-center h-48 text-gray-400">
        <div className="text-center">
          <div className="text-2xl mb-1">📊</div>
          <p className="text-xs">{title || 'Graph Temporarily Hidden'}</p>
          <p className="text-xs text-gray-300">TODO: Update for Google Sheets integration</p>
        </div>
      </div>
    </div>
  )
}

Graph.propTypes = {
  title: PropTypes.string
}

export default Graph
