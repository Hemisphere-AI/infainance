/* eslint-env node */
// Odoo Checks Runner
// Loads checks from YAML catalog and executes them using MCP client

import fs from 'fs';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import MCPOdooClient from './services/mcpOdooClient.js';
// import { LLMErpService } from '../src/services/llmErpService.js';

// Load environment variables
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple possible paths for .env file
const envPaths = [
  path.join(__dirname, '../.env'),           // From backend/ folder
  path.join(__dirname, '../../.env'),        // From root folder
  path.join(process.cwd(), '.env'),          // From current working directory
  path.join(process.cwd(), '../.env')        // From parent of current working directory
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath });
    if (process.env.ODOO_URL) {
      envLoaded = true;
      console.log(`🔧 Environment loaded from: ${envPath}`);
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

if (!envLoaded) {
  console.error('❌ Could not load environment variables from any path');
  console.log('Tried paths:', envPaths);
}

class ChecksRunner {
  constructor() {
    this.mcpClient = null;
    this.llmErpService = null;
    this.checks = [];
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Checks Runner...');
      
      // Initialize MCP client
      this.mcpClient = new MCPOdooClient();
      const mcpInitialized = await this.mcpClient.initialize();
      
      if (!mcpInitialized) {
        throw new Error('Failed to initialize MCP client');
      }
      
      // Initialize LLM ERP service (temporarily disabled)
      // const apiKey = process.env.VITE_OPENAI_KEY;
      // if (apiKey && apiKey !== 'your_openai_api_key_here') {
      //   this.llmErpService = new LLMErpService(null);
      //   console.log('🤖 LLM ERP service initialized');
      // } else {
      //   console.log('⚠️ OpenAI API key not configured, LLM analysis will be skipped');
      // }
      this.llmErpService = null; // Temporarily disable LLM analysis
      console.log('⚠️ LLM analysis temporarily disabled');
      
      console.log('✅ Checks Runner initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Checks Runner initialization failed:', error);
      return false;
    }
  }

  async loadChecks(catalogPath = null) {
    try {
      // If no path provided, try to find the YAML file
      if (!catalogPath) {
        const possiblePaths = [
          path.join(__dirname, 'config/odoo_checks.yaml'),     // From backend/ folder
          path.join(process.cwd(), 'backend/config/odoo_checks.yaml'), // From root folder
          path.join(process.cwd(), 'config/odoo_checks.yaml')  // From current working directory
        ];
        
        for (const possiblePath of possiblePaths) {
          try {
            if (fs.existsSync(possiblePath)) {
              catalogPath = possiblePath;
              break;
            }
          } catch (error) {
            // Continue to next path
          }
        }
        
        if (!catalogPath) {
          throw new Error('Could not find odoo_checks.yaml file');
        }
      }
      
      console.log(`📋 Loading checks from ${catalogPath}...`);
      const fileContents = fs.readFileSync(catalogPath, 'utf8');
      this.checks = yaml.load(fileContents);
      console.log(`✅ Loaded ${this.checks.length} checks`);
      return true;
    } catch (error) {
      console.error('❌ Failed to load checks catalog:', error);
      return false;
    }
  }

  async runCheck(check) {
    console.log('🔍 runCheck called with:', check);
    
    if (!check || !check.key) {
      throw new Error('checkKey is required');
    }
    
    const startTime = Date.now();
    const checkContext = {
      check_key: check.key,
      check_title: check.title,
      model: check.model,
      domain: JSON.stringify(check.domain),
      fields: check.fields.join(','),
      severity: check.severity
    };

    console.log(`🔍 Running check: ${check.title} (${check.key})`);
    
    try {
      // Parse domain from YAML string to array
      let domain = check.domain;
      if (typeof domain === 'string') {
        domain = JSON.parse(domain);
      }

      // Execute the check using MCP client
      const result = await this.mcpClient.searchRecords(
        check.model,
        domain,
        check.fields,
        1000 // Limit to 1000 records per check
      );

      if (result.success) {
        const duration = Date.now() - startTime;
        const checkResult = {
          key: check.key,
          title: check.title,
          description: check.description,
          severity: check.severity,
          model: check.model,
          domain: domain,
          records: result.records || [],
          count: result.count || 0,
          success: true,
          duration,
          timestamp: new Date().toISOString()
        };

        // Structured logging for successful check
        console.log(`✅ Check completed: ${check.title}`, {
          ...checkContext,
          duration,
          nr_rows: result.count || 0,
          status: 'success'
        });

        // Get LLM analysis of the check results
        if (this.llmErpService) {
          console.log(`🤖 Analyzing results with LLM...`);
          const llmAnalysis = await this.llmErpService.analyzeOdooCheck(check, checkResult);
          
          if (llmAnalysis.success) {
            checkResult.llmAnalysis = llmAnalysis.analysis;
            checkResult.tokensUsed = llmAnalysis.tokensUsed;
            console.log(`✅ LLM analysis completed (${llmAnalysis.tokensUsed} tokens)`);
          } else {
            console.log(`⚠️ LLM analysis failed: ${llmAnalysis.error}`);
            checkResult.llmAnalysis = `LLM analysis failed: ${llmAnalysis.error}`;
          }
        } else {
          checkResult.llmAnalysis = 'LLM analysis not available (OpenAI API key not configured)';
        }

        // Log results based on severity
        if (result.count > 0) {
          const severityEmoji = {
            'critical': '🚨',
            'high': '⚠️',
            'medium': 'ℹ️',
            'low': '💡'
          };
          
          console.log(`${severityEmoji[check.severity] || '📊'} Found ${result.count} issues: ${check.title}`);
          
          // Show sample records for critical/high severity
          if (['critical', 'high'].includes(check.severity) && result.records.length > 0) {
            console.log('   Sample records:');
            result.records.slice(0, 3).forEach((record, index) => {
              const summary = this.summarizeRecord(record, check.fields);
              console.log(`   ${index + 1}. ${summary}`);
            });
          }
        } else {
          console.log(`✅ No issues found: ${check.title}`);
        }

        return checkResult;
      } else {
        const duration = Date.now() - startTime;
        
        // Structured logging for failed check
        console.log(`❌ Check failed: ${check.title}`, {
          ...checkContext,
          duration,
          nr_rows: 0,
          status: 'failed',
          error: result.error
        });

        return {
          key: check.key,
          title: check.title,
          description: check.description,
          severity: check.severity,
          model: check.model,
          domain: domain,
          records: [],
          count: 0,
          success: false,
          error: result.error,
          duration,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Structured logging for exception
      console.log(`❌ Check exception: ${check.title}`, {
        ...checkContext,
        duration,
        nr_rows: 0,
        status: 'exception',
        error: error.message
      });

      return {
        key: check.key,
        title: check.title,
        description: check.description,
        severity: check.severity,
        model: check.model,
        domain: check.domain,
        records: [],
        count: 0,
        success: false,
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Store check results in the database
   * @param {string} checkId - The check ID to associate with the results
   * @param {Object} result - The check result data
   */
  async storeResultsInDatabase(checkId, result) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ Supabase configuration missing - results not saved to database');
        return false;
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const resultData = {
        check_id: checkId,
        status: result.status || 'unknown',
        executed_at: result.timestamp || new Date().toISOString(),
        duration: result.duration || 0,
        success: result.success || false,
        query_plan: result.queryPlan || null,
        record_count: result.count || 0,
        records: result.records || null,
        llm_analysis: result.llmAnalysis || null,
        tokens_used: result.tokensUsed || null,
        execution_steps: result.steps || null,
        error_message: result.error || null
      };
      
      const { error: insertError } = await supabase
        .from('checks_results')
        .insert(resultData);
      
      if (insertError) {
        console.error('Failed to save check results to database:', insertError);
        console.error('Result data:', JSON.stringify(resultData, null, 2));
        return false;
      } else {
        console.log('✅ Check results saved to database');
        // Update root check status when agent provides one
        if (result.status) {
          const { error: updateCheckError } = await supabase
            .from('checks')
            .update({ status: result.status, updated_at: new Date().toISOString() })
            .eq('id', checkId);
          if (updateCheckError) {
            console.error('Failed to update root check status:', updateCheckError);
          }
        }
        return true;
      }
    } catch (error) {
      console.error('Database save error:', error);
      return false;
    }
  }

  summarizeRecord(record, fields) {
    // Create a summary of the record for logging
    const summary = [];
    
    // Always include ID if available
    if (record.id) {
      summary.push(`ID: ${record.id}`);
    }
    
    // Include key fields
    const keyFields = ['name', 'partner_id', 'amount_total', 'balance', 'date'];
    keyFields.forEach(field => {
      if (record[field] && fields.includes(field)) {
        let value = record[field];
        if (Array.isArray(value) && value.length >= 2) {
          value = value[1]; // Get the display name from [id, name] format
        }
        summary.push(`${field}: ${value}`);
      }
    });
    
    return summary.join(' | ');
  }

  async runAllChecks() {
    if (!this.mcpClient) {
      throw new Error('Checks Runner not initialized');
    }

    if (this.checks.length === 0) {
      throw new Error('No checks loaded');
    }

    console.log(`\n🚀 Running ${this.checks.length} checks...\n`);
    
    const results = [];
    const startTime = Date.now();

    for (const check of this.checks) {
      const result = await this.runCheck(check);
      results.push(result);
      console.log(''); // Empty line for readability
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Generate summary
    const summary = this.generateSummary(results, duration);
    console.log(summary);

    return {
      success: true,
      results,
      summary: this.parseSummary(summary),
      duration,
      timestamp: new Date().toISOString()
    };
  }

  generateSummary(results, duration) {
    const totalChecks = results.length;
    const successfulChecks = results.filter(r => r.success).length;
    const failedChecks = totalChecks - successfulChecks;
    
    const issuesBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };
    
    let totalIssues = 0;
    let totalTokensUsed = 0;
    
    results.forEach(result => {
      if (result.success) {
        totalIssues += result.count;
        issuesBySeverity[result.severity] += result.count;
        if (result.tokensUsed) {
          totalTokensUsed += result.tokensUsed;
        }
      }
    });

    const criticalIssues = results.filter(r => r.success && r.severity === 'critical' && r.count > 0);
    const highIssues = results.filter(r => r.success && r.severity === 'high' && r.count > 0);

    let summary = '\n📊 CHECKS SUMMARY\n';
    summary += '='.repeat(50) + '\n';
    summary += `⏱️  Duration: ${(duration / 1000).toFixed(2)}s\n`;
    summary += `✅ Successful checks: ${successfulChecks}/${totalChecks}\n`;
    summary += `❌ Failed checks: ${failedChecks}\n`;
    summary += `📈 Total issues found: ${totalIssues}\n`;
    summary += `🤖 Total LLM tokens used: ${totalTokensUsed}\n\n`;
    
    summary += '🚨 ISSUES BY SEVERITY:\n';
    summary += `   Critical: ${issuesBySeverity.critical} issues\n`;
    summary += `   High: ${issuesBySeverity.high} issues\n`;
    summary += `   Medium: ${issuesBySeverity.medium} issues\n`;
    summary += `   Low: ${issuesBySeverity.low} issues\n\n`;

    if (criticalIssues.length > 0) {
      summary += '🚨 CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION:\n';
      criticalIssues.forEach(issue => {
        summary += `   - ${issue.title}: ${issue.count} issues\n`;
        if (issue.llmAnalysis) {
          // Extract key insights from LLM analysis (first 200 chars)
          const insight = issue.llmAnalysis.replace(/\n/g, ' ').substring(0, 200) + '...';
          summary += `     💡 ${insight}\n`;
        }
      });
      summary += '\n';
    }

    if (highIssues.length > 0) {
      summary += '⚠️  HIGH PRIORITY ISSUES:\n';
      highIssues.forEach(issue => {
        summary += `   - ${issue.title}: ${issue.count} issues\n`;
        if (issue.llmAnalysis) {
          // Extract key insights from LLM analysis (first 150 chars)
          const insight = issue.llmAnalysis.replace(/\n/g, ' ').substring(0, 150) + '...';
          summary += `     💡 ${insight}\n`;
        }
      });
      summary += '\n';
    }

    if (failedChecks > 0) {
      summary += '❌ FAILED CHECKS:\n';
      results.filter(r => !r.success).forEach(result => {
        summary += `   - ${result.title}: ${result.error}\n`;
      });
      summary += '\n';
    }

    summary += '✅ All checks completed successfully!\n';
    summary += '🤖 Each check includes intelligent LLM analysis for actionable insights.\n';
    
    return summary;
  }

  parseSummary(summaryText) {
    // Parse the summary text to extract key metrics
    const lines = summaryText.split('\n');
    const metrics = {};
    
    lines.forEach(line => {
      if (line.includes('Duration:')) {
        metrics.duration = line.split(': ')[1];
      } else if (line.includes('Successful checks:')) {
        metrics.successfulChecks = line.split(': ')[1];
      } else if (line.includes('Total issues found:')) {
        metrics.totalIssues = parseInt(line.split(': ')[1]);
      }
    });
    
    return metrics;
  }
}

// Main execution function
async function main() {
  const runner = new ChecksRunner();
  
  try {
    // Initialize the runner
    const initialized = await runner.initialize();
    if (!initialized) {
      console.error('❌ Failed to initialize checks runner');
      process.exit(1);
    }

    // Load checks from YAML
    const checksLoaded = await runner.loadChecks();
    if (!checksLoaded) {
      console.error('❌ Failed to load checks catalog');
      process.exit(1);
    }

    // Run all checks
    const results = await runner.runAllChecks();
    
    // Optionally save results to file
    const resultsFile = `./results/checks_${new Date().toISOString().split('T')[0]}.json`;
    try {
      fs.mkdirSync('./results', { recursive: true });
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to: ${resultsFile}`);
    } catch (error) {
      console.log('⚠️  Could not save results file:', error.message);
    }

  } catch (error) {
    console.error('❌ Checks runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ChecksRunner;
