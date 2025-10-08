import { supabase } from '../lib/supabase'

export const graphService = {
  // Get all graphs for a spreadsheet
  async getGraphs(spreadsheetId, userId) {
    try {
      const { data, error } = await supabase
        .from('graphs')
        .select('*')
        .eq('spreadsheet_id', spreadsheetId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching graphs:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getGraphs:', error)
      throw error
    }
  },

  // Create a new graph
  async createGraph(spreadsheetId, userId, graphData) {
    try {
      console.log('🔍 GraphService: Creating graph with data:', {
        spreadsheetId,
        userId,
        graphData
      })
      
      const { data, error } = await supabase
        .from('graphs')
        .insert({
          spreadsheet_id: spreadsheetId,
          user_id: userId,
          title: graphData.title || '',
          label_range: graphData.xAxisRange || '',
          value_range: graphData.yAxisRange || ''
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating graph:', error)
        throw error
      }

      console.log('🔍 GraphService: Created graph:', data)
      return data
    } catch (error) {
      console.error('Error in createGraph:', error)
      throw error
    }
  },

  // Update an existing graph
  async updateGraph(graphId, graphData) {
    try {
      console.log('🔍 GraphService: Updating graph with data:', {
        graphId,
        graphData
      })
      
      const { data, error } = await supabase
        .from('graphs')
        .update({
          title: graphData.title || '',
          label_range: graphData.label_range || '',
          value_range: graphData.value_range || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', graphId)
        .select()
        .single()

      if (error) {
        console.error('Error updating graph:', error)
        throw error
      }

      console.log('🔍 GraphService: Updated graph:', data)
      return data
    } catch (error) {
      console.error('Error in updateGraph:', error)
      throw error
    }
  },

  // Delete a graph
  async deleteGraph(graphId) {
    try {
      console.log('🔍 GraphService: Deleting graph with ID:', graphId)
      
      const { error } = await supabase
        .from('graphs')
        .delete()
        .eq('id', graphId)

      if (error) {
        console.error('Error deleting graph:', error)
        throw error
      }

      console.log('🔍 GraphService: Graph deleted successfully')
      return true
    } catch (error) {
      console.error('Error in deleteGraph:', error)
      throw error
    }
  },

  // Subscribe to real-time updates for graphs
  subscribeToGraphs(spreadsheetId, userId, callback) {
    return supabase
      .channel('graphs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'graphs',
          filter: `spreadsheet_id=eq.${spreadsheetId}`
        },
        callback
      )
      .subscribe()
  }
}
