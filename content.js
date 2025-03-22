// Notify the background script that the content script is loaded
chrome.runtime.sendMessage({ action: 'contentScriptReady' });

// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);

  // Handle the request to explain a selected text from context menu
  if (request.action === 'explainFromContextMenu' && request.text) {
    // Save the text to local storage so the popup can access it
    chrome.storage.local.set({
      'selectedText': request.text
    }, () => {
      // Open the extension popup
      chrome.runtime.sendMessage({
        action: 'openPopup',
        text: request.text
      });
    });
    return true; // Keep the message channel open for async response
  } 
  // Handle request to get page content for summarization
  else if (request.action === 'getPageContent') {
    try {
      const content = extractPageContent();
      console.log('Extracted page content:', content ? 'Success' : 'Failed');
      sendResponse(content);
    } catch (error) {
      console.error('Error extracting page content:', error);
      sendResponse({ error: error.message });
    }
    return true; // Keep the message channel open for async response
  } else if (request.action === 'showError') {
    showErrorNotification(request.error);
    return true;
  }
});

// Function to extract content from the current page
function extractPageContent() {
  try {
    // Get the article content if possible
    const article = document.querySelector('article');
    if (article && article.textContent.length > 500) {
      return {
        title: document.title,
        content: article.textContent.trim()
      };
    }
    
    // If no article, get content from main
    const main = document.querySelector('main');
    if (main && main.textContent.length > 500) {
      return {
        title: document.title,
        content: main.textContent.trim()
      };
    }
    
    // If no main, try to get content intelligently
    // Exclude navigation, header, footer, sidebars
    const excludeSelectors = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"]';
    const excludeElements = document.querySelectorAll(excludeSelectors);
    excludeElements.forEach(el => el.setAttribute('data-temp-remove', 'true'));
    
    // Get the body text
    const bodyText = document.body.innerText;
    
    // Restore excluded elements
    document.querySelectorAll('[data-temp-remove="true"]').forEach(el => el.removeAttribute('data-temp-remove'));
    
    return {
      title: document.title,
      content: bodyText.trim()
    };
  } catch (error) {
    console.error('Error in extractPageContent:', error);
    return {
      title: document.title,
      content: document.body.innerText.trim()
    };
  }
}

