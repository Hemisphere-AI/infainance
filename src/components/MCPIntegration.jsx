import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
// import { Play, Loader2, Brain } from 'lucide-react'; // Unused imports
import { LLMErpService } from '../services/llmErpService';
import { formatMarkdown } from '../utils/markdownFormatter';

const MCPIntegration = ({ 
  check, 
  onAnalysisComplete,
  onRunAnalysis
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAgent, setAiAgent] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const analyzeCheckRef = useRef(null);

  // Initialize AI agent
  useEffect(() => {
    const initServices = async () => {
      const agent = new LLMErpService();
      setAiAgent(agent);
    };
    
    initServices();
  }, []);

  const analyzeCheck = useCallback(async () => {
    if (!check?.description || !aiAgent || isAnalyzing) return; // Prevent multiple simultaneous analyses
    
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      console.log('🔍 Starting AI analysis for:', check.description);
      
      // Create mock check results (since we're not actually running the check here)
      const checkResults = { 
        count: 0, 
        success: true, 
        records: [],
        error: 'MCPIntegration should not be used - use CheckResult.jsx instead'
      };

      console.log('🎯 MCPIntegration analysis (using empty data)');
      
      // Use AI agent to plan and execute the analysis
      // Note: This should get real data from MCP, not hardcoded empty data
      const aiResult = await aiAgent.analyzeOdooCheck(check, checkResults);
      
      console.log('✅ MCPIntegration analysis complete');
      
      setAiAnalysis(aiResult);
      
      if (onAnalysisComplete) {
        onAnalysisComplete({
          aiResult,
          combined: {
            description: check.description,
            aiAnalysis: aiResult,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      setAiAnalysis({
        success: false,
        error: error.message
      });
    } finally {
      setIsAnalyzing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check?.description, onAnalysisComplete, aiAgent, isAnalyzing]); // Use check?.description instead of check object

  // Update ref with latest analyzeCheck function
  useEffect(() => {
    analyzeCheckRef.current = analyzeCheck;
  }, [analyzeCheck]);

  // Pass analyzeCheck function to parent component
  useEffect(() => {
    if (onRunAnalysis) {
      onRunAnalysis(() => {
        if (analyzeCheckRef.current) {
          return analyzeCheckRef.current();
        }
      });
    }
  }, [onRunAnalysis]); // Remove analyzeCheck from dependencies to prevent infinite loop

  if (!check) return null;

  return (
    <div className="space-y-4">
      {/* AI Analysis Results - only show if there's a description and results */}
      {check.description && aiAnalysis && (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border p-4">
            {aiAnalysis.success ? (
              <div className="prose prose-sm max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: formatMarkdown(aiAnalysis.aiAnalysis) 
                  }} 
                />
              </div>
            ) : (
              <div className="text-sm text-red-600">
                <p>AI Analysis failed: {aiAnalysis.error}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

MCPIntegration.propTypes = {
  check: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    status: PropTypes.oneOf(['active', 'completed', 'cancelled', 'passed', 'failed', 'unknown', 'warning']).isRequired,
    created_at: PropTypes.string.isRequired,
    updated_at: PropTypes.string.isRequired
  }),
  onAnalysisComplete: PropTypes.func,
  onRunAnalysis: PropTypes.func
};

export default MCPIntegration;