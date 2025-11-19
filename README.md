# PDF Reader with AI

A modern React-based PDF viewer with text highlighting and AI-powered explanations.

## Features

- 📄 **PDF Rendering**: View PDF documents in your browser using react-pdf
- ✨ **Text Highlighting**: Select and highlight text from PDFs
- 🤖 **AI Explanations**: Get AI-powered explanations of selected text (requires Anthropic API key)
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- 📑 **Page Navigation**: Navigate between pages easily

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Preview Production Build**
   ```bash
   npm run preview
   ```

## AI Feature Setup

The AI explanation feature uses the Anthropic API. To use it:

1. Get an API key from [Anthropic](https://www.anthropic.com/)
2. Add your API key to the API request headers in `src/App.jsx`:
   ```javascript
   headers: {
     'Content-Type': 'application/json',
     'x-api-key': 'your-api-key-here',  // Add this
     'anthropic-version': '2023-06-01'   // Add this
   }
   ```

**Note**: The AI feature will not work without a valid API key. The rest of the app (PDF viewing and highlighting) works without it.

## Technologies Used

- **React** - UI framework
- **Vite** - Build tool and dev server
- **react-pdf** - PDF rendering
- **Tailwind CSS** - Styling
- **lucide-react** - Icons

## Project Structure

```
pdf-viewer/
├── src/
│   ├── App.jsx          # Main React component
│   ├── main.jsx         # React entry point
│   └── index.css        # Tailwind CSS imports
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
└── postcss.config.js    # PostCSS configuration
```

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Notes

- Highlights are stored in memory and will be lost when you reload the page or load a new PDF
- The viewer works best with text-based PDFs
- Large PDF files may take a moment to load
