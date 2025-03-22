document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup initialized');
  
  // Helper function to safely add event listeners
  function addButtonListener(id, callback) {
    const button = document.getElementById(id);
    if (button) {
      button.addEventListener('click', callback);
      console.log(`Added event listener to ${id}`);
    } else {
      console.error(`Button with ID ${id} not found`);
    }
  }
  
  // Check if Mermaid.js is loaded
  if (typeof mermaid !== 'undefined') {
    console.log('Mermaid.js loaded successfully');
  } else {
    console.error('Mermaid.js not loaded');
  }
  
  // Tab Navigation Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Word Explanation Elements
  const textInput = document.getElementById('text-input');
  const explainBtn = document.getElementById('explain-btn');
  const loader = document.getElementById('loader');
  const resultContainer = document.getElementById('results-container');
  const textExplanation = document.getElementById('text-explanation');
  const imageContainer = document.getElementById('image-explanation');
  const videoContainer = document.getElementById('video-container');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');

  // Page Summarize Elements
  const summarizeBtn = document.getElementById('summarize-btn');
  const summarizeLoader = document.getElementById('summary-loader');
  const summarizeResult = document.getElementById('summary-container');
  const pageSummary = document.getElementById('page-summary');
  const keyPoints = document.getElementById('key-points');
  const summarizeError = document.getElementById('summary-error');
  const summarizeErrorMessage = document.getElementById('summary-error-message');

  // Check if UI elements exist
  console.log('UI elements loaded:', {
    tabButtons: tabButtons.length,
    explainBtn: !!explainBtn,
    summarizeBtn: !!summarizeBtn,
    checkAnswersBtn: !!document.getElementById('check-answers-btn')
  });

  // Setup download buttons
  setupDownloadButtons();

  // Setup check answers functionality
  addButtonListener('check-answers-btn', checkQuizAnswers);

  // Add event listeners for the main buttons
  addButtonListener('explain-btn', explainTextHandler);
  addButtonListener('summarize-btn', summarizePageHandler);
  addButtonListener('generate-notes-btn', generateStudyNotes);
  addButtonListener('generate-map-btn', generateConceptMap);
  addButtonListener('generate-quiz-btn', generateQuiz);
  
  // Add event listeners for the analyze page buttons
  addButtonListener('analyze-page-btn', analyzeCurrentPage);
  addButtonListener('analyze-page-for-map-btn', analyzePageForMap);
  addButtonListener('analyze-page-for-quiz-btn', analyzePageForQuiz);

  // Check for text selected via context menu
  chrome.storage.local.get(['selectedText'], (result) => {
    if (result.selectedText) {
      console.log('Found selected text:', result.selectedText);
      // Pre-fill the input with the selected text
      if (textInput) {
        textInput.value = result.selectedText;
        
        // Auto-explain the text
        if (explainBtn) {
          explainBtn.click();
        }
      }
      
      // Clear the storage
      chrome.storage.local.remove('selectedText');
    }
  });

  // Initialize tab functionality
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log('Tab clicked:', button.getAttribute('data-tab'));
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show the corresponding tab content
      const tabId = button.getAttribute('data-tab');
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabId}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });

  // Handler function for explain button
  function explainTextHandler() {
    console.log('Explain button clicked');
    const text = textInput.value.trim();

    if (!text) {
      showError('Please enter a word or sentence to explain');
      return;
    }

    // Show loader
    loader.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    errorContainer.classList.add('hidden');

    // Send message to background script
    chrome.runtime.sendMessage(
      { 
        action: 'explainText', 
        text: text
      },
      (response) => {
        loader.classList.add('hidden');
        
        if (!response) {
          showError('No response received. Please check your API key and try again.');
          return;
        }
        
        if (response.error) {
          showError(response.error);
          return;
        }

        displayResults(response);
      }
    );
  }

  // Handler function for summarize button
  function summarizePageHandler() {
    console.log('Summarize button clicked');
    // Show loader
    summarizeLoader.classList.remove('hidden');
    summarizeResult.classList.add('hidden');
    summarizeError.classList.add('hidden');

    // Query the active tab to get page content
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs || tabs.length === 0) {
        showSummarizeError('Could not access the current tab.');
        return;
      }

      const activeTab = tabs[0];
      const pageTitle = activeTab.title || 'Current page';
      console.log('Active tab:', activeTab.id, pageTitle);

      // Direct approach for getting page content
      try {
        // Send a message to the content script to get the page content
        chrome.tabs.sendMessage(activeTab.id, { action: 'getPageContent' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message to content script:', chrome.runtime.lastError);
            // Try injecting the content script
            chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                showSummarizeError('Could not access page content. Make sure you\'re not on a restricted page.');
                return;
              }
              
              // Try again after injecting
              setTimeout(() => {
                chrome.tabs.sendMessage(activeTab.id, { action: 'getPageContent' }, handleContentResponse);
              }, 200);
            });
            return;
          }
          
          handleContentResponse(response);
        });
      } catch (error) {
        console.error('Error in summarize flow:', error);
        showSummarizeError('Error: ' + error.message);
      }
      
      function handleContentResponse(response) {
        if (!response) {
          showSummarizeError('Could not extract page content.');
          return;
        }
        
        if (response.error) {
          showSummarizeError('Error: ' + response.error);
          return;
        }

        console.log('Page content received, sending for summarization');
        // Send to background script for summarization
        chrome.runtime.sendMessage(
          {
            action: 'summarizePage',
            content: response.content,
            title: pageTitle
          },
          (response) => {
            summarizeLoader.classList.add('hidden');
            
            if (!response) {
              showSummarizeError('No response received. Please check your API key.');
              return;
            }
            
            if (response.error) {
              showSummarizeError(response.error);
              return;
            }

            displaySummary(response);
          }
        );
      }
    });
  }

  // Function to display the explanation results
  function displayResults(data) {
    if (!data) {
      showError('No results received');
      return;
    }

    // Get the current text input value for the main concept in learning path
    const currentQuery = textInput.value.trim();
    
    // Display text explanation (now without highlighted keywords since they're separate)
    let processedText = data.explanation || 'No explanation available';
    textExplanation.innerHTML = processedText.replace(/\n/g, '<br>');
    
    // Add Keywords section if available
    if (data.keywords && data.keywords.length > 0) {
      const keywordsSection = document.createElement('div');
      keywordsSection.className = 'keywords-section';
      
      const keywordsTitle = document.createElement('h2');
      keywordsTitle.textContent = 'Keywords';
      keywordsTitle.className = 'section-title';
      
      const keywordsList = document.createElement('div');
      keywordsList.className = 'keywords-list';
      
      data.keywords.forEach(keyword => {
        const keywordSpan = document.createElement('span');
        keywordSpan.textContent = keyword;
        keywordSpan.className = 'keyword-chip';
        keywordsList.appendChild(keywordSpan);
      });
      
      keywordsSection.appendChild(keywordsTitle);
      keywordsSection.appendChild(keywordsList);
      
      // Insert after the explanation section
      textExplanation.parentNode.insertBefore(keywordsSection, textExplanation.nextSibling);
    }
    
    // Handle legacy keyTerms if present (for backward compatibility)
    if (data.keyTerms && data.keyTerms.length > 0) {
      const keyTermsSection = document.createElement('div');
      keyTermsSection.className = 'key-terms-section';
      
      const keyTermsTitle = document.createElement('h2');
      keyTermsTitle.textContent = 'Key Terms';
      keyTermsTitle.className = 'section-title';
      
      const keyTermsList = document.createElement('div');
      keyTermsList.className = 'key-terms-list';
      
      data.keyTerms.forEach(item => {
        const termItem = document.createElement('div');
        termItem.className = 'key-term';
        
        const termName = document.createElement('h3');
        termName.textContent = item.term;
        termName.className = 'term-name';
        
        const termDefinition = document.createElement('p');
        termDefinition.textContent = item.definition;
        termDefinition.className = 'term-definition';
        
        termItem.appendChild(termName);
        termItem.appendChild(termDefinition);
        keyTermsList.appendChild(termItem);
      });
      
      keyTermsSection.appendChild(keyTermsTitle);
      keyTermsSection.appendChild(keyTermsList);
      
      // Insert after the explanation section
      textExplanation.parentNode.insertBefore(keyTermsSection, textExplanation.nextSibling);
    }
    
    // Add Visual Representation section if available
    if (data.visualRepresentation) {
      const visualSection = document.createElement('div');
      visualSection.className = 'visual-section';
      
      const visualTitle = document.createElement('h2');
      visualTitle.textContent = 'Visual Representation';
      visualTitle.className = 'section-title';
      
      const visualContent = document.createElement('div');
      visualContent.className = 'visual-content';
      visualContent.textContent = data.visualRepresentation;
      
      visualSection.appendChild(visualTitle);
      visualSection.appendChild(visualContent);
      
      // Insert before the Images section
      document.querySelector('h2:nth-of-type(2)').parentNode.insertBefore(
        visualSection, 
        document.querySelector('h2:nth-of-type(2)')
      );
    }
    
    // Add Learning Path section if available
    if (data.learningPath && 
        (data.learningPath.prerequisites?.length > 0 || 
         data.learningPath.nextSteps?.length > 0 || 
         data.learningPath.relatedConcepts?.length > 0)) {
      
      const learningPathSection = document.createElement('div');
      learningPathSection.className = 'learning-path-section';
      
      const learningPathTitle = document.createElement('h2');
      learningPathTitle.textContent = 'Learning Path';
      learningPathTitle.className = 'section-title';
      
      learningPathSection.appendChild(learningPathTitle);

      // Create the learning path visualization
      const learningPathViz = document.createElement('div');
      learningPathViz.className = 'learning-path-visualization';
      
      // Prerequisites section
      if (data.learningPath.prerequisites && data.learningPath.prerequisites.length > 0) {
        const prerequisitesSection = document.createElement('div');
        prerequisitesSection.className = 'learning-path-group prerequisites';
        
        const prerequisitesTitle = document.createElement('h3');
        prerequisitesTitle.textContent = 'Prerequisites';
        prerequisitesTitle.className = 'learning-path-group-title';
        prerequisitesSection.appendChild(prerequisitesTitle);
        
        const prerequisitesList = document.createElement('div');
        prerequisitesList.className = 'learning-path-items';
        
        data.learningPath.prerequisites.forEach(item => {
          const itemElement = createLearningPathItem(item.concept, item.description);
          prerequisitesList.appendChild(itemElement);
        });
        
        prerequisitesSection.appendChild(prerequisitesList);
        learningPathViz.appendChild(prerequisitesSection);
      }
      
      // Main concept (current term being explained)
      const mainConceptSection = document.createElement('div');
      mainConceptSection.className = 'learning-path-group main-concept';
      
      const mainConceptItem = document.createElement('div');
      mainConceptItem.className = 'learning-path-item main';
      mainConceptItem.innerHTML = `<div class="concept-name">${currentQuery}</div>`;
      
      mainConceptSection.appendChild(mainConceptItem);
      learningPathViz.appendChild(mainConceptSection);
      
      // Next Steps section
      if (data.learningPath.nextSteps && data.learningPath.nextSteps.length > 0) {
        const nextStepsSection = document.createElement('div');
        nextStepsSection.className = 'learning-path-group next-steps';
        
        const nextStepsTitle = document.createElement('h3');
        nextStepsTitle.textContent = 'Next Steps';
        nextStepsTitle.className = 'learning-path-group-title';
        nextStepsSection.appendChild(nextStepsTitle);
        
        const nextStepsList = document.createElement('div');
        nextStepsList.className = 'learning-path-items';
        
        data.learningPath.nextSteps.forEach(item => {
          const itemElement = createLearningPathItem(item.concept, item.description);
          nextStepsList.appendChild(itemElement);
        });
        
        nextStepsSection.appendChild(nextStepsList);
        learningPathViz.appendChild(nextStepsSection);
      }
      
      // Related Concepts section
      if (data.learningPath.relatedConcepts && data.learningPath.relatedConcepts.length > 0) {
        const relatedSection = document.createElement('div');
        relatedSection.className = 'learning-path-group related-concepts';
        
        const relatedTitle = document.createElement('h3');
        relatedTitle.textContent = 'Related Concepts';
        relatedTitle.className = 'learning-path-group-title';
        relatedSection.appendChild(relatedTitle);
        
        const relatedList = document.createElement('div');
        relatedList.className = 'learning-path-items';
        
        data.learningPath.relatedConcepts.forEach(item => {
          const itemElement = createLearningPathItem(item.concept, item.description);
          relatedList.appendChild(itemElement);
        });
        
        relatedSection.appendChild(relatedList);
        learningPathViz.appendChild(relatedSection);
      }
      
      learningPathSection.appendChild(learningPathViz);
      
      // Insert after the Visual Representation section or after the explanation if no visual representation
      const targetElement = document.querySelector('.visual-section') || 
                            document.querySelector('#text-explanation');
      
      if (targetElement && targetElement.nextSibling) {
        targetElement.parentNode.insertBefore(learningPathSection, targetElement.nextSibling);
      } else if (targetElement) {
        targetElement.parentNode.appendChild(learningPathSection);
      }
    }
    
    // Display images with better error handling
    imageContainer.innerHTML = '';
    if (data.images && data.images.length > 0) {
      console.log('Displaying images:', data.images);
      let loadedImages = 0;
      let failedImages = 0;
      
      data.images.forEach((imageUrl, index) => {
        // Truncate very long URLs for display purposes
        const displayUrl = imageUrl.length > 50 ? imageUrl.substring(0, 47) + '...' : imageUrl;
        
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'image-wrapper loading';
        
        const img = document.createElement('img');
        img.alt = 'Related image';
        img.className = 'lazy-image';
        img.setAttribute('loading', 'lazy');
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'image-loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div>';
        imgWrapper.appendChild(loadingIndicator);
        
        // Image success handler
        img.addEventListener('load', () => {
          loadedImages++;
          imgWrapper.classList.remove('loading');
          imgWrapper.removeChild(loadingIndicator);
          console.log(`Image ${index+1} loaded successfully`);
        });
        
        // Image error handler
        img.addEventListener('error', () => {
          failedImages++;
          console.error(`Image failed to load: ${imageUrl}`);
          imgWrapper.classList.add('error');
          imgWrapper.classList.remove('loading');
          imgWrapper.removeChild(loadingIndicator);
          
          // Add error message
          const errorMsg = document.createElement('div');
          errorMsg.className = 'image-error';
          errorMsg.textContent = 'Image unavailable';
          imgWrapper.appendChild(errorMsg);
          
          // Add retry link with truncated URL
          const retryLink = document.createElement('a');
          retryLink.href = imageUrl;
          retryLink.className = 'open-image-link';
          retryLink.textContent = 'Open in new tab';
          retryLink.title = imageUrl;
          retryLink.target = '_blank';
          retryLink.rel = 'noopener noreferrer';
          imgWrapper.appendChild(retryLink);
          
          // Check if all images failed
          if (failedImages === data.images.length) {
            const fallbackMsg = document.createElement('p');
            fallbackMsg.className = 'all-images-failed';
            fallbackMsg.innerHTML = 'All images failed to load. This may be due to cross-origin restrictions.';
            imageContainer.appendChild(fallbackMsg);
          }
        });
        
        // Set image source last to begin loading
        img.src = imageUrl;
        imgWrapper.appendChild(img);
        imageContainer.appendChild(imgWrapper);
      });
    } else {
      imageContainer.innerHTML = '<p>No related images available</p>';
    }
    
    // Display single video
    videoContainer.innerHTML = '';
    if (data.videos && data.videos.length > 0) {
      // Take only the first video
      const videoInfo = data.videos[0];
      
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-wrapper';
      
      const videoTitle = document.createElement('p');
      videoTitle.textContent = videoInfo.title || 'Related video';
      videoTitle.className = 'video-title';
      
      const iframe = document.createElement('iframe');
      iframe.src = videoInfo.embedUrl;
      iframe.title = videoInfo.title || 'Related video';
      iframe.allowFullscreen = true;
      iframe.height = '250';
      
      // Add loading indicator for video
      const videoLoading = document.createElement('div');
      videoLoading.className = 'video-loading';
      videoLoading.innerHTML = '<div class="spinner"></div><p>Loading video...</p>';
      
      videoWrapper.appendChild(videoTitle);
      videoWrapper.appendChild(videoLoading);
      videoWrapper.appendChild(iframe);
      
      // Remove loading indicator when video loads
      iframe.addEventListener('load', () => {
        videoWrapper.removeChild(videoLoading);
      });
      
      videoContainer.appendChild(videoWrapper);
    } else {
      videoContainer.innerHTML = '<p>No related video available</p>';
    }

    // Show result container
    resultContainer.classList.remove('hidden');
  }

  // Function to display the page summary
  function displaySummary(data) {
    if (!data) {
      showSummarizeError('No summary received');
      return;
    }

    // Process summary text to highlight keywords marked with asterisks
    let processedSummary = data.summary || 'No summary available';
    
    // Replace *keyword* with highlighted spans
    processedSummary = processedSummary.replace(/\*([^*]+)\*/g, '<span class="highlighted-keyword">$1</span>');
    
    // Display the processed summary text with HTML
    pageSummary.innerHTML = processedSummary.replace(/\n/g, '<br>');

    // Display key points
    keyPoints.innerHTML = '';
    if (data.keyPoints && data.keyPoints.length > 0) {
      data.keyPoints.forEach(point => {
        const li = document.createElement('li');
        // Also process key points for any highlighted terms
        li.innerHTML = point.replace(/\*([^*]+)\*/g, '<span class="highlighted-keyword">$1</span>');
        keyPoints.appendChild(li);
      });
    } else {
      keyPoints.innerHTML = '<li>No key points available</li>';
    }

    // Enable download button
    const downloadSummaryBtn = document.getElementById('download-summary');
    downloadSummaryBtn.disabled = false;

    // Show result container
    summarizeResult.classList.remove('hidden');
  }

  // Function to show error message for word explanation
  function showError(message) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    loader.classList.add('hidden');
  }

  // Function to show error message for page summarization
  function showSummarizeError(message) {
    summarizeErrorMessage.textContent = message;
    summarizeError.classList.remove('hidden');
    summarizeResult.classList.add('hidden');
    summarizeLoader.classList.add('hidden');
  }

  // Add 'Enter' key support for input field
  if (textInput) {
    textInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && explainBtn) {
        explainBtn.click();
      }
    });
  }

  // Helper function to create learning path items
  function createLearningPathItem(concept, description) {
    const itemElement = document.createElement('div');
    itemElement.className = 'learning-path-item';
    
    const conceptElement = document.createElement('div');
    conceptElement.className = 'concept-name';
    conceptElement.textContent = concept;
    
    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'concept-description';
    descriptionElement.textContent = description;
    
    // Add click handler to search for this concept
    itemElement.addEventListener('click', () => {
      textInput.value = concept;
      explainBtn.click();
    });
    
    itemElement.appendChild(conceptElement);
    itemElement.appendChild(descriptionElement);
    
    return itemElement;
  }

  // Study Notes Generation
  async function generateStudyNotes() {
    const notesLoader = document.getElementById('notes-loader');
    const notesContainer = document.getElementById('notes-container');
    const notesError = document.getElementById('notes-error');
    const notesErrorMessage = document.getElementById('notes-error-message');
    const notesContent = document.getElementById('study-notes-content');
    const downloadNotesBtn = document.getElementById('download-notes');
    const notesInput = document.getElementById('notes-input');

    notesLoader.classList.remove('hidden');
    notesContainer.classList.add('hidden');
    notesError.classList.add('hidden');

    try {
      // Get user prompt from the dedicated notes input field
      const userPrompt = notesInput.value.trim();
      
      // Get page content if it has been analyzed
      const pageContent = notesInput.getAttribute('data-page-content') || '';
      const pageAnalyzed = !!pageContent;
      
      // Check if we have at least one input source
      if (!userPrompt && !pageAnalyzed) {
        notesErrorMessage.textContent = 'Please enter a topic or analyze a page for study notes';
        notesError.classList.remove('hidden');
        notesLoader.classList.add('hidden');
        return;
      }

      let finalPrompt = '';
      let finalPageContent = '';

      // Handle input logic as requested
      if (userPrompt && !pageAnalyzed) {
        // Only user prompt is provided
        finalPrompt = userPrompt;
        finalPageContent = '';
        console.log('Using only user prompt for study notes');
      } else if (!userPrompt && pageAnalyzed) {
        // Only page analysis is done
        finalPrompt = '';
        finalPageContent = pageContent;
        console.log('Using only page analysis for study notes');
      } else if (userPrompt && pageAnalyzed) {
        // Both inputs are provided
        finalPrompt = userPrompt;
        finalPageContent = pageContent;
        console.log('Using both user prompt and page analysis for study notes');
      }

      // Send to background script
      chrome.runtime.sendMessage(
        {
          action: 'generateStudyNotes',
          pageContent: finalPageContent,
          userPrompt: finalPrompt,
          title: notesInput.getAttribute('data-page-title') || document.title || 'Study Notes'
        },
        (response) => {
          notesLoader.classList.add('hidden');
          
          if (!response) {
            notesErrorMessage.textContent = 'No response received. Please check your API key.';
            notesError.classList.remove('hidden');
            return;
          }
          
          if (response.error) {
            notesErrorMessage.textContent = response.error;
            notesError.classList.remove('hidden');
            return;
          }

          // Display study notes
          notesContent.innerHTML = response.notes.replace(/\n/g, '<br>');
          notesContainer.classList.remove('hidden');
          downloadNotesBtn.disabled = false;
          
          // Store the notes for download
          downloadNotesBtn.setAttribute('data-content', response.notes);
          downloadNotesBtn.setAttribute('data-filename', 'Study Notes - ' + (response.title || 'Untitled') + '.txt');
        }
      );
    } catch (error) {
      console.error('Error generating study notes:', error);
      notesErrorMessage.textContent = 'Error: ' + error.message;
      notesError.classList.remove('hidden');
      notesLoader.classList.add('hidden');
    }
  }

  // Add function to analyze the current page
  async function analyzeCurrentPage() {
    const statusIndicator = document.getElementById('page-analyze-status');
    const notesInput = document.getElementById('notes-input');
    const analyzeBtn = document.getElementById('analyze-page-btn');
    
    // Set status to pending
    statusIndicator.textContent = 'Analyzing page...';
    statusIndicator.className = 'status-indicator pending';
    analyzeBtn.disabled = true;
    
    try {
      // Get current tab content
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      try {
        // First try sending message to content script
        chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
          // Check for runtime error which indicates content script not injected
          if (chrome.runtime.lastError) {
            console.log('Content script not yet injected, injecting now...');
            
            // Inject content script and try again
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Failed to inject content script:', chrome.runtime.lastError);
                statusIndicator.textContent = 'Failed to analyze page: Cannot access page content';
                statusIndicator.className = 'status-indicator error';
                analyzeBtn.disabled = false;
                return;
              }
              
              // Try again after injection (with delay to ensure script is ready)
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (secondResponse) => {
                  if (chrome.runtime.lastError || !secondResponse) {
                    statusIndicator.textContent = 'Failed to analyze page: Cannot access page content';
                    statusIndicator.className = 'status-indicator error';
                  } else {
                    handleContentResponse(secondResponse);
                  }
                  analyzeBtn.disabled = false;
                });
              }, 500);
            });
          } else {
            // Content script was already loaded, handle the response
            handleContentResponse(response);
            analyzeBtn.disabled = false;
          }
        });
      } catch (error) {
        console.error('Error getting page content:', error);
        statusIndicator.textContent = 'Error: ' + error.message;
        statusIndicator.className = 'status-indicator error';
        analyzeBtn.disabled = false;
      }
      
      function handleContentResponse(response) {
        if (!response || !response.content) {
          statusIndicator.textContent = 'Failed to extract page content';
          statusIndicator.className = 'status-indicator error';
          return;
        }
        
        // Store page content in the input's data attribute
        notesInput.setAttribute('data-page-content', response.content);
        notesInput.setAttribute('data-page-title', tab.title || 'Untitled');
        
        // Update status
        statusIndicator.textContent = 'Page analyzed successfully';
        statusIndicator.className = 'status-indicator success';
        
        console.log('Page content stored for study notes generation');
      }
    } catch (error) {
      console.error('Error analyzing page:', error);
      statusIndicator.textContent = 'Error: ' + error.message;
      statusIndicator.className = 'status-indicator error';
      analyzeBtn.disabled = false;
    }
  }

  // Add function to analyze the page for concept maps
  async function analyzePageForMap() {
    const statusIndicator = document.getElementById('map-page-analyze-status');
    const mapInput = document.getElementById('map-input');
    const analyzeBtn = document.getElementById('analyze-page-for-map-btn');
    
    // Set status to pending
    statusIndicator.textContent = 'Analyzing page...';
    statusIndicator.className = 'status-indicator pending';
    analyzeBtn.disabled = true;
    
    try {
      // Get current tab content
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      try {
        // First try sending message to content script
        chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
          // Check for runtime error which indicates content script not injected
          if (chrome.runtime.lastError) {
            console.log('Content script not yet injected, injecting now...');
            
            // Inject content script and try again
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Failed to inject content script:', chrome.runtime.lastError);
                statusIndicator.textContent = 'Failed to analyze page: Cannot access page content';
                statusIndicator.className = 'status-indicator error';
                analyzeBtn.disabled = false;
                return;
              }
              
              // Try again after injection (with delay to ensure script is ready)
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (secondResponse) => {
                  if (chrome.runtime.lastError || !secondResponse) {
                    statusIndicator.textContent = 'Failed to analyze page: Cannot access page content';
                    statusIndicator.className = 'status-indicator error';
                  } else {
                    handleContentResponse(secondResponse);
                  }
                  analyzeBtn.disabled = false;
                });
              }, 500);
            });
          } else {
            // Content script was already loaded, handle the response
            handleContentResponse(response);
            analyzeBtn.disabled = false;
          }
        });
      } catch (error) {
        console.error('Error getting page content:', error);
        statusIndicator.textContent = 'Error: ' + error.message;
        statusIndicator.className = 'status-indicator error';
        analyzeBtn.disabled = false;
      }
      
      function handleContentResponse(response) {
        if (!response || !response.content) {
          statusIndicator.textContent = 'Failed to extract page content';
          statusIndicator.className = 'status-indicator error';
          return;
        }
        
        // Store page content in the input's data attribute
        mapInput.setAttribute('data-page-content', response.content);
        mapInput.setAttribute('data-page-title', tab.title || 'Untitled');
        
        // Update status
        statusIndicator.textContent = 'Page analyzed successfully';
        statusIndicator.className = 'status-indicator success';
        
        console.log('Page content stored for concept map generation');
      }
    } catch (error) {
      console.error('Error analyzing page:', error);
      statusIndicator.textContent = 'Error: ' + error.message;
      statusIndicator.className = 'status-indicator error';
      analyzeBtn.disabled = false;
    }
  }

  // Add function to analyze the page for quizzes
  async function analyzePageForQuiz() {
    const statusIndicator = document.getElementById('quiz-page-analyze-status');
    const quizInput = document.getElementById('quiz-input');
    const analyzeBtn = document.getElementById('analyze-page-for-quiz-btn');
    
    // Set status to pending
    statusIndicator.textContent = 'Analyzing page...';
    statusIndicator.className = 'status-indicator pending';
    analyzeBtn.disabled = true;
    
    try {
      // Get current tab content
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      try {
        // First try sending message to content script
        chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (response) => {
          // Check for runtime error which indicates content script not injected
          if (chrome.runtime.lastError) {
            console.log('Content script not yet injected, injecting now...');
            
            // Inject content script and try again
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('Failed to inject content script:', chrome.runtime.lastError);
                statusIndicator.textContent = 'Failed to analyze page: Cannot access page content';
                statusIndicator.className = 'status-indicator error';
                analyzeBtn.disabled = false;
                return;
              }
              
              // Try again after injection (with delay to ensure script is ready)
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: 'getPageContent' }, (secondResponse) => {
                  if (chrome.runtime.lastError || !secondResponse) {
                    statusIndicator.textContent = 'Failed to analyze page: Cannot access page content';
                    statusIndicator.className = 'status-indicator error';
                  } else {
                    handleContentResponse(secondResponse);
                  }
                  analyzeBtn.disabled = false;
                });
              }, 500);
            });
          } else {
            // Content script was already loaded, handle the response
            handleContentResponse(response);
            analyzeBtn.disabled = false;
          }
        });
      } catch (error) {
        console.error('Error getting page content:', error);
        statusIndicator.textContent = 'Error: ' + error.message;
        statusIndicator.className = 'status-indicator error';
        analyzeBtn.disabled = false;
      }
      
      function handleContentResponse(response) {
        if (!response || !response.content) {
          statusIndicator.textContent = 'Failed to extract page content';
          statusIndicator.className = 'status-indicator error';
          return;
        }
        
        // Store page content in the input's data attribute
        quizInput.setAttribute('data-page-content', response.content);
        quizInput.setAttribute('data-page-title', tab.title || 'Untitled');
        
        // Update status
        statusIndicator.textContent = 'Page analyzed successfully';
        statusIndicator.className = 'status-indicator success';
        
        console.log('Page content stored for quiz generation');
      }
    } catch (error) {
      console.error('Error analyzing page:', error);
      statusIndicator.textContent = 'Error: ' + error.message;
      statusIndicator.className = 'status-indicator error';
      analyzeBtn.disabled = false;
    }
  }

  // Helper function to prepare the diagram for Mermaid 10.6.1
  function prepareMermaidDiagram(text) {
    // Start with clean graph TD if needed
    if (!text.trim().startsWith('graph')) {
      text = 'graph TD\n' + text;
    }
    
    // Ensure proper line break after graph declaration
    text = text.replace(/^(graph\s+TD|graph\s+LR)(.+)/m, '$1\n$2');
    
    // Fix common syntax issues
    let fixedLines = [];
    const lines = text.split('\n');
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Handle graph definition line
      if (line.startsWith('graph ')) {
        fixedLines.push(line);
        continue;
      }
      
      // Fix nodes without labels
      line = line
        .replace(/([A-Za-z0-9]+)(\s*-->)/g, '$1[$1]$2')
        .replace(/-->(\s*)([A-Za-z0-9]+)(?!\[)/g, '-->$1$2[$2]')
        .replace(/-->/g, ' --> ');
      
      // Break up multiple definitions on the same line (common error)
      // Look for potential multiple node definitions on the same line
      // This typically happens with patterns like: A[Node A] B[Node B]
      if (line.match(/\]\s+[A-Za-z0-9]+\[/)) {
        const parts = line.split(/(\][^[]*?[A-Za-z0-9]+\[)/);
        let newLines = [];
        let currentLine = parts[0];
        
        for (let j = 1; j < parts.length; j++) {
          if (j % 2 === 1) { // This is a split point
            // Complete the current line
            currentLine += parts[j].split(/\s+/)[0];
            newLines.push(currentLine);
            // Start new line with the rest
            currentLine = '  ' + parts[j].split(/\s+/).slice(1).join(' ');
          } else {
            currentLine += parts[j];
          }
        }
        
        if (currentLine.trim()) {
          newLines.push(currentLine);
        }
        
        // Add all new lines to our results
        for (const newLine of newLines) {
          fixedLines.push(newLine);
        }
      } else {
        // Add proper indentation for single lines
        fixedLines.push('  ' + line);
      }
    }
    
    // Join lines and then split by parentheses that aren't in brackets
    // This fixes issues where content inside parentheses needs to be on a new line
    let result = fixedLines.join('\n');
    
    // Handle lines with parentheses - these often cause syntax errors
    // Break up lines that have parentheses outside of square brackets
    const bracketContent = {};
    let bracketCounter = 0;
    
    // First, replace content inside [] with placeholders to protect it
    result = result.replace(/\[([^\]]*)\]/g, (match, content) => {
      const placeholder = `__BRACKET_${bracketCounter}__`;
      bracketContent[placeholder] = content;
      bracketCounter++;
      return `[${placeholder}]`;
    });
    
    // Now break lines with parentheses
    result = result.replace(/(\))\s*([A-Za-z0-9]+)/g, '$1\n  $2');
    
    // Now restore the bracket content
    Object.keys(bracketContent).forEach(key => {
      result = result.replace(key, bracketContent[key]);
    });
    
    return result;
  }

  async function generateConceptMap() {
    const mapLoader = document.getElementById('map-loader');
    const mapSuccess = document.getElementById('map-success');
    const mapError = document.getElementById('map-error');
    const mapErrorMessage = document.getElementById('map-error-message');
    const downloadMapBtn = document.getElementById('download-map');
    const mapInput = document.getElementById('map-input');

    mapLoader.classList.remove('hidden');
    mapSuccess.classList.add('hidden');
    mapError.classList.add('hidden');

    try {
      // Get user prompt from dedicated input field
      const userPrompt = mapInput.value.trim();
      
      // Get page content if it has been analyzed
      const pageContent = mapInput.getAttribute('data-page-content') || '';
      const pageAnalyzed = !!pageContent;
      
      // Check if we have at least one input source
      if (!userPrompt && !pageAnalyzed) {
        mapErrorMessage.textContent = 'Please enter a topic or analyze a page for the concept map';
        mapError.classList.remove('hidden');
        mapLoader.classList.add('hidden');
        return;
      }

      let finalPrompt = '';
      let finalPageContent = '';

      // Handle input logic as requested
      if (userPrompt && !pageAnalyzed) {
        // Only user prompt is provided
        finalPrompt = userPrompt;
        finalPageContent = '';
        console.log('Using only user prompt for concept map');
      } else if (!userPrompt && pageAnalyzed) {
        // Only page analysis is done
        finalPrompt = '';
        finalPageContent = pageContent;
        console.log('Using only page analysis for concept map');
      } else if (userPrompt && pageAnalyzed) {
        // Both inputs are provided
        finalPrompt = userPrompt;
        finalPageContent = pageContent;
        console.log('Using both user prompt and page analysis for concept map');
      }

      // Send to background script
      chrome.runtime.sendMessage(
        {
          action: 'generateConceptMap',
          pageContent: finalPageContent,
          userPrompt: finalPrompt,
          title: mapInput.getAttribute('data-page-title') || document.title || 'Concept Map'
        },
        (response) => {
          mapLoader.classList.add('hidden');
          
          if (!response) {
            mapErrorMessage.textContent = 'No response received. Please check your API key.';
            mapError.classList.remove('hidden');
            return;
          }
          
          if (response.error) {
            mapErrorMessage.textContent = response.error;
            mapError.classList.remove('hidden');
            return;
          }

          try {
            console.log('Processing Mermaid diagram...');
            
            // Clean up the diagram text
            let diagramText = response.diagram;
            
            // Prepare diagram for Mermaid 10.6.1
            diagramText = prepareMermaidDiagram(diagramText);
            
            console.log('Diagram prepared for download');
            
            // Enable download button and store diagram
            downloadMapBtn.disabled = false;
            downloadMapBtn.setAttribute('data-content', diagramText);
            downloadMapBtn.setAttribute('data-filename', 'Concept Map - ' + (response.title || 'Untitled') + '.txt');
            
            // Show success message
            mapSuccess.classList.remove('hidden');
            
          } catch (err) {
            console.error("Error processing diagram:", err);
            mapErrorMessage.textContent = "Error processing concept map: " + err.message;
            mapError.classList.remove('hidden');
          }
        }
      );
    } catch (error) {
      console.error('Error in concept map generation:', error);
      mapErrorMessage.textContent = 'Error: ' + error.message;
      mapError.classList.remove('hidden');
      mapLoader.classList.add('hidden');
    }
  }

  // Function to show diagram editor
  function showDiagramEditor(diagramText, title) {
    // Create a modal overlay
    const editorOverlay = document.createElement('div');
    editorOverlay.className = 'editor-overlay';
    
    // Create the editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'diagram-editor-container';
    
    // Create header
    const editorHeader = document.createElement('div');
    editorHeader.className = 'editor-header';
    editorHeader.innerHTML = `
      <h3>Edit Diagram: ${title}</h3>
      <button class="close-editor-btn">×</button>
    `;
    
    // Create editor area
    const editorContent = document.createElement('div');
    editorContent.className = 'editor-content';
    
    // Text editor
    const textEditor = document.createElement('textarea');
    textEditor.className = 'diagram-text-editor';
    textEditor.value = diagramText;
    textEditor.spellcheck = false;
    
    // Preview area
    const previewArea = document.createElement('div');
    previewArea.className = 'diagram-preview';
    previewArea.innerHTML = '<div id="editor-preview-canvas"></div>';
    
    // Enhanced tips for fixing common issues
    const tipsList = document.createElement('div');
    tipsList.className = 'diagram-tips';
    tipsList.innerHTML = `
      <p><strong>Common Syntax Errors & Fixes:</strong></p>
      <ul>
        <li><strong>Graph declaration:</strong> "graph TD" must be on its own line at the start</li>
        <li><strong>Node labels:</strong> Every node needs labels in square brackets: A[Label Text]</li>
        <li><strong>Arrow syntax:</strong> Use --> for connections (with spaces): A --> B</li>
        <li><strong>Line breaks:</strong> Each relationship should be on its own line</li>
        <li><strong>Indentation:</strong> Indent all nodes and relationships (except graph declaration)</li>
        <li><strong>Node references:</strong> Every node in a relationship must be defined with labels</li>
      </ul>
      <div class="action-buttons">
        <button id="auto-fix-btn" class="auto-fix-btn">Auto-Fix Common Issues</button>
        <button id="flat-format-btn" class="flat-format-btn">One-Line-Per-Relationship Format</button>
      </div>
      <div class="example-snippet">
        <p><strong>Example of correct syntax:</strong></p>
        <pre>graph TD
A[Main Concept]  -->  B[Related Concept] 
B[Related Concept]  -->  C[Another Concept]
A[Main Concept]  -->  D[Sub Concept]</pre>
      </div>
    `;
    
    // Actions area
    const actionsArea = document.createElement('div');
    actionsArea.className = 'editor-actions';
    actionsArea.innerHTML = `
      <button id="render-diagram-btn" class="render-diagram-btn">Render Diagram</button>
      <button id="apply-diagram-btn" class="apply-diagram-btn" disabled>Apply Changes</button>
      <div id="editor-status" class="editor-status"></div>
    `;
    
    // Assemble the editor
    editorContent.appendChild(textEditor);
    editorContent.appendChild(previewArea);
    editorContent.appendChild(tipsList);
    
    editorContainer.appendChild(editorHeader);
    editorContainer.appendChild(editorContent);
    editorContainer.appendChild(actionsArea);
    
    editorOverlay.appendChild(editorContainer);
    document.body.appendChild(editorOverlay);
    
    // Add event listeners
    document.querySelector('.close-editor-btn').addEventListener('click', () => {
      document.body.removeChild(editorOverlay);
    });
    
    // Auto-fix button
    document.getElementById('auto-fix-btn').addEventListener('click', () => {
      // Apply advanced fixes to the diagram
      const fixedDiagram = applyAdvancedFixes(textEditor.value);
      textEditor.value = fixedDiagram;
      
      // Render the fixed diagram
      document.getElementById('render-diagram-btn').click();
    });
    
    // Flat format button (converts to the exact format user wants)
    document.getElementById('flat-format-btn').addEventListener('click', () => {
      // Apply the flat format conversion
      const flatDiagram = convertToFlatFormat(textEditor.value);
      textEditor.value = flatDiagram;
      
      // Render the fixed diagram
      document.getElementById('render-diagram-btn').click();
    });
    
    // Function to convert to the flat format the user wants
    function convertToFlatFormat(diagramText) {
      // First extract all node definitions and relationships
      const nodeMap = new Map();
      const relationships = [];
      
      // Start with "graph TD" line
      let result = "graph TD\n";
      
      // First apply basic cleanup
      let cleaned = prepareMermaidDiagram(diagramText);
      
      // Split into lines and process
      const lines = cleaned.split('\n');
      
      // Process each line to extract nodes and relationships
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines and graph declaration
        if (!line || line.startsWith('graph ')) continue;
        
        // Check if this is a relationship line
        if (line.includes('-->')) {
          const parts = line.split('-->').map(p => p.trim());
          if (parts.length === 2) {
            const source = parts[0].trim();
            const target = parts[1].trim();
            
            // Extract source node ID and label
            const sourceMatch = source.match(/([A-Za-z0-9]+)(?:\[(.*?)\])?/);
            if (sourceMatch) {
              const sourceId = sourceMatch[1];
              const sourceLabel = sourceMatch[2] || sourceId;
              nodeMap.set(sourceId, sourceLabel);
            }
            
            // Extract target node ID and label
            const targetMatch = target.match(/([A-Za-z0-9]+)(?:\[(.*?)\])?/);
            if (targetMatch) {
              const targetId = targetMatch[1];
              const targetLabel = targetMatch[2] || targetId;
              nodeMap.set(targetId, targetLabel);
            }
            
            // Store the relationship
            if (sourceMatch && targetMatch) {
              relationships.push({
                source: sourceMatch[1],
                target: targetMatch[1]
              });
            }
          }
        } else {
          // This might be a single node definition
          const nodeMatch = line.match(/([A-Za-z0-9]+)(?:\[(.*?)\])?/);
          if (nodeMatch) {
            const nodeId = nodeMatch[1];
            const nodeLabel = nodeMatch[2] || nodeId;
            nodeMap.set(nodeId, nodeLabel);
          }
        }
      }
      
      // Now recreate the diagram in the exact format user wants
      result = "graph TD\n";
      
      // Add each relationship as a single line
      relationships.forEach(rel => {
        const sourceName = `${rel.source}[${nodeMap.get(rel.source)}]`;
        const targetName = `${rel.target}[${nodeMap.get(rel.target)}]`;
        result += `${sourceName}  -->  ${targetName} \n`;
      });
      
      return result;
    }
    
    // Function to apply more advanced fixes
    function applyAdvancedFixes(diagramText) {
      // First apply the standard prepareMermaidDiagram function
      let fixed = prepareMermaidDiagram(diagramText);
      
      // Additional fixes that may help with more complex issues
      
      // 1. Fix incorrect node definitions (no brackets)
      const nodeDefRegex = /^\s*([A-Za-z0-9]+)\s*$/gm;
      fixed = fixed.replace(nodeDefRegex, '  $1[$1]');
      
      // 2. Fix relationship lines that don't use proper arrows
      fixed = fixed.replace(/-(?!->)/g, '-->')
               .replace(/=>/g, ' --> ')
               .replace(/->/g, ' --> ');
      
      // 3. Break up multiple relationships on the same line
      fixed = fixed.replace(/(\s*-->.*?)(\s*[A-Za-z0-9]+\s*\[)/g, '$1\n  $2');
      
      // 4. Fix cases where graph declaration has content after it
      const graphDeclaration = fixed.match(/^graph\s+(TD|LR|TB|RL|BT)/);
      if (graphDeclaration) {
        const declaration = graphDeclaration[0];
        if (fixed.indexOf(declaration) === 0) {
          const restOfContent = fixed.substring(declaration.length).trim();
          if (restOfContent) {
            fixed = declaration + '\n' + restOfContent;
          }
        }
      }

      // 5. Break lines on parentheses - critical for Mermaid 10.6.1
      fixed = fixed.replace(/\)(.*?)\(/g, ')\n  (');
      fixed = fixed.replace(/\)([^,\s])/g, ')\n  $1');
      
      // 6. Fix complex patterns where nodes repeat on the same line 
      // Pattern like: A[Label] --> B[Label] B[Label] --> C[Label]
      const complexPattern = /(\[[^\]]+\])\s*-->\s*([A-Za-z0-9]+\[[^\]]+\])\s+\2\s*-->/g;
      while (fixed.match(complexPattern)) {
        fixed = fixed.replace(complexPattern, '$1 --> $2\n  $2 -->');
      }
      
      // 7. Handle node ID conflicts with A[A]X patterns (common in complex diagrams)
      // This replaces A[A]B with AB[B] to avoid node ID conflicts
      const conflictPattern = /A\[A\]([A-Z])/g;
      fixed = fixed.replace(conflictPattern, (match, letter) => {
        return `A${letter}[${letter}]`;
      });
      
      // 8. Place each relationship on its own line
      const relationships = fixed.split('\n');
      const newLines = [];
      for (const line of relationships) {
        if (line.includes('-->')) {
          // Split by arrow if multiple arrows on same line
          const parts = line.split(/\s*-->\s*/);
          if (parts.length > 2) {
            let source = parts[0].trim();
            for (let i = 1; i < parts.length; i++) {
              if (parts[i].trim()) {
                newLines.push(`  ${source} --> ${parts[i].trim()}`);
                // If not the last part, the target becomes the source for the next relationship
                if (i < parts.length - 1 && parts[i].includes('[')) {
                  source = parts[i].trim();
                }
              }
            }
          } else {
            newLines.push(line);
          }
        } else {
          newLines.push(line);
        }
      }
      fixed = newLines.join('\n');
      
      // 9. Add missing node definitions
      const definedNodes = new Set();
      const nodeDefPattern = /\b([A-Za-z0-9]+)\s*\[/g;
      let match;
      
      // Find all defined nodes
      while ((match = nodeDefPattern.exec(fixed)) !== null) {
        definedNodes.add(match[1]);
      }
      
      // Find all referenced nodes
      const referencedNodes = new Set();
      const nodeRefPattern = /\b([A-Za-z0-9]+)\s*-->/g;
      while ((match = nodeRefPattern.exec(fixed)) !== null) {
        if (!definedNodes.has(match[1])) {
          referencedNodes.add(match[1]);
        }
      }
      
      // Add missing node definitions at the end
      referencedNodes.forEach(node => {
        fixed += `\n  ${node}[${node}]`;
      });
      
      return fixed;
    }
    
    // Render button
    document.getElementById('render-diagram-btn').addEventListener('click', () => {
      const newDiagramText = textEditor.value;
      const previewCanvas = document.getElementById('editor-preview-canvas');
      const statusEl = document.getElementById('editor-status');
      const applyBtn = document.getElementById('apply-diagram-btn');
      
      statusEl.textContent = 'Rendering...';
      statusEl.className = 'editor-status pending';
      
      try {
        // Clear previous content
        previewCanvas.innerHTML = '';
        
        // Try to render the diagram
        mermaid.render('preview-mermaid-svg', prepareMermaidDiagram(newDiagramText))
          .then(result => {
            previewCanvas.innerHTML = result.svg;
            statusEl.textContent = 'Rendered successfully!';
            statusEl.className = 'editor-status success';
            applyBtn.disabled = false;
          })
          .catch(err => {
            console.error('Preview rendering error:', err);
            statusEl.textContent = 'Error: ' + err.message;
            statusEl.className = 'editor-status error';
            applyBtn.disabled = true;
            
            // Show suggestions for common errors
            if (err.message.includes('NEWLINE')) {
              previewCanvas.innerHTML = '<div class="syntax-suggestion">Tip: Make sure "graph TD" is on its own line, separate from node definitions.</div>';
            } else if (err.message.includes('NODE_STRING')) {
              previewCanvas.innerHTML = '<div class="syntax-suggestion">Tip: All nodes need labels in square brackets, like A[Label].</div>';
            } else if (err.message.includes('Arrow')) {
              previewCanvas.innerHTML = '<div class="syntax-suggestion">Tip: Check your arrow syntax. Use proper arrows like: A --> B</div>';
            } else {
              previewCanvas.innerHTML = '<div class="syntax-suggestion">Check your syntax. Try using the Auto-Fix button to resolve common issues.</div>';
            }
          });
      } catch (error) {
        console.error('Error in diagram preview:', error);
        statusEl.textContent = 'Error: ' + error.message;
        statusEl.className = 'editor-status error';
        applyBtn.disabled = true;
      }
    });
    
    // Apply button
    document.getElementById('apply-diagram-btn').addEventListener('click', () => {
      const newDiagramText = textEditor.value;
      const mapCanvas = document.getElementById('concept-map-canvas');
      const downloadMapBtn = document.getElementById('download-map');
      
      try {
        // Render to the main canvas
        mermaid.render('applied-mermaid-svg', prepareMermaidDiagram(newDiagramText))
          .then(result => {
            mapCanvas.innerHTML = result.svg;
            
            // Update the download button with new content
            downloadMapBtn.setAttribute('data-content', newDiagramText);
            
            // Close the editor
            document.body.removeChild(editorOverlay);
          })
          .catch(err => {
            console.error('Error applying diagram:', err);
            const statusEl = document.getElementById('editor-status');
            statusEl.textContent = 'Error applying changes: ' + err.message;
            statusEl.className = 'editor-status error';
          });
      } catch (error) {
        console.error('Error applying diagram:', error);
        const statusEl = document.getElementById('editor-status');
        statusEl.textContent = 'Error applying changes: ' + error.message;
        statusEl.className = 'editor-status error';
      }
    });
    
    // Auto-render on initial load
    document.getElementById('render-diagram-btn').click();
  }

  // Update quiz generation function
  async function generateQuiz() {
    const quizLoader = document.getElementById('quiz-loader');
    const quizContainer = document.getElementById('quiz-container');
    const quizError = document.getElementById('quiz-error');
    const quizErrorMessage = document.getElementById('quiz-error-message');
    const quizContent = document.getElementById('quiz-content');
    const checkAnswersBtn = document.getElementById('check-answers-btn');
    const downloadQuizBtn = document.getElementById('download-quiz');
    const quizInput = document.getElementById('quiz-input');

    quizLoader.classList.remove('hidden');
    quizContainer.classList.add('hidden');
    quizError.classList.add('hidden');

    try {
      // Get user prompt from dedicated input field
      const userPrompt = quizInput.value.trim();
      
      // Get page content if it has been analyzed
      const pageContent = quizInput.getAttribute('data-page-content') || '';
      const pageAnalyzed = !!pageContent;
      
      // Check if we have at least one input source
      if (!userPrompt && !pageAnalyzed) {
        quizErrorMessage.textContent = 'Please enter a topic or analyze a page for the quiz';
        quizError.classList.remove('hidden');
        quizLoader.classList.add('hidden');
        return;
      }

      let finalPrompt = '';
      let finalPageContent = '';

      // Handle input logic as requested
      if (userPrompt && !pageAnalyzed) {
        // Only user prompt is provided
        finalPrompt = userPrompt;
        finalPageContent = '';
        console.log('Using only user prompt for quiz');
      } else if (!userPrompt && pageAnalyzed) {
        // Only page analysis is done
        finalPrompt = '';
        finalPageContent = pageContent;
        console.log('Using only page analysis for quiz');
      } else if (userPrompt && pageAnalyzed) {
        // Both inputs are provided
        finalPrompt = userPrompt;
        finalPageContent = pageContent;
        console.log('Using both user prompt and page analysis for quiz');
      }

      // Send to background script
      chrome.runtime.sendMessage(
        {
          action: 'generateQuiz',
          pageContent: finalPageContent,
          userPrompt: finalPrompt,
          title: quizInput.getAttribute('data-page-title') || document.title || 'Quiz'
        },
        (response) => {
          quizLoader.classList.add('hidden');
          
          if (!response) {
            quizErrorMessage.textContent = 'No response received. Please check your API key.';
            quizError.classList.remove('hidden');
            return;
          }
          
          if (response.error) {
            quizErrorMessage.textContent = response.error;
            quizError.classList.remove('hidden');
            return;
          }

          // Display quiz questions
          quizContent.innerHTML = '';
          
          // Check if questions is valid
          if (!response.questions || !Array.isArray(response.questions) || response.questions.length === 0) {
            quizErrorMessage.textContent = 'Invalid quiz format received from API. Please try again.';
            quizError.classList.remove('hidden');
            return;
          }
          
          // Format quiz for display
          let quizHTML = '';
          response.questions.forEach((question, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'quiz-question';
            
            const questionText = document.createElement('p');
            questionText.textContent = `${index + 1}. ${question.question}`;
            questionDiv.appendChild(questionText);

            if (question.type === 'multiple-choice' && Array.isArray(question.options)) {
              question.options.forEach((option, optIndex) => {
                const optionLabel = document.createElement('label');
                optionLabel.className = 'quiz-option';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `question-${index}`;
                radio.value = optIndex;
                
                optionLabel.appendChild(radio);
                optionLabel.appendChild(document.createTextNode(` ${option}`));
                questionDiv.appendChild(optionLabel);
              });
            } else {
              const input = document.createElement('input');
              input.type = 'text';
              input.className = 'quiz-input';
              input.placeholder = 'Your answer...';
              questionDiv.appendChild(input);
            }

            quizContent.appendChild(questionDiv);
          });

          // Prepare quiz for download
          let quizText = `QUIZ QUESTIONS\n\n`;
          response.questions.forEach((question, index) => {
            quizText += `${index + 1}. ${question.question}\n`;
            if (question.type === 'multiple-choice' && Array.isArray(question.options)) {
              question.options.forEach((option, optIndex) => {
                quizText += `   ${String.fromCharCode(97 + optIndex)}) ${option}\n`;
              });
              quizText += `\n   Answer: ${question.answer !== undefined ? question.options[question.answer] : 'Not provided'}\n`;
            } else {
              quizText += `   Answer: ${question.answer || 'Not provided'}\n`;
            }
            quizText += '\n';
          });
          
          downloadQuizBtn.setAttribute('data-content', quizText);
          downloadQuizBtn.setAttribute('data-filename', 'Quiz - ' + (response.title || 'Untitled') + '.txt');
          
          quizContainer.classList.remove('hidden');
          if (checkAnswersBtn) {
            checkAnswersBtn.classList.remove('hidden');
            checkAnswersBtn.disabled = false;
            checkAnswersBtn.textContent = 'Check Answers';
          }
          downloadQuizBtn.disabled = false;
        }
      );
    } catch (error) {
      console.error('Error generating quiz:', error);
      quizErrorMessage.textContent = 'Error: ' + error.message;
      quizError.classList.remove('hidden');
      quizLoader.classList.add('hidden');
    }
  }

  // Add download functionality
  function setupDownloadButtons() {
    const downloadNotesBtn = document.getElementById('download-notes');
    const downloadMapBtn = document.getElementById('download-map');
    const downloadQuizBtn = document.getElementById('download-quiz');
    const downloadSummaryBtn = document.getElementById('download-summary');
    
    // Helper function to download text as a file
    function downloadText(content, filename) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
    
    // Study Notes Download
    downloadNotesBtn.addEventListener('click', () => {
      const content = downloadNotesBtn.getAttribute('data-content');
      const filename = downloadNotesBtn.getAttribute('data-filename') || 'study-notes.txt';
      if (content) {
        downloadText(content, filename);
      }
    });
    
    // Concept Map Download
    downloadMapBtn.addEventListener('click', () => {
      const content = downloadMapBtn.getAttribute('data-content');
      const filename = downloadMapBtn.getAttribute('data-filename') || 'concept-map.txt';
      if (content) {
        downloadText(content, filename);
      }
    });
    
    // Quiz Download
    downloadQuizBtn.addEventListener('click', () => {
      const content = downloadQuizBtn.getAttribute('data-content');
      const filename = downloadQuizBtn.getAttribute('data-filename') || 'quiz.txt';
      if (content) {
        downloadText(content, filename);
      }
    });
    
    // Summary Download
    downloadSummaryBtn.addEventListener('click', () => {
      const summaryText = document.getElementById('page-summary').textContent;
      const keyPointsItems = document.getElementById('key-points').querySelectorAll('li');
      
      let content = `PAGE SUMMARY\n\n${summaryText}\n\nKEY POINTS:\n\n`;
      keyPointsItems.forEach((item, index) => {
        content += `${index + 1}. ${item.textContent}\n`;
      });
      
      downloadText(content, 'page-summary.txt');
    });
  }

  // Function to check quiz answers
  function checkQuizAnswers() {
    const quizContent = document.getElementById('quiz-content');
    const questionDivs = quizContent.querySelectorAll('.quiz-question');
    let correctAnswers = 0;
    let totalQuestions = questionDivs.length;
    
    // First check if we have the stored answers
    const downloadQuizBtn = document.getElementById('download-quiz');
    const quizText = downloadQuizBtn.getAttribute('data-content');
    
    if (!quizText) {
      alert('Cannot check answers: Quiz data not found');
      return;
    }
    
    // Parse the quiz text to get the correct answers
    const answerMap = new Map();
    
    // Extract answers for each question from the quiz text
    const questionBlocks = quizText.split(/\d+\.\s/).filter(block => block.trim().length > 0);
    questionBlocks.forEach((block, index) => {
      const answerMatch = block.match(/Answer:\s*(.+?)(?:\n|$)/);
      if (answerMatch) {
        const answer = answerMatch[1].trim();
        answerMap.set(index, answer);
      }
    });
    
    // Check each question and mark it
    questionDivs.forEach((questionDiv, index) => {
      let isCorrect = false;
      let correctAnswer = answerMap.get(index);
      const feedbackDiv = document.createElement('div');
      feedbackDiv.className = 'quiz-feedback';
      
      // Get user's answer
      if (questionDiv.querySelector('.quiz-option')) {
        // Multiple choice question
        const selectedOption = questionDiv.querySelector('input[type="radio"]:checked');
        
        if (selectedOption) {
          const selectedIndex = parseInt(selectedOption.value);
          
          // Two ways to check multiple choice: by index or by text
          if (!isNaN(selectedIndex) && correctAnswer && !isNaN(parseInt(correctAnswer))) {
            // If the correct answer is a number, it's an index
            isCorrect = selectedIndex === parseInt(correctAnswer);
          } else {
            // Try to match by text
            const options = Array.from(questionDiv.querySelectorAll('.quiz-option'));
            const optionTexts = options.map(opt => opt.textContent.trim());
            
            if (selectedIndex < optionTexts.length) {
              const selectedText = optionTexts[selectedIndex];
              isCorrect = selectedText === correctAnswer;
            }
          }
          
          // Get the correct option text to display
          let correctOptionText = correctAnswer;
          const options = Array.from(questionDiv.querySelectorAll('.quiz-option'));
          const optionTexts = options.map(opt => opt.textContent.trim());
          
          if (!isNaN(parseInt(correctAnswer)) && parseInt(correctAnswer) < optionTexts.length) {
            correctOptionText = optionTexts[parseInt(correctAnswer)];
          }
          
          feedbackDiv.innerHTML = isCorrect ? 
            '<span class="correct">✓ Correct!</span>' : 
            `<span class="incorrect">✗ Incorrect. The correct answer is: ${correctOptionText}</span>`;
        } else {
          feedbackDiv.innerHTML = '<span class="incorrect">No answer selected</span>';
        }
      } else {
        // Short answer question
        const userAnswer = questionDiv.querySelector('.quiz-input').value.trim();
        
        if (userAnswer) {
          // For short answers, do a case-insensitive comparison
          isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
          feedbackDiv.innerHTML = isCorrect ? 
            '<span class="correct">✓ Correct!</span>' : 
            `<span class="incorrect">✗ Incorrect. The correct answer is: ${correctAnswer}</span>`;
        } else {
          feedbackDiv.innerHTML = '<span class="incorrect">No answer provided</span>';
        }
      }
      
      // Remove any existing feedback
      const existingFeedback = questionDiv.querySelector('.quiz-feedback');
      if (existingFeedback) {
        questionDiv.removeChild(existingFeedback);
      }
      
      // Add feedback to the question div
      questionDiv.appendChild(feedbackDiv);
      
      // Update score if correct
      if (isCorrect) {
        correctAnswers++;
      }
    });
    
    // Display the total score
    let scoreDisplay = document.getElementById('quiz-score');
    if (!scoreDisplay) {
      scoreDisplay = document.createElement('div');
      scoreDisplay.id = 'quiz-score';
      scoreDisplay.className = 'quiz-score';
      quizContent.parentNode.insertBefore(scoreDisplay, quizContent.nextSibling);
    }
    
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    scoreDisplay.innerHTML = `Your Score: ${correctAnswers}/${totalQuestions} (${percentage}%)`;
    
    // Apply color based on score
    if (percentage >= 80) {
      scoreDisplay.classList.add('high-score');
      scoreDisplay.classList.remove('medium-score', 'low-score');
    } else if (percentage >= 60) {
      scoreDisplay.classList.add('medium-score');
      scoreDisplay.classList.remove('high-score', 'low-score');
    } else {
      scoreDisplay.classList.add('low-score');
      scoreDisplay.classList.remove('high-score', 'medium-score');
    }
    
    // Disable the check answers button after use
    checkAnswersBtn.disabled = true;
    checkAnswersBtn.textContent = 'Answers Checked';
  }
}); 