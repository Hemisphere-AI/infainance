# LLM Chat Interface Integration

This document describes the LLM chat interface that has been integrated into the Excel Preview App.

## Overview

The app now includes an AI-powered chat interface that can interact with your Excel spreadsheets using OpenAI's GPT-4o model with tool calling capabilities. The AI can read, modify, and analyze your spreadsheet data in real-time.

## Features

### 🤖 AI Assistant
- **Spreadsheet Copilot**: An AI assistant that understands Excel operations
- **Tool Calling**: Uses OpenAI's function calling to interact with spreadsheet data
- **Real-time Updates**: Modifications are immediately reflected in the spreadsheet

### 🛠️ Available Tools
The AI has access to these tools:

1. **find** - Locate cells by content or label
2. **read_cell** - Read individual cell values and formulas
3. **update_cell** - Modify cell values or formulas
4. **recalc** - Trigger formula recalculation
5. **read_sheet** - Read ranges of cells

### 💬 Chat Interface
- **Modern UI**: Clean, responsive chat interface
- **Message History**: Persistent conversation history
- **Loading States**: Visual feedback during AI processing
- **Error Handling**: Graceful error messages and recovery

## Setup Instructions

### 1. Environment Configuration
Create a `.env` file in the project root:
```bash
VITE_OPENAI_KEY=your_openai_api_key_here
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```

## Usage Examples

### Basic Queries
- "What is the total in column B?"
- "Find the interest rate cell"
- "Show me the first 10 rows"

### Scenario Analysis
- "What if my interest rate was twice as high?"
- "How would doubling the values in column A affect the total?"
- "What's the impact of changing cell C2 to 0.10?"

### Data Manipulation
- "Update the interest rate in cell C2 to 0.08"
- "Change the formula in B5 to SUM(B1:B4)"
- "Set cell A1 to 'Updated Data'"

## Technical Architecture

### Components
- **ChatInterface.jsx**: Main chat UI component
- **LLMService.js**: OpenAI integration and tool execution
- **tools.js**: Tool schemas and system prompt
- **a1Helpers.js**: Excel address conversion utilities

### Data Flow
1. User sends message via chat interface
2. Message is processed by LLMService
3. OpenAI GPT-4o analyzes the request
4. AI calls appropriate tools to interact with spreadsheet
5. Results are returned and displayed in chat
6. Spreadsheet is updated in real-time

### Tool Execution
Each tool call follows this pattern:
1. AI determines which tool to use
2. Tool parameters are extracted
3. Tool executes against spreadsheet data
4. Results are returned to AI
5. AI provides final response to user

## System Prompt

The AI is configured with a specific system prompt that enforces:
- Always use tools to interact with data
- Never fabricate spreadsheet contents
- Follow the workflow: find → read → update → recalc → analyze
- Preserve formulas unless explicitly asked to overwrite

## Error Handling

The system includes comprehensive error handling:
- **API Key Issues**: Clear messages about missing or invalid keys
- **Tool Errors**: Graceful handling of tool execution failures
- **Network Issues**: Retry logic and user-friendly error messages
- **Data Validation**: Input validation for all tool parameters

## Security Considerations

⚠️ **Important**: The current implementation uses the OpenAI API key in the browser. For production use, consider:
- Moving API calls to a backend server
- Implementing proper authentication
- Adding rate limiting and usage monitoring

## Testing

Use the built-in test component to verify:
- Tool execution functionality
- OpenAI API connectivity
- Data manipulation capabilities
- Error handling

## Future Enhancements

Potential improvements:
- **Multi-sheet Support**: Extend tools to work across multiple sheets
- **Advanced Formulas**: Support for more complex Excel functions
- **Data Visualization**: AI-powered chart and graph generation
- **Export Capabilities**: AI-assisted data export and formatting
- **Collaboration**: Multi-user chat and real-time collaboration

## Troubleshooting

### Common Issues

1. **"Error: API key not found"**
   - Ensure `.env` file exists with valid `VITE_OPENAI_KEY`
   - Restart the development server after adding the key

2. **"Tool execution error"**
   - Check that spreadsheet data is loaded
   - Verify cell addresses are valid (e.g., "A1", "B2")

3. **"No response generated"**
   - Check internet connectivity
   - Verify OpenAI API key is valid and has credits
   - Check browser console for detailed error messages

### Debug Mode
Enable debug logging by setting `import.meta.env.DEV` to see detailed tool execution logs in the browser console.

## Contributing

When adding new tools or features:
1. Update tool schemas in `tools.js`
2. Implement tool logic in `LLMService.js`
3. Add appropriate error handling
4. Update this documentation
5. Test with various spreadsheet scenarios
