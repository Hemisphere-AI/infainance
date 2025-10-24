/* eslint-env node */
import { OdooAiAgent as CoreOdooAiAgent } from '../../src/services/OdooAiAgent.js';

/**
 * Backend Odoo AI Agent Wrapper
 * Environment-specific wrapper for backend Node.js environment
 * Uses the core implementation for consistency across environments
 */
export class BackendOdooAiAgent extends CoreOdooAiAgent {
  constructor(customConfig = null) {
    super(customConfig);
  }

  // All methods are inherited from CoreOdooAiAgent
  // This class serves as a backend-specific wrapper
}
