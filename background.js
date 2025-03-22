// Set up context menu
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed, setting up context menu');
  chrome.contextMenus.create({
    id: "explainSelection",
    title: "Explain with Gemini",
    contexts: ["selection"]
  });
});

// Use your Gemini API Key
const API_KEY = "YOUR-GEMINI-API-KEY";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent";
const BASE_URL_VISION = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent";

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked', info.menuItemId);
  if (info.menuItemId === "explainSelection" && info.selectionText) {
    console.log('Explaining selected text:', info.selectionText.substring(0, 20) + '...');
    // Open popup with the selected text
    chrome.tabs.sendMessage(tab.id, { 
      action: 'explainFromContextMenu', 
      text: info.selectionText
    });
  }
});

// Handle messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === "explainText") {
    console.log('Processing explainText request for:', request.text.substring(0, 20) + '...');
    
    // Check if API key is set
    if (API_KEY === "YOUR_GEMINI_API_KEY") {
      console.error('API key not set!');
      sendResponse({ error: "Please set your Gemini API key in background.js" });
      return true;
    }
    
    explainText(request.text)
      .then(response => {
        console.log('Explanation response received');
        sendResponse(response);
      })
      .catch(error => {
        console.error('Explanation error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates async response
  } else if (request.action === "summarizePage") {
    console.log('Processing summarizePage request');
    
    // Check if API key is set
    if (API_KEY === "YOUR_GEMINI_API_KEY") {
      console.error('API key not set!');
      sendResponse({ error: "Please set your Gemini API key in background.js" });
      return true;
    }
    
    summarizePage(request.content, request.title)
      .then(response => {
        console.log('Summary response received');
        sendResponse(response);
      })
      .catch(error => {
        console.error('Summary error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates async response
  } else if (request.action === "openPopup") {
    // Handle opening the popup with pre-filled text
    console.log('Opening popup');
    chrome.action.openPopup();
    return true;
  } else if (request.action === "contentScriptReady") {
    console.log('Content script is ready');
    return true;
  } else if (request.action === "generateStudyNotes") {
    generateStudyNotes(request.pageContent, request.userPrompt, request.title)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  } else if (request.action === "generateConceptMap") {
    generateConceptMap(request.pageContent, request.userPrompt, request.title)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  } else if (request.action === "generateQuiz") {
    generateQuiz(request.pageContent, request.userPrompt, request.title)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

async function explainText(text) {
  try {
    console.log('Calling Gemini API for explanation');
    // Send request to the Gemini API
    const data = {
      contents: [
        {
          parts: [
            {
              text: `I want you to explain the following word or sentence in a clear and concise way. 
              If it's a word, provide its definition, common usages, and examples. 
              If it's a phrase or sentence, explain its meaning, context, and significance.
              
              Format your response as a JSON object with the following structure:
              {
                "explanation": "The detailed explanation with important concepts clearly explained",
                "keywords": ["keyword1", "keyword2", "keyword3"],
                "visualRepresentation": "Description of a visual representation that would help understand this concept",
                "images": ["url1", "url2", "url3"],
                "videos": [{"title": "Video Title", "embedUrl": "YouTube embed URL"}],
                "learningPath": {
                  "prerequisites": [
                    {"concept": "Prerequisite Concept 1", "description": "Brief description of why this is needed"},
                    {"concept": "Prerequisite Concept 2", "description": "Brief description of why this is needed"}
                  ],
                  "nextSteps": [
                    {"concept": "Advanced Concept 1", "description": "What to learn next and why"},
                    {"concept": "Advanced Concept 2", "description": "What to learn next and why"}
                  ],
                  "relatedConcepts": [
                    {"concept": "Related Concept 1", "description": "How this relates to the main concept"},
                    {"concept": "Related Concept 2", "description": "How this relates to the main concept"}
                  ]
                }
              }
              
              Important notes:
              - For keywords: Just list the important terms as strings in an array, no explanation needed
              - For images: Just include direct image URLs, no additional description
              - For the learning path: Identify 2-4 prerequisite concepts needed to understand this concept, 2-3 advanced concepts to learn next, and 2-3 related concepts
              - Keep the explanation clear and concise
              
              Return ONLY this JSON object with no additional text before or after. The JSON must be valid and parseable.
              
              Text to explain: ${text}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      }
    };

    const response = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API response error:', errorData);
      throw new Error(errorData.error?.message || "Error calling Gemini API");
    }

    const result = await response.json();
    console.log('API response structure:', JSON.stringify(result, null, 2));
    
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error("No response candidates from Gemini API");
    }

    if (!result.candidates[0] || !result.candidates[0].content) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    if (!result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
      throw new Error("No content parts in Gemini API response");
    }
    
    if (!result.candidates[0].content.parts[0] || !result.candidates[0].content.parts[0].text) {
      throw new Error("No text in Gemini API response");
    }

    const responseText = result.candidates[0].content.parts[0].text;
    console.log('Received text response from API');

    // Try to parse the response as JSON
    try {
      // Find JSON in the response (in case there's any surrounding text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON object found in response');
        // Fall back to the original parsing method
        return parseGeminiResponse(responseText);
      }
      
      const jsonResponse = JSON.parse(jsonMatch[0]);
      console.log('Successfully parsed JSON response', jsonResponse);
      
      // Ensure the parsed object has the required fields
      return {
        explanation: jsonResponse.explanation || 'No explanation provided',
        keywords: jsonResponse.keywords || [],
        images: jsonResponse.images || [],
        videos: jsonResponse.videos || [],
        visualRepresentation: jsonResponse.visualRepresentation || '',
        learningPath: jsonResponse.learningPath || {
          prerequisites: [],
          nextSteps: [],
          relatedConcepts: []
        }
      };
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      console.log('Falling back to text parsing');
      // Fall back to the original parsing method
      return parseGeminiResponse(responseText);
    }
  } catch (error) {
    console.error("Error in explainText:", error);
    throw error;
  }
}

async function summarizePage(content, title) {
  try {
    console.log('Calling Gemini API for summarization');
    // Prepare content - summarize if too long
    let processedContent = content.content || content;
    const contentLength = processedContent.length;
    
    // If content is too long, trim it to avoid token limits
    if (contentLength > 10000) {
      console.log('Content too long, trimming to 10000 characters');
      processedContent = processedContent.substring(0, 10000) + "...";
    }

    // Create the prompt for summarization
    const data = {
      contents: [
        {
          parts: [
            {
              text: `I want you to summarize the following webpage content in a clear and concise way. 
              The webpage title is: "${title}"
              
              Format your response as a JSON object with the following structure:
              {
                "summary": "A concise summary of the main content (around 2-3 paragraphs). Important terms should be marked with asterisks like *this term* and briefly explained inline.",
                "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
              }
              
              Important notes:
              - In the summary, when you encounter important terms or concepts, mark them with *asterisks* and briefly explain them inline.
              - Extract 3-5 key points that summarize the main ideas.
              - The JSON must be valid and parseable.
              
              Webpage content: ${processedContent}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
      }
    };

    const response = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API response error:', errorData);
      throw new Error(errorData.error?.message || "Error calling Gemini API");
    }

    const result = await response.json();
    console.log('API response structure:', JSON.stringify(result, null, 2));
    
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error("No response candidates from Gemini API");
    }

    if (!result.candidates[0] || !result.candidates[0].content) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    if (!result.candidates[0].content.parts || result.candidates[0].content.parts.length === 0) {
      throw new Error("No content parts in Gemini API response");
    }
    
    if (!result.candidates[0].content.parts[0] || !result.candidates[0].content.parts[0].text) {
      throw new Error("No text in Gemini API response");
    }

    const responseText = result.candidates[0].content.parts[0].text;
    console.log('Received summary response from API, parsing...');

    // Try to parse as JSON first
    try {
      // Find JSON in the response (in case there's any surrounding text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonResponse = JSON.parse(jsonMatch[0]);
        console.log('Successfully parsed JSON summary response', jsonResponse);
        
        // Return the parsed JSON response
        return {
          summary: jsonResponse.summary || 'No summary available',
          keyPoints: jsonResponse.keyPoints || []
        };
      }
    } catch (error) {
      console.error('Error parsing JSON summary:', error);
      console.log('Falling back to text parsing');
    }

    // Fall back to the original parsing method if JSON parsing fails
    return parseSummarizationResponse(responseText);
  } catch (error) {
    console.error("Error in summarizePage:", error);
    throw error;
  }
}

function parseGeminiResponse(text) {
  let explanation = '';
  let images = [];
  let videos = [];
  let keyTerms = [];
  let visualRepresentation = '';
  
  // Extract explanation (everything until we hit a section header)
  const sections = text.split(/(?=\n[A-Z][a-zA-Z\s]+:)/);
  if (sections.length > 0) {
    explanation = sections[0].trim();
  }

  // Process each section
  for (const section of sections) {
    if (section.match(/\bVisual Representation:?\b/i)) {
      visualRepresentation = section.replace(/\bVisual Representation:?\b/i, '').trim();
    }
    else if (section.match(/\bKey Terms:?\b/i)) {
      const termContent = section.replace(/\bKey Terms:?\b/i, '').trim();
      const termItems = termContent.split(/\n\s*\n/);
      
      for (const item of termItems) {
        const lines = item.split('\n');
        if (lines.length >= 2) {
          const term = lines[0].replace(/^[*-]\s*/, '').trim();
          const definition = lines.slice(1).join(' ').replace(/^[*-]\s*/, '').trim();
          if (term && definition) {
            keyTerms.push({ term, definition });
          }
        }
      }
    }
    else if (section.match(/\bImages?:?\b/i)) {
      const imageContent = section.replace(/\bImages?:?\b/i, '').trim();
      
      // Enhanced image URL extraction
      // First, try to find markdown-style image links
      let markdownImages = imageContent.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi);
      let plainUrls = imageContent.match(/https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp)/gi);
      let urlsInBrackets = imageContent.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/gi);
      
      let extractedUrls = [];
      
      // Extract URLs from markdown format
      if (markdownImages) {
        markdownImages.forEach(md => {
          const urlMatch = md.match(/\((https?:\/\/[^\s)]+)\)/i);
          if (urlMatch && urlMatch[1]) {
            extractedUrls.push(urlMatch[1]);
          }
        });
      }
      
      // Add plain URLs
      if (plainUrls) {
        extractedUrls = extractedUrls.concat(plainUrls);
      }
      
      // Extract URLs from bracket format
      if (urlsInBrackets) {
        urlsInBrackets.forEach(bracket => {
          const urlMatch = bracket.match(/\((https?:\/\/[^\s)]+)\)/i);
          if (urlMatch && urlMatch[1]) {
            extractedUrls.push(urlMatch[1]);
          }
        });
      }
      
      // Clean and filter URLs
      if (extractedUrls.length > 0) {
        // Remove any trailing punctuation or parentheses
        extractedUrls = extractedUrls.map(url => 
          url.replace(/[,.;:!?]$/, '')
             .replace(/\)$/, '')
        );
        
        // Ensure URLs are valid and accessible
        extractedUrls = extractedUrls.filter(url => {
          try {
            new URL(url); // Validate URL format
            return true;
          } catch (e) {
            console.error('Invalid URL:', url);
            return false;
          }
        });
        
        // Remove duplicates
        extractedUrls = [...new Set(extractedUrls)];
        
        // Limit to 3 images
        images = extractedUrls.slice(0, 3);
        
        console.log('Extracted image URLs:', images);
      }
    }
    else if (section.match(/\bVideos?:?\b/i)) {
      const videoContent = section.replace(/\bVideos?:?\b/i, '').trim();
      
      // Extract YouTube video information
      const titleMatch = videoContent.match(/Title:?\s*(.*?)(?:\n|$)/i);
      const urlMatch = videoContent.match(/(?:URL|Link|Embed):?\s*(https?:\/\/[^\s)]+)/i);
      
      if (urlMatch) {
        let videoUrl = urlMatch[1];
        
        // Convert standard YouTube URL to embed URL if needed
        if (videoUrl.includes('youtube.com/watch')) {
          const videoId = videoUrl.match(/(?:v=)([^&]+)/);
          if (videoId) {
            videoUrl = `https://www.youtube.com/embed/${videoId[1]}`;
          }
        } else if (videoUrl.includes('youtu.be')) {
          const videoId = videoUrl.split('/').pop().split('?')[0];
          videoUrl = `https://www.youtube.com/embed/${videoId}`;
        }
        
        videos.push({
          title: titleMatch ? titleMatch[1] : 'Related Video',
          embedUrl: videoUrl
        });
      }
    }
  }

  return {
    explanation,
    images,
    videos,
    keyTerms,
    visualRepresentation
  };
}

