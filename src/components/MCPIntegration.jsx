import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Play, Loader2, Brain } from 'lucide-react';
import OdooAiAgent from '../services/odooAiAgent';

// Function to format markdown-like text for better display
function formatMarkdown(text) {
  if (!text) return '';
  
  return text
    // Convert **bold** to <strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    // Convert ### headers to styled headers
    .replace(/### (.*?)(?=\n|$)/g, '<h3 class="text-lg font-semibold text-gray-800 mt-4 mb-2 border-b border-gray-200 pb-1">$1</h3>')
    // Convert ## headers to styled headers
    .replace(/## (.*?)(?=\n|$)/g, '<h2 class="text-xl font-bold text-gray-900 mt-6 mb-3 border-b-2 border-gray-300 pb-2">$1</h2>')
    // Convert # headers to styled headers
    .replace(/^# (.*?)(?=\n|$)/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4 border-b-2 border-blue-500 pb-2">$1</h1>')
    // Convert bullet points to styled lists
    .replace(/^- (.*?)(?=\n|$)/gm, '<li class="ml-4 mb-1 text-gray-700">• $1</li>')
    // Convert numbered lists
    .replace(/^(\d+)\. (.*?)(?=\n|$)/gm, '<li class="ml-4 mb-1 text-gray-700"><span class="font-semibold text-blue-600">$1.</span> $2</li>')
    // Convert line breaks
    .replace(/\n\n/g, '</p><p class="mb-3 text-gray-700">')
    .replace(/\n/g, '<br/>')
    // Wrap in paragraph tags
    .replace(/^(.*)$/, '<p class="mb-3 text-gray-700">$1</p>')
    // Clean up empty paragraphs
    .replace(/<p class="mb-3 text-gray-700"><\/p>/g, '')
    // Wrap lists in proper containers
    .replace(/(<li class="ml-4 mb-1 text-gray-700">.*<\/li>)/gs, '<ul class="list-none space-y-1 my-3">$1</ul>')
    // Clean up nested list tags
    .replace(/<\/ul><ul class="list-none space-y-1 my-3">/g, '');
}

const MCPIntegration = ({ 
  check, 
  onAnalysisComplete 
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAgent, setAiAgent] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  // Initialize AI agent
  useEffect(() => {
    const initServices = async () => {
      const agent = new OdooAiAgent();
      setAiAgent(agent);
    };
    
    initServices();
  }, []);

  const analyzeCheck = useCallback(async () => {
    if (!check?.description || !aiAgent) return;
    
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      console.log('🔍 Starting AI analysis for:', check.description);
      
      // Use AI agent to plan and execute the analysis
      const aiResult = await aiAgent.analyzeOdooData({ description: check.description });
      console.log('🧠 AI Analysis Result:', aiResult);
      
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
  }, [check, onAnalysisComplete, aiAgent]);

  if (!check) return null;

  return (
    <div className="space-y-4">
      {/* Run Analysis Button */}
      <button
        onClick={analyzeCheck}
        disabled={isAnalyzing || !check.description}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            <span>Run Analysis</span>
          </>
        )}
      </button>


      {/* AI Analysis Results */}
      {aiAnalysis && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h4 className="text-sm font-medium text-gray-700">AI Analysis Results</h4>
          </div>
          
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
    status: PropTypes.oneOf(['active', 'completed', 'cancelled']).isRequired,
    created_at: PropTypes.string.isRequired,
    updated_at: PropTypes.string.isRequired
  }),
  onAnalysisComplete: PropTypes.func
};

export default MCPIntegration;