/**
 * Simple ERP Analysis Service
 * Handles deterministic analysis of Odoo check results
 */
export class LLMErpService {
  constructor(user = null) {
    this.user = user; // Store user information for token tracking
  }

  // Deprecated: Status evaluation is now fully delegated to the agent's conclude tool.
  // This method is kept as a no-op to avoid breaking imports; it simply echoes inputs.
  async analyzeOdooCheck(checkData) {
    return {
      success: true,
      analysis: 'Delegated to agent conclude tool',
      status: undefined,
      acceptanceCriteria: checkData?.acceptance_criteria || '',
      tokensUsed: 0,
      timestamp: new Date().toISOString()
    };
  }
}