function parseSummarizationResponse(text) {
  let summary = '';
  let keyPoints = [];
  
  // Extract summary (first part before any 'Key Points' section)
  const keyPointsSectionIndex = text.indexOf('Key Points');
  
  if (keyPointsSectionIndex > -1) {
    summary = text.substring(0, keyPointsSectionIndex).trim();
    
    // Extract key points
    const keyPointsSection = text.substring(keyPointsSectionIndex);
    const pointMatches = keyPointsSection.match(/(\d+\.|\*|-).*?(?=(\d+\.|\*|-|$))/g);
    
    if (pointMatches && pointMatches.length > 0) {
      keyPoints = pointMatches.map(point => 
        point.replace(/^(\d+\.|\*|-)\s*/, '').trim()
      ).filter(point => point.length > 0);
    }
  } else {
    // If no key points section, just use the whole text as summary
    summary = text.trim();
    
    // Try to extract points if they're formatted as numbered list without a header
    const pointMatches = text.match(/(\d+\.|\*|-)\s.*?(?=(\d+\.|\*|-)|$)/g);
    if (pointMatches && pointMatches.length > 0) {
      keyPoints = pointMatches.map(point => 
        point.replace(/^(\d+\.|\*|-)\s*/, '').trim()
      ).filter(point => point.length > 0);
      
      // Remove the points from the summary if they were extracted
      if (keyPoints.length > 0) {
        const pointsText = pointMatches.join('');
        summary = text.replace(pointsText, '').trim();
      }
    }
  }
  
  return {
    summary,
    keyPoints
  };
}

