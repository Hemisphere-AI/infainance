# Quick Setup Guide

## 🚀 Getting Started with LLM Chat Interface

### Step 1: Set Your OpenAI API Key

1. Open the `.env` file in your project root
2. Replace `your_openai_api_key_here` with your actual OpenAI API key:
   ```
   VITE_OPENAI_KEY=sk-your-actual-openai-api-key-here
   ```

### Step 2: Restart the Development Server

After updating the `.env` file, restart the development server:
```bash
npm run dev
```

### Step 3: Test the Integration

1. **Upload an Excel file** to the app
2. **Use the test component** (bottom of the right panel) to verify the LLM integration
3. **Start chatting** with the AI assistant

## 🧪 Testing Examples

Try these example queries in the chat:

### Basic Queries
- "What is in cell A1?"
- "Find the interest rate"
- "Show me the first 5 rows"

### Scenario Analysis
- "What if I doubled the value in cell B2?"
- "How would changing the interest rate to 0.10 affect the total?"

### Data Manipulation
- "Update cell C2 to 0.08"
- "Set cell A1 to 'Updated Data'"

## 🔧 Troubleshooting

### White Page / Errors
- ✅ **Fixed**: The `process is not defined` error has been resolved
- ✅ **Fixed**: Environment variables now use Vite format (`VITE_OPENAI_KEY`)

### API Key Issues
- Make sure your `.env` file contains: `VITE_OPENAI_KEY=your_actual_key`
- Restart the development server after changing the `.env` file
- Check that your OpenAI API key is valid and has credits

### Still Having Issues?
1. Check the browser console for error messages
2. Verify your OpenAI API key is correct
3. Make sure you have credits in your OpenAI account
4. Try the test component to isolate the issue

## 📱 Current Status

✅ **Working Features:**
- Excel file upload and display
- Chat interface UI
- LLM service integration
- Tool calling framework
- Real-time spreadsheet updates

🔄 **Ready to Test:**
- OpenAI API integration
- AI-powered spreadsheet analysis
- Scenario modeling ("what if" questions)
- Data manipulation via chat

The app should now load without errors. Upload an Excel file and start chatting with the AI assistant!
