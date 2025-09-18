# Excel Preview App

A beautiful React application built with Tailwind CSS for uploading and previewing Excel files in your browser.

## Features

- 🎨 **Beautiful UI** - Modern design with Tailwind CSS
- 📁 **Drag & Drop Upload** - Easy file upload with drag and drop support
- 📊 **True Excel Preview** - View Excel data with exact cell positioning (A1, B2, etc.)
- ✏️ **In-Place Editing** - Edit cells directly with formula support
- 🧮 **Formula Support** - Create and edit Excel formulas (e.g., =A1+B1)
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 💾 **Export Options** - Download as Excel (.xlsx) or CSV files
- 🔍 **Multi-sheet Support** - Shows all available sheets in the workbook
- ✅ **File Validation** - Supports .xlsx, .xls, and .csv files
- 🎯 **Excel-like Navigation** - Use arrow keys, Tab, or click to navigate
- 📋 **Column/Row Labels** - Shows A, B, C columns and 1, 2, 3 rows

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Usage

1. **Upload a file**: Drag and drop an Excel file onto the upload area or click to browse
2. **Preview data**: View your Excel data with exact cell positioning (A1, B2, etc.)
3. **Edit data**: Click "Edit" to enable editing mode, then click any cell to edit
4. **Use formulas**: Start with = to enter formulas (e.g., =A1+B1, =SUM(A1:A10))
5. **Navigate**: Use arrow keys, Tab, or click to move between cells
6. **Export data**: Download as Excel (.xlsx) or CSV format
7. **Clear data**: Click "Clear" to remove the current file and upload a new one

### Editing Features
- **View Mode**: Browse your data with Excel-like cell positioning
- **Edit Mode**: Click any cell to edit values and formulas
- **Formula Support**: Full Excel formula syntax support
- **Cell Navigation**: Arrow keys, Tab, Enter for navigation
- **Real-time Updates**: Changes are reflected immediately

## Supported File Types

- `.xlsx` - Excel 2007+ format
- `.xls` - Excel 97-2003 format
- `.csv` - Comma-separated values

## Technologies Used

- **React 18** - Frontend framework
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **XLSX** - Excel file parsing library
- **React Spreadsheet** - Advanced spreadsheet component with formula support
- **Lucide React** - Beautiful icons

## Project Structure

```
src/
├── App.jsx          # Main application component
├── main.jsx         # Application entry point
└── index.css        # Global styles and Tailwind imports
```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## License

MIT License
