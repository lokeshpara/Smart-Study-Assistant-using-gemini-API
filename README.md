# Word Explainer - Chrome Extension

Word Explainer is a powerful Chrome extension powered by Google's Gemini AI that helps you understand concepts, summarize web pages, create study materials, and generate interactive learning content.

![Word Explainer Logo](icon128.png)

## Features

The extension provides five main tools:

1. **Explain Word** - Get detailed explanations of any word, concept, or phrase with images and videos
2. **Summarize Page** - Generate concise summaries and key points from any web page
3. **Study Notes** - Create comprehensive study notes from web pages or custom topics
4. **Concept Maps** - Visualize relationships between concepts with downloadable Mermaid diagrams
5. **Quiz** - Generate interactive quizzes based on web content or custom topics

## Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store page](#) for Word Explainer
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension folder
5. The extension is now installed and ready to use

## Setup

### API Key Configuration
1. The extension requires a Google Gemini API key to function.
2. Get your Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Open the `background.js` file in the extension folder
4. Find this line near the top: `const API_KEY = "YOUR-GEMINI-API-KEY";`
5. Replace the existing key with your own Gemini API key
6. Save the file

### Running the Extension
1. After installing the extension and configuring your API key, click on the extension icon in your browser toolbar
2. The extension popup will open, showing the available features
3. If you've just edited the `background.js` file, reload the extension:
   - Go to `chrome://extensions/`
   - Find the Word Explainer extension
   - Click the refresh/reload icon
4. You can now use all the features of the extension as described in the Usage section below

## Usage

### Explain Word
1. Click on the Word Explainer icon in your browser toolbar
2. Make sure you're on the "Explain Word" tab
3. Enter a word, phrase, or concept in the input field
4. Click "Explain" or press Enter
5. The extension will provide:
   - Detailed explanation
   - Keywords and key terms
   - Visual representation (when available)
   - Learning path with prerequisites and related concepts
   - Related images and videos

### Summarize Page
1. Navigate to the web page you want to summarize
2. Click the Word Explainer icon
3. Select the "Summarize Page" tab
4. Click "Summarize Current Page"
5. The extension will generate:
   - A concise summary of the page content
   - Key points extracted from the page
   - Option to download the summary as a text file

### Study Notes
1. Navigate to the web page you want to create notes from (optional)
2. Click the Word Explainer icon and select the "Study Notes" tab
3. You can:
   - Enter a specific topic in the input field
   - Click "Analyze Current Page" to use the current web page content
   - Or do both for more targeted notes
4. Click "Generate Study Notes"
5. The extension will create comprehensive study notes that you can read and download

### Concept Maps
1. Navigate to the web page you want to map (optional)
2. Click the Word Explainer icon and select the "Concept Map" tab
3. You can:
   - Enter a specific topic in the input field
   - Click "Analyze Current Page" to use the current web page content
   - Or do both for more focused concept maps
4. Click "Generate Concept Map"
5. The generated map will be available to download as a text file in Mermaid format
6. You can visualize this diagram by pasting it into a Mermaid renderer like [Mermaid Live Editor](https://mermaid.live/)

### Quiz
1. Navigate to the web page you want to create a quiz from (optional)
2. Click the Word Explainer icon and select the "Quiz" tab
3. You can:
   - Enter a specific topic in the input field
   - Click "Analyze Current Page" to use the current web page content
   - Or do both for more targeted questions
4. Click "Generate Quiz"
5. Answer the multiple-choice or short-answer questions
6. Click "Check Answers" to see your score and the correct answers
7. You can also download the quiz with answers as a text file

## Troubleshooting

### API Key Errors
If you encounter messages like "No response received" or "Please check your API key":
1. The extension might be hitting Google API rate limits
2. Get a new Gemini API key from [Google AI Studio](https://makersuite.google.com/)
3. Open `background.js` in the extension folder
4. Replace the `API_KEY` value with your new key
5. Reload the extension from the extensions page

### Content Cannot Be Accessed
If you see "Cannot access page content" errors:
1. The extension cannot read content from certain restricted pages
2. Try on a different page or use the direct input options

### Concept Map Rendering Issues
If concept maps aren't rendering properly:
1. Use the "Download Map" button to save the diagram text
2. Paste it into an external Mermaid renderer like [Mermaid Live Editor](https://mermaid.live/)
3. If syntax errors appear, use the diagram editor to fix them by:
   - Making sure "graph TD" is on its own line
   - Checking that all nodes have labels in square brackets
   - Ensuring proper arrow syntax with spaces: `-->` 
   - Putting each relationship on its own line

## Privacy

This extension:
- Only processes the content of the current page when explicitly requested
- Sends data to Google's Gemini API for processing
- Does not collect or store your browsing history
- Does not track you across websites

## Technical Details

- Powered by Google's Gemini API
- Uses Mermaid.js for diagram generation
- Built with vanilla JavaScript, HTML, and CSS
- Processes content locally in the browser when possible

## License

[MIT License](LICENSE)

## Acknowledgements

- [Google Gemini AI](https://deepmind.google/technologies/gemini/) for the AI capabilities
- [Mermaid.js](https://mermaid.js.org/) for diagram rendering 