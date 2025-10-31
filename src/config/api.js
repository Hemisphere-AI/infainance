/**
 * Unified API Configuration
 * Works the same in development and production
 */

// Detect environment based on port and hostname
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isNetlifyDev = window.location.port === '8888';
const isViteDev = window.location.port === '5173';

// API Base URL configuration:
// - Netlify Dev (port 8888): Use localhost:8888 (Netlify Functions)
// - Vite Dev (port 5173): Use localhost:3002 (Express server)
// - Production: Use relative URLs (Netlify Functions)
let API_BASE = '';

if (isLocalDev) {
  if (isNetlifyDev) {
    API_BASE = 'http://localhost:8888'; // Netlify Dev with functions
  } else if (isViteDev) {
    API_BASE = 'http://localhost:3002'; // Vite dev with Express server
  }
}
// For production (not localhost), API_BASE remains empty (relative URLs)

export { API_BASE };

// Helper function to build API URLs
export const buildApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE}/${cleanEndpoint}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  ORGANIZATIONS: '/api/organizations',
  ORGANIZATION_CHECKS: (orgId) => `/api/organizations/${orgId}/checks`,
  ORGANIZATION_INTEGRATIONS: (orgId) => `/api/organizations/${orgId}/integrations`,
  ODOO_CONFIG: '/api/odoo/config',
  ODOO_CHECK: '/api/odoo/check',
  CHECK_RESULTS: (checkId) => `/api/checks/${checkId}/results`,
  MCP_RESOURCES: '/api/mcp/resources',
  MCP_TOOLS: '/api/mcp/tools',
  MCP_MODELS: '/api/mcp/models',
  MCP_SEARCH: '/api/mcp/search'
};