// Function to show the explanation overlay
function showOverlay(text, data) {
  // First remove any existing overlay
  removeOverlay();
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'gemini-explanation-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 800px;
    max-height: 90vh;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 23px 0 rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
    padding: 20px;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    border-bottom: 1px solid #eaeaea;
    padding-bottom: 10px;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'Explanation by Gemini';
  title.style.cssText = `
    color: #1a73e8;
    margin: 0;
    font-size: 18px;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #5f6368;
  `;
  closeBtn.onclick = removeOverlay;
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Create query section
  const querySection = document.createElement('div');
  querySection.style.cssText = `
    background-color: #f8f9fa;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 15px;
  `;
  
  const queryLabel = document.createElement('div');
  queryLabel.textContent = 'You asked about:';
  queryLabel.style.cssText = `
    font-weight: bold;
    margin-bottom: 5px;
    color: #5f6368;
    font-size: 13px;
  `;
  
  const queryText = document.createElement('div');
  queryText.textContent = text;
  queryText.style.cssText = `
    font-size: 15px;
    color: #202124;
  `;
  
  querySection.appendChild(queryLabel);
  querySection.appendChild(queryText);
  
  // Create content sections
  const content = document.createElement('div');
  
  // Add tabs for better organization
  const tabsContainer = document.createElement('div');
  tabsContainer.style.cssText = `
    display: flex;
    border-bottom: 1px solid #eaeaea;
    margin-bottom: 15px;
  `;
  
  const tabs = [
    { id: 'tab-explanation', label: 'Explanation' },
    { id: 'tab-key-terms', label: 'Key Terms' },
    { id: 'tab-visual', label: 'Visual' },
    { id: 'tab-multimedia', label: 'Multimedia' }
  ];
  
  const tabContents = {};
  
  tabs.forEach((tab, index) => {
    const tabElement = document.createElement('div');
    tabElement.id = tab.id;
    tabElement.textContent = tab.label;
    tabElement.style.cssText = `
      padding: 10px 15px;
      cursor: pointer;
      color: ${index === 0 ? '#1a73e8' : '#5f6368'};
      font-weight: ${index === 0 ? 'bold' : 'normal'};
      border-bottom: ${index === 0 ? '2px solid #1a73e8' : 'none'};
      margin-bottom: -1px;
    `;
    
    // Create content div for this tab
    const tabContent = document.createElement('div');
    tabContent.id = `${tab.id}-content`;
    tabContent.style.cssText = `
      display: ${index === 0 ? 'block' : 'none'};
    `;
    tabContents[tab.id] = tabContent;
    
    // Add tab click handler
    tabElement.addEventListener('click', () => {
      // Reset all tabs
      tabs.forEach(t => {
        const tabEl = document.getElementById(t.id);
        const contentEl = document.getElementById(`${t.id}-content`);
        if (tabEl && contentEl) {
          tabEl.style.color = '#5f6368';
          tabEl.style.fontWeight = 'normal';
          tabEl.style.borderBottom = 'none';
          contentEl.style.display = 'none';
        }
      });
      
      // Activate selected tab
      tabElement.style.color = '#1a73e8';
      tabElement.style.fontWeight = 'bold';
      tabElement.style.borderBottom = '2px solid #1a73e8';
      tabContent.style.display = 'block';
    });
    
    tabsContainer.appendChild(tabElement);
    content.appendChild(tabContent);
  });
  
  // Explanation section (Tab 1)
  const explanationSection = document.createElement('div');
  explanationSection.style.cssText = `
    margin-bottom: 20px;
  `;
  
  const explanationText = document.createElement('div');
  // Process the explanation text to highlight keywords (marked with *asterisks*)
  let processedText = data.explanation;
  processedText = processedText.replace(/\*([^*]+)\*/g, '<span style="background-color: #e8f0fe; padding: 2px 4px; border-radius: 2px; font-weight: bold;">$1</span>');
  
  explanationText.innerHTML = processedText.replace(/\n/g, '<br>');
  explanationText.style.cssText = `
    line-height: 1.6;
    font-size: 15px;
    color: #3c4043;
  `;
  
  explanationSection.appendChild(explanationText);
  tabContents['tab-explanation'].appendChild(explanationSection);
  
  // Key Terms section (Tab 2)
  const keyTermsSection = document.createElement('div');
  
  if (data.keyTerms && data.keyTerms.length > 0) {
    const keyTermsList = document.createElement('div');
    keyTermsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 15px;
    `;
    
    data.keyTerms.forEach(item => {
      const termCard = document.createElement('div');
      termCard.style.cssText = `
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      `;
      
      const termHeading = document.createElement('h4');
      termHeading.textContent = item.term;
      termHeading.style.cssText = `
        color: #1a73e8;
        margin: 0 0 8px 0;
        font-size: 16px;
      `;
      
      const termDefinition = document.createElement('div');
      termDefinition.textContent = item.definition;
      termDefinition.style.cssText = `
        font-size: 14px;
        color: #3c4043;
      `;
      
      termCard.appendChild(termHeading);
      termCard.appendChild(termDefinition);
      keyTermsList.appendChild(termCard);
    });
    
    keyTermsSection.appendChild(keyTermsList);
  } else {
    const noTerms = document.createElement('p');
    noTerms.textContent = 'No key terms available';
    noTerms.style.cssText = `
      color: #5f6368;
      font-style: italic;
      text-align: center;
    `;
    keyTermsSection.appendChild(noTerms);
  }
  
  tabContents['tab-key-terms'].appendChild(keyTermsSection);
  
  // Visual Representation section (Tab 3)
  const visualSection = document.createElement('div');
  visualSection.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
  `;
  
  if (data.visualRepresentation) {
    // Create a visual block
    const visualBlock = document.createElement('div');
    visualBlock.style.cssText = `
      background-color: #f0f7ff;
      border: 1px solid #d2e3fc;
      border-radius: 8px;
      padding: 15px;
      width: 90%;
    `;
    
    const visualIcon = document.createElement('div');
    visualIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#1a73e8">
        <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM5 10h9v2H5zm0-3h9v2H5zm0 6h9v2H5zm14-4h-4v7h4z"/>
      </svg>
    `;
    visualIcon.style.cssText = `
      text-align: center;
      margin-bottom: 10px;
    `;
    
    const visualTitle = document.createElement('h4');
    visualTitle.textContent = 'Visual Representation';
    visualTitle.style.cssText = `
      color: #1a73e8;
      margin: 0 0 10px 0;
      font-size: 16px;
      text-align: center;
    `;
    
    const visualText = document.createElement('div');
    visualText.textContent = data.visualRepresentation;
    visualText.style.cssText = `
      font-size: 14px;
      line-height: 1.5;
      color: #3c4043;
    `;
    
    visualBlock.appendChild(visualIcon);
    visualBlock.appendChild(visualTitle);
    visualBlock.appendChild(visualText);
    visualSection.appendChild(visualBlock);
  } else {
    const noVisual = document.createElement('p');
    noVisual.textContent = 'No visual representation available';
    noVisual.style.cssText = `
      color: #5f6368;
      font-style: italic;
      text-align: center;
    `;
    visualSection.appendChild(noVisual);
  }
  
  tabContents['tab-visual'].appendChild(visualSection);
  
  // Multimedia section (Tab 4)
  const multimediaSection = document.createElement('div');
  
  // Images subsection
  const imagesSection = document.createElement('div');
  imagesSection.style.cssText = `
    margin-bottom: 20px;
  `;
  
  const imagesTitle = document.createElement('h3');
  imagesTitle.textContent = 'Related Images';
  imagesTitle.style.cssText = `
    color: #202124;
    font-size: 16px;
    margin-top: 0;
    margin-bottom: 10px;
    border-bottom: 1px solid #eaeaea;
    padding-bottom: 5px;
  `;
  
  const imagesContainer = document.createElement('div');
  imagesContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  `;
  
  if (data.images && data.images.length > 0) {
    data.images.forEach(imageUrl => {
      const imgWrapper = document.createElement('div');
      imgWrapper.style.cssText = `
        max-width: 200px;
        border: 1px solid #eaeaea;
        border-radius: 4px;
        overflow: hidden;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: transform 0.2s ease;
      `;
      imgWrapper.onmouseover = () => {
        imgWrapper.style.transform = 'scale(1.05)';
      };
      imgWrapper.onmouseout = () => {
        imgWrapper.style.transform = 'scale(1)';
      };
      
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = 'Related image';
      img.style.cssText = `
        width: 100%;
        height: auto;
        object-fit: cover;
      `;
      img.onerror = () => {
        imgWrapper.style.display = 'none';
      };
      
      imgWrapper.appendChild(img);
      imagesContainer.appendChild(imgWrapper);
    });
  } else {
    const noImages = document.createElement('p');
    noImages.textContent = 'No related images available';
    noImages.style.cssText = `
      color: #5f6368;
      font-style: italic;
      text-align: center;
      width: 100%;
    `;
    imagesContainer.appendChild(noImages);
  }
  
  imagesSection.appendChild(imagesTitle);
  imagesSection.appendChild(imagesContainer);
  
  // Video section - Show only the first video from the array
  const videoSection = document.createElement('div');
  videoSection.style.cssText = `
    margin-top: 30px;
  `;
  
  const videoTitle = document.createElement('h3');
  videoTitle.textContent = 'Related Video';
  videoTitle.style.cssText = `
    color: #202124;
    font-size: 16px;
    margin-top: 0;
    margin-bottom: 10px;
    border-bottom: 1px solid #eaeaea;
    padding-bottom: 5px;
  `;
  
  const videoContainer = document.createElement('div');
  videoContainer.style.cssText = `
    display: flex;
    flex-direction: column;
  `;
  
  if (data.videos && data.videos.length > 0) {
    // Take only the first video
    const video = data.videos[0];
    
    const videoWrapper = document.createElement('div');
    videoWrapper.style.cssText = `
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    `;
    
    const videoTitleText = document.createElement('p');
    videoTitleText.textContent = video.title || 'Related video';
    videoTitleText.style.cssText = `
      margin: 0 0 10px 0;
      font-weight: bold;
      font-size: 14px;
      color: #202124;
    `;
    
    const iframe = document.createElement('iframe');
    iframe.src = video.embedUrl;
    iframe.width = '100%';
    iframe.height = '250';
    iframe.allowFullscreen = true;
    iframe.style.cssText = `
      border: none;
      border-radius: 4px;
    `;
    
    videoWrapper.appendChild(videoTitleText);
    videoWrapper.appendChild(iframe);
    videoContainer.appendChild(videoWrapper);
  } else {
    const noVideo = document.createElement('p');
    noVideo.textContent = 'No related video available';
    noVideo.style.cssText = `
      color: #5f6368;
      font-style: italic;
      text-align: center;
    `;
    videoContainer.appendChild(noVideo);
  }
  
  videoSection.appendChild(videoTitle);
  videoSection.appendChild(videoContainer);
  
  multimediaSection.appendChild(imagesSection);
  multimediaSection.appendChild(videoSection);
  tabContents['tab-multimedia'].appendChild(multimediaSection);
  
  // Add attribution
  const attribution = document.createElement('div');
  attribution.style.cssText = `
    margin-top: 20px;
    text-align: center;
    font-size: 12px;
    color: #5f6368;
    padding-top: 10px;
    border-top: 1px solid #eaeaea;
  `;
  attribution.textContent = 'Powered by Google Gemini AI';
  
  // Assemble overlay
  overlay.appendChild(header);
  overlay.appendChild(querySection);
  overlay.appendChild(tabsContainer);
  overlay.appendChild(content);
  overlay.appendChild(attribution);
  
  // Add overlay backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'gemini-explanation-backdrop';
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 2147483646;
  `;
  backdrop.onclick = removeOverlay;
  
  document.body.appendChild(backdrop);
  document.body.appendChild(overlay);
  
  // Prevent body scrolling
  document.body.style.overflow = 'hidden';
}

// Function to remove overlay
function removeOverlay() {
  const overlay = document.getElementById('gemini-explanation-overlay');
  const backdrop = document.getElementById('gemini-explanation-backdrop');
  
  if (overlay) {
    overlay.remove();
  }
  
  if (backdrop) {
    backdrop.remove();
  }
  
  // Restore body scrolling
  document.body.style.overflow = '';
}

// Function to show error notification
function showErrorNotification(errorText) {
  // First remove any existing notification
  const existingNotification = document.getElementById('gemini-error-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'gemini-error-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #d93025;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 2147483647;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size: 14px;
    animation: slideIn 0.2s ease-out;
  `;
  
  // Add animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  // Error message
  const message = document.createElement('div');
  message.textContent = errorText;
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    position: absolute;
    top: 8px;
    right: 8px;
    cursor: pointer;
    padding: 0;
  `;
  closeBtn.onclick = () => notification.remove();
  
  notification.appendChild(message);
  notification.appendChild(closeBtn);
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
} 