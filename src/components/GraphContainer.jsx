import React, { useState, useCallback, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Plus } from 'lucide-react'
import Graph from './Graph'
import { graphService } from '../services/graphService'

const GraphContainer = ({ 
  spreadsheetData = [], 
  allSheetsData = {}, 
  currentSheetName = 'Sheet1',
  graphs = [],
  onGraphsChange,
  spreadsheetId,
  userId
}) => {
  const [editingGraph, setEditingGraph] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // Add a new graph
  const addGraph = useCallback(async () => {
    if (!spreadsheetId || !userId) {
      return
    }

    setIsLoading(true)
    try {
      const newGraph = {
        title: '',
        xAxisRange: '',
        yAxisRange: ''
      }
      
      const savedGraph = await graphService.createGraph(spreadsheetId, userId, newGraph)
      
      // Map database fields to component props
      const graphWithEditing = {
        id: savedGraph.id,
        title: savedGraph.title,
        xAxisRange: savedGraph.label_range,
        yAxisRange: savedGraph.value_range,
        isEditing: true
      }
      
      if (onGraphsChange) {
        onGraphsChange([...graphs, graphWithEditing])
      }
    } catch (error) {
      console.error('Error creating graph:', error)
    } finally {
      setIsLoading(false)
    }
  }, [graphs, onGraphsChange, spreadsheetId, userId])

  // Update a specific graph
  const updateGraph = useCallback(async (graphId, updates) => {
    try {
      // Update in database - map component fields to database fields
      await graphService.updateGraph(graphId, {
        title: updates.title,
        label_range: updates.xAxisRange,
        value_range: updates.yAxisRange
      })
      
      // Update local state
      if (onGraphsChange) {
        const updatedGraphs = graphs.map(graph => 
          graph.id === graphId ? { ...graph, ...updates } : graph
        )
        onGraphsChange(updatedGraphs)
      }
    } catch (error) {
      console.error('Error updating graph:', error)
    }
  }, [graphs, onGraphsChange])

  // Delete a graph
  const deleteGraph = useCallback(async (graphId) => {
    try {
      // Delete from database
      await graphService.deleteGraph(graphId)
      
      // Update local state
      if (onGraphsChange) {
        const updatedGraphs = graphs.filter(graph => graph.id !== graphId)
        onGraphsChange(updatedGraphs)
      }
    } catch (error) {
      console.error('Error deleting graph:', error)
    }
  }, [graphs, onGraphsChange])

  // Handle graph configuration change
  const handleGraphConfigChange = useCallback((graphId, config) => {
    updateGraph(graphId, {
      ...config,
      isEditing: false
    })
  }, [updateGraph])

  // Handle edit toggle
  const handleEditToggle = useCallback((graphId, isEditing) => {
    setEditingGraph(isEditing ? graphId : null)
    updateGraph(graphId, { isEditing })
  }, [updateGraph])

  // Calculate grid layout based on number of graphs
  const getGridLayout = () => {
    const count = graphs.length
    if (count === 0) return 'grid-cols-1'
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-2'
    if (count <= 4) return 'grid-cols-2'
    if (count <= 6) return 'grid-cols-3'
    return 'grid-cols-4'
  }

  return (
    <div className="w-full bg-gray-50 p-2">

      {/* Graphs Grid */}
      {graphs.length === 0 ? (
        <div className="flex items-center justify-center h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No graphs yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first graph.</p>
            <div className="mt-6">
              <button
                onClick={addGraph}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Add Graph
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`grid ${getGridLayout()} gap-4 h-full`}>
          {graphs.map((graph) => (
            <div key={graph.id} className="relative">
              <Graph
                title={graph.title}
                xAxisRange={graph.xAxisRange}
                yAxisRange={graph.yAxisRange}
                onConfigChange={(config) => handleGraphConfigChange(graph.id, config)}
                isEditing={graph.isEditing}
                onEditToggle={(isEditing) => handleEditToggle(graph.id, isEditing)}
                onDelete={() => deleteGraph(graph.id)}
                onAddGraph={addGraph}
                spreadsheetData={spreadsheetData}
                allSheetsData={allSheetsData}
                currentSheetName={currentSheetName}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

GraphContainer.propTypes = {
  spreadsheetData: PropTypes.array,
  allSheetsData: PropTypes.object,
  currentSheetName: PropTypes.string,
  graphs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string,
    xAxisRange: PropTypes.string,
    yAxisRange: PropTypes.string,
    isEditing: PropTypes.bool
  })),
  onGraphsChange: PropTypes.func
}

export default GraphContainer