// Handle study notes generation
async function generateStudyNotes(pageContent, userPrompt, title) {
  try {
    console.log('Calling Gemini API for study notes generation');
    const data = {
      contents: [
        {
          parts: [
            {
              text: `Generate detailed study notes for the following content. ${userPrompt ? 'Focus on: ' + userPrompt : ''}
              
Content: ${pageContent || 'No page content available. Using user prompt only.'}

Please provide well-structured study notes with:
1. Main concepts and definitions
2. Key points and explanations
3. Examples where relevant
4. Important relationships between concepts
5. Summary of main takeaways`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000
      }
    };

    const response = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API response error:', errorData);
      throw new Error(errorData.error?.message || "Error calling Gemini API");
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const responseText = result.candidates[0].content.parts[0].text;
    
    return {
      notes: responseText,
      title: title
    };
  } catch (error) {
    console.error('Error generating study notes:', error);
    return { error: 'Failed to generate study notes: ' + error.message };
  }
}

// Handle concept map generation
async function generateConceptMap(pageContent, userPrompt, title) {
  try {
    console.log('Calling Gemini API for concept map generation');
    
    // Set up prompt based on what inputs we have
    let promptText = '';
    if (userPrompt && pageContent) {
      promptText = `Create a concept map in Mermaid.js graph format for the following content. Focus on: ${userPrompt}
      
Content: ${pageContent}`;
    } else if (userPrompt && !pageContent) {
      promptText = `Create a concept map in Mermaid.js graph format about: ${userPrompt}
      
Please focus on the main concepts, relationships, and hierarchy.`;
    } else if (!userPrompt && pageContent) {
      promptText = `Create a concept map in Mermaid.js graph format for the following content:
      
Content: ${pageContent}`;
    }
    
    promptText += `

Please provide a Mermaid.js graph diagram that shows the main concepts and their relationships.

VERY IMPORTANT FORMATTING INSTRUCTIONS FOR MERMAID 10.6.1:
1. Start with 'graph TD' (top-down layout)
2. Use proper Mermaid.js syntax with nodes defined as: A[Concept Name]
3. EVERY node must have a label in square brackets like A[Label] - nodes without labels will cause errors
4. Use arrows to show relationships: A[Concept] --> B[Related Concept]
5. Add descriptive text on relationships: A[Concept] -->|describes relation| B[Related Concept]
6. Do not include any explanation text before or after the diagram
7. Don't use quotation marks or special characters in node IDs
8. Return ONLY the Mermaid.js diagram with no other text
9. Ensure all nodes referenced in relationships are defined with labels

Example of CORRECT format:
graph TD
  A[Main Concept] --> B[Related Concept 1]
  A[Main Concept] --> C[Related Concept 2]
  B[Related Concept 1] -->|influences| D[Subconcept]`;
    
    const data = {
      contents: [
        {
          parts: [
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1, // Lower temperature for more predictable formatting
        maxOutputTokens: 1000
      }
    };

    const response = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API response error:', errorData);
      throw new Error(errorData.error?.message || "Error calling Gemini API");
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const responseText = result.candidates[0].content.parts[0].text;
    console.log('Raw response for concept map:', responseText);
    
    // Extract the Mermaid diagram
    let mermaidDiagram = responseText;
    
    // Try several extraction patterns
    const extractionPatterns = [
      // Pattern for code blocks
      /```mermaid\n([\s\S]*?)\n```/,
      // Pattern for generic code blocks
      /```([\s\S]*?)```/,
      // Pattern for graph TD without code blocks
      /(graph TD[\s\S]*)/,
      // Pattern for graph LR without code blocks
      /(graph LR[\s\S]*)/
    ];
    
    for (const pattern of extractionPatterns) {
      const match = responseText.match(pattern);
      if (match && match[1]) {
        mermaidDiagram = match[1].trim();
        console.log('Extracted diagram using pattern:', pattern);
        break;
      }
    }
    
    // Validate and fix common issues with the diagram
    if (!mermaidDiagram.trim().startsWith('graph')) {
      mermaidDiagram = 'graph TD\n' + mermaidDiagram;
      console.log('Added graph TD prefix to diagram');
    }
    
    // Make sure there's a proper line break after graph TD
    mermaidDiagram = mermaidDiagram.replace(/^(graph\s+TD|graph\s+LR)(.+)/m, '$1\n$2');
    
    // Fix any reference to nodes without brackets (common Mermaid 10.6.1 error)
    const nodeIdsWithoutLabels = new Set();
    
    // First pass: Find all node IDs without labels
    const nodeRefRegex = /\b([A-Za-z0-9]+)(\s*-->)/g;
    let match;
    while ((match = nodeRefRegex.exec(mermaidDiagram)) !== null) {
      const nodeId = match[1];
      // Check if this nodeId has a definition with brackets elsewhere
      const hasDefinition = new RegExp(`\\b${nodeId}\\s*\\[.+?\\]`).test(mermaidDiagram);
      if (!hasDefinition) {
        nodeIdsWithoutLabels.add(nodeId);
      }
    }
    
    // Second pass: Find node IDs at the end of arrows
    const endNodeRefRegex = /-->\s*([A-Za-z0-9]+)(?!\s*\[)/g;
    while ((match = endNodeRefRegex.exec(mermaidDiagram)) !== null) {
      const nodeId = match[1];
      const hasDefinition = new RegExp(`\\b${nodeId}\\s*\\[.+?\\]`).test(mermaidDiagram);
      if (!hasDefinition) {
        nodeIdsWithoutLabels.add(nodeId);
      }
    }
    
    // Apply fixes for common syntax errors
    let fixedDiagram = mermaidDiagram;
    
    // Add brackets to nodes without labels
    nodeIdsWithoutLabels.forEach(nodeId => {
      const replaceStartRegex = new RegExp(`\\b${nodeId}(\\s*-->)`, 'g');
      const replaceEndRegex = new RegExp(`-->(\\s*)${nodeId}\\b(?!\\s*\\[)`, 'g');
      
      // Fix start of arrow
      fixedDiagram = fixedDiagram.replace(replaceStartRegex, `${nodeId}[${nodeId}]$1`);
      
      // Fix end of arrow
      fixedDiagram = fixedDiagram.replace(replaceEndRegex, `-->$1${nodeId}[${nodeId}]`);
    });
    
    // Fix common errors with spacing and arrows
    fixedDiagram = fixedDiagram
      // Fix arrows with invalid syntax
      .replace(/-->/g, ' --> ')
      // Fix any uneven spacing
      .replace(/\s{2,}/g, ' ')
      // Ensure proper line breaks
      .split('\n').map(line => line.trim()).join('\n');
    
    console.log('Fixed diagram:', fixedDiagram);
    
    return {
      diagram: fixedDiagram,
      title: title
    };
  } catch (error) {
    console.error('Error generating concept map:', error);
    return { error: 'Failed to generate concept map: ' + error.message };
  }
}

// Handle quiz generation
async function generateQuiz(pageContent, userPrompt, title) {
  try {
    console.log('Calling Gemini API for quiz generation');
    
    // Set up prompt based on what inputs we have
    let promptText = '';
    if (userPrompt && pageContent) {
      promptText = `Generate a quiz with 8 questions based on the following content. Focus on: ${userPrompt}
      
Content: ${pageContent}`;
    } else if (userPrompt && !pageContent) {
      promptText = `Generate a quiz with 8 questions about: ${userPrompt}`;
    } else if (!userPrompt && pageContent) {
      promptText = `Generate a quiz with 8 questions based on the following content:
      
Content: ${pageContent}`;
    }
    
    promptText += `

Please provide a mix of:
1. Multiple choice questions (at least 5)
2. True/False questions (at least 1)
3. Short answer questions (at least 2)

Format each question as a JSON object with:
- question: the question text
- type: "multiple-choice" or "short-answer"
- options: array of options (for multiple choice)
- answer: correct answer (string) or array index (number) for multiple choice

Return the questions as a JSON array wrapped in triple backticks like this:
\`\`\`json
[
  {
    "question": "Question text here?",
    "type": "multiple-choice",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": 2
  },
  {
    "question": "Short answer question here?",
    "type": "short-answer",
    "answer": "Correct answer here"
  }
]
\`\`\`

IMPORTANT: Make sure the JSON is well-formed and that the "answer" field for multiple-choice questions is the INDEX of the correct option (0-based).`;
    
    const data = {
      contents: [
        {
          parts: [
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500
      }
    };

    const response = await fetch(`${BASE_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API response error:', errorData);
      throw new Error(errorData.error?.message || "Error calling Gemini API");
    }

    const result = await response.json();
    
    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
      throw new Error("Invalid response structure from Gemini API");
    }
    
    const responseText = result.candidates[0].content.parts[0].text;
    console.log('Raw response for quiz:', responseText);
    
    // Try to extract the JSON array from the response
    try {
      // Try different parsing approaches
      let questions;
      
      // First try to find JSON in code blocks
      const backtickMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (backtickMatch) {
        try {
          questions = JSON.parse(backtickMatch[1]);
          console.log('Extracted questions from code block');
        } catch (e) {
          console.error('Failed to parse questions from code block:', e);
        }
      }
      
      // If code block parsing failed, try to find a JSON array in the text
      if (!questions) {
        const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          try {
            questions = JSON.parse(arrayMatch[0]);
            console.log('Extracted questions from array match');
          } catch (e) {
            console.error('Failed to parse questions from array match:', e);
          }
        }
      }
      
      // If all parsing attempts failed, try parsing the entire response
      if (!questions) {
        try {
          questions = JSON.parse(responseText);
          console.log('Parsed entire response as JSON');
        } catch (e) {
          console.error('Failed to parse entire response:', e);
        }
      }
      
      // If we still don't have questions, create a fallback
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        console.warn('Could not parse questions, using fallback questions');
        questions = [
          {
            question: "Failed to generate questions from the provided content. This is a sample question.",
            type: "multiple-choice",
            options: ["Option A", "Option B", "Option C", "Option D"],
            answer: 0
          },
          {
            question: "Please try again with different content or prompt. This is a sample short answer question.",
            type: "short-answer",
            answer: "Sample answer"
          }
        ];
      }
      
      return {
        questions,
        title: title
      };
    } catch (error) {
      console.error("Error parsing quiz questions:", error);
      return { 
        error: "Failed to parse quiz questions from API response. Try again with a different prompt or content."
      };
    }
  } catch (error) {
    console.error('Error generating quiz:', error);
    return { error: 'Failed to generate quiz: ' + error.message };
  }
} 