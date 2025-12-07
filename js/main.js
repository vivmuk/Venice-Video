 // Application entry point for Venice Video API app

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize all UI components
  initializeComponents();
  
  // Setup tab navigation
  setupTabNavigation();
  
  // Setup form submission handler
  const videoForm = document.getElementById('video-form');
  if (videoForm) {
    videoForm.addEventListener('submit', handleFormSubmit);
  }
  
  // Setup cost estimation handler
  const costEstimateBtn = document.getElementById('cost-estimate-btn');
  if (costEstimateBtn) {
    costEstimateBtn.addEventListener('click', handleCostEstimate);
  }
  
  // Setup cancel processing handler
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancelProcessing);
  }
  
  // Setup download handler
  const downloadBtn = document.getElementById('download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', handleDownload);
  }
  
  // Setup new generation handler
  const newGenerationBtn = document.getElementById('new-generation-btn');
  if (newGenerationBtn) {
    newGenerationBtn.addEventListener('click', handleNewGeneration);
  }
  
  // Setup model change handler
  const modelSelect = document.getElementById('model');
  if (modelSelect) {
    modelSelect.addEventListener('change', handleModelChange);
  }
  
  // Initialize state
  window.veniceState = window.veniceState || {};

  // Global error handling
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showErrorModal(getUserFriendlyError(event.error));
  });

  // Unhandled promise rejection handling
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorModal(getUserFriendlyError(event.reason));
  });

  // Check browser compatibility
  checkBrowserCompatibility();
});

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();

  const generateBtn = document.getElementById('generate-btn');

  try {
    // Validate form with inline error display
    const isValid = validateFormWithErrors();
    if (!isValid) {
      return;
    }

    // Show loading state
    showButtonLoading(generateBtn, 'Submitting...');
    showLoading('Submitting video generation request...');

    // Get form data
    const formData = new FormData(event.target);
    const params = {};

    for (let [key, value] of formData.entries()) {
      // Handle special cases for checkboxes
      if (key === 'audio' || key === 'auto-delete') {
        params[key] = formData.getAll(key).length > 0;
      } else {
        params[key] = value;
      }
    }

    // Get API token
    const apiToken = document.getElementById('api-token').value;

    // Update state with parameters
    if (window.veniceState && window.veniceState.setVideoParameters) {
      window.veniceState.setVideoParameters(params);
    }

    // Update state with API token
    if (window.veniceState && window.veniceState.updateToken) {
      window.veniceState.updateToken(apiToken);
    }

    // Create API instance
    const api = new VeniceAPI(apiToken);

    // Submit to queue
    const queueResponse = await api.queue(params);

    // Update state with queue ID
    if (window.veniceState && window.veniceState.setQueueId) {
      window.veniceState.setQueueId(queueResponse.queue_id);
    }

    // Update state processing status
    if (window.veniceState && window.veniceState.setProcessingStatus) {
      window.veniceState.setProcessingStatus(true);
    }

    // Update UI with queue ID
    const queueIdElement = document.getElementById('queue-id');
    if (queueIdElement) {
      queueIdElement.textContent = queueResponse.queue_id;
    }

    // Show success message
    showSuccess('Video generation started successfully!');

    // Hide loading state
    hideLoading();
    hideButtonLoading(generateBtn);

    // Switch to processing tab
    switchToTab('processing');

    // Start polling for status updates
    startPolling(api, queueResponse.queue_id);
  } catch (error) {
    console.error('Error during form submission:', error);

    // Hide loading state
    hideLoading();
    hideButtonLoading(generateBtn);

    // Show user-friendly error
    showErrorModal(getUserFriendlyError(error));
  }
}

// Handle cost estimation
async function handleCostEstimate(event) {
  event.preventDefault();

  const costEstimateBtn = document.getElementById('cost-estimate-btn');

  try {
    // Validate form with inline error display
    const isValid = validateFormWithErrors();
    if (!isValid) {
      return;
    }

    // Show loading state
    showButtonLoading(costEstimateBtn, 'Calculating...');

    // Get form data
    const videoForm = document.getElementById('video-form');
    const formData = new FormData(videoForm);
    const params = {};

    for (let [key, value] of formData.entries()) {
      // Handle special cases for checkboxes
      if (key === 'audio' || key === 'auto-delete') {
        params[key] = formData.getAll(key).length > 0;
      } else {
        params[key] = value;
      }
    }

    // Get API token
    const apiToken = document.getElementById('api-token').value;

    // Create API instance
    const api = new VeniceAPI(apiToken);

    // Get quote
    const quoteResponse = await api.quote(params);

    // Hide loading state
    hideButtonLoading(costEstimateBtn);

    // Show cost estimate in a modal
    showCostEstimateModal(quoteResponse);
  } catch (error) {
    console.error('Error during cost estimation:', error);

    // Hide loading state
    hideButtonLoading(costEstimateBtn);

    // Show user-friendly error
    showErrorModal(getUserFriendlyError(error));
  }
}

// Show cost estimate modal
function showCostEstimateModal(quote) {
  // Remove existing modal if present
  const existingModal = document.getElementById('cost-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'error-modal active';
  modal.id = 'cost-modal';

  modal.innerHTML = `
    <div class="error-content cost-content">
      <h3>Cost Estimate</h3>
      <div class="cost-details">
        <p><strong>Estimated Cost:</strong> $${quote.estimated_cost || 'N/A'}</p>
        <p><strong>Estimated Time:</strong> ${quote.estimated_time || 'N/A'} seconds</p>
        <p><strong>Credits Required:</strong> ${quote.credits_required || 'N/A'}</p>
      </div>
      <button id="close-cost" class="close-button">Close</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listener to close button
  document.getElementById('close-cost').addEventListener('click', () => {
    modal.remove();
  });

  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Handle model change
function handleModelChange(event) {
  // Re-trigger the model change behavior from components.js
  const modelSelect = document.getElementById('model');
  const promptContainer = document.getElementById('prompt-input-container');
  const imageUrlContainer = document.getElementById('image-url-container');
  const audioToggleContainer = document.getElementById('audio-toggle-container');
  const durationSelect = document.getElementById('duration');
  
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const modelType = selectedOption.dataset.type;
  const maxDuration = parseInt(selectedOption.dataset.maxDuration);
  const supportsAudio = selectedOption.dataset.audio === 'true';
  const resolutions = JSON.parse(selectedOption.dataset.resolutions);
  
  // Show/hide prompt or image URL input based on model type
  if (modelType === 'text') {
    promptContainer.style.display = 'block';
    imageUrlContainer.style.display = 'none';
  } else {
    promptContainer.style.display = 'none';
    imageUrlContainer.style.display = 'block';
  }
  
  // Show/hide audio toggle based on model support
  if (supportsAudio) {
    audioToggleContainer.style.display = 'block';
  } else {
    audioToggleContainer.style.display = 'none';
    document.getElementById('audio').checked = false;
  }
  
  // Update duration options based on model max duration
  const durationOptions = durationSelect.querySelectorAll('option');
  durationOptions.forEach(option => {
    const durationValue = parseInt(option.value);
    option.disabled = durationValue > maxDuration;
    if (durationValue > maxDuration && option.selected) {
      // Select the highest available option that's within limits
      for (let i = durationOptions.length - 1; i >= 0; i--) {
        if (parseInt(durationOptions[i].value) <= maxDuration) {
          durationOptions[i].selected = true;
          break;
        }
      }
    }
  });
  
  // Update resolution options based on model capabilities
  const resolutionSelect = document.getElementById('resolution');
  const resolutionOptions = resolutionSelect.querySelectorAll('option');
  resolutionOptions.forEach(option => {
    option.disabled = !resolutions.includes(option.value);
    if (!resolutions.includes(option.value) && option.selected) {
      // Select the highest available resolution that's supported
      for (let i = resolutionOptions.length - 1; i >= 0; i--) {
        if (resolutions.includes(resolutionOptions[i].value)) {
          resolutionOptions[i].selected = true;
          break;
        }
      }
    }
  });
}

// Validate form inputs
function validateForm() {
  const modelSelect = document.getElementById('model');
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const modelType = selectedOption.dataset.type;
  
  // Validate prompt or image URL based on model type
  if (modelType === 'text') {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) {
      showErrorModal('Prompt is required for text-to-video models');
      return false;
    }
  } else {
    const imageUrl = document.getElementById('image-url').value.trim();
    if (!imageUrl) {
      showErrorModal('Image URL is required for image-to-video models');
      return false;
    }
    
    try {
      new URL(imageUrl);
    } catch (e) {
      showErrorModal('Please enter a valid image URL');
      return false;
    }
  }
  
  // Validate duration
  const duration = document.getElementById('duration').value;
  if (!duration || isNaN(duration) || parseInt(duration) <= 0) {
    showErrorModal('Please select a valid duration');
    return false;
  }
  
  return true;
}

// Start polling for status updates
async function startPolling(api, queueId) {
  try {
    // Update UI status
    updateStatus('Processing...', 'processing');

    // Poll for status updates
    const pollInterval = 10000; // 10 seconds
    const maxAttempts = 360; // 1 hour maximum

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      // Check if processing was cancelled
      if (window.veniceState && !window.veniceState.isProcessing) {
        updateStatus('Cancelled', 'warning');
        break;
      }

      try {
        const statusResponse = await api.retrieve(queueId, pollInterval, 1);

        // Update progress in state
        if (window.veniceState && window.veniceState.updateProgress) {
          window.veniceState.updateProgress(statusResponse.progress || 0);
        }

        // Update UI progress
        const statusText = getStatusText(statusResponse.status, statusResponse.progress);
        updateProgressDisplay(statusResponse.progress || 0, statusText);

        // Update estimated time remaining
        const timeRemainingElement = document.getElementById('time-remaining');
        if (timeRemainingElement && statusResponse.estimated_time_remaining) {
          timeRemainingElement.textContent = formatTimeRemaining(statusResponse.estimated_time_remaining);
        }

        // Check if processing is complete
        if (statusResponse.status === 'completed' && statusResponse.video_url) {
          // Update state with video data
          if (window.veniceState && window.veniceState.setVideoData) {
            window.veniceState.setVideoData(statusResponse.video_url, statusResponse.title || 'Generated Video');
          }

          // Update status
          updateStatus('Completed', 'success');

          // Show success message
          showSuccess('Video generated successfully!');

          // Update video display
          displayGeneratedVideo(statusResponse.video_url, statusResponse);

          // Switch to video display tab
          switchToTab('video');
          break;
        }

        // Check if processing failed
        if (statusResponse.status === 'failed') {
          updateStatus('Failed', 'error');
          throw new Error(statusResponse.error || 'Video generation failed');
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        if (error.status === 404) {
          // Queue not found, might have been cancelled
          updateStatus('Not found', 'warning');
          showWarning('Queue not found. It may have expired or been cancelled.');
          break;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error during polling:', error);
    updateStatus('Error', 'error');
    showErrorModal(getUserFriendlyError(error));

    // Update state processing status
    if (window.veniceState && window.veniceState.setProcessingStatus) {
      window.veniceState.setProcessingStatus(false);
    }
  }
}

// Get user-friendly status text
function getStatusText(status, progress) {
  switch (status) {
    case 'queued':
      return 'Waiting in queue...';
    case 'processing':
      return `Processing... ${progress || 0}%`;
    case 'completed':
      return 'Completed!';
    case 'failed':
      return 'Failed';
    default:
      return status || 'Processing...';
  }
}

// Format time remaining
function formatTimeRemaining(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

// Display generated video
function displayGeneratedVideo(videoUrl, metadata) {
  const videoPlayer = document.getElementById('video-player');
  const videoPlayerWrapper = document.getElementById('video-player-wrapper');
  const videoPlayerPlaceholder = document.getElementById('video-player-placeholder');
  const videoMetadata = document.getElementById('video-metadata');

  if (videoPlayer && videoPlayerWrapper) {
    videoPlayer.src = videoUrl;
    videoPlayerWrapper.style.display = 'block';

    if (videoPlayerPlaceholder) {
      videoPlayerPlaceholder.style.display = 'none';
    }

    // Update metadata if available
    if (videoMetadata && metadata) {
      const videoTitle = document.getElementById('video-title');
      const videoDuration = document.getElementById('video-duration');
      const videoResolution = document.getElementById('video-resolution');
      const videoModel = document.getElementById('video-model');

      if (videoTitle) videoTitle.textContent = metadata.title || 'Generated Video';
      if (videoDuration) videoDuration.textContent = metadata.duration ? `${metadata.duration}s` : 'N/A';
      if (videoResolution) videoResolution.textContent = metadata.resolution || 'N/A';
      if (videoModel) videoModel.textContent = metadata.model || 'N/A';

      videoMetadata.style.display = 'block';
    }
  }
}

// Handle cancel processing
function handleCancelProcessing(event) {
  event.preventDefault();

  // Update state processing status
  if (window.veniceState && window.veniceState.setProcessingStatus) {
    window.veniceState.setProcessingStatus(false);
  }

  // Update UI status
  updateStatus('Cancelled', 'warning');
  updateProgressDisplay(0, 'Cancelled');

  // Show warning toast
  showWarning('Video generation cancelled');

  // Switch back to input tab
  switchToTab('input');
}

// Handle download
function handleDownload(event) {
  event.preventDefault();

  const downloadBtn = document.getElementById('download-btn');

  // Get video URL from state
  const videoUrl = window.veniceState && window.veniceState.videoUrl;
  if (!videoUrl) {
    showErrorModal('No video available for download');
    return;
  }

  try {
    // Show loading state
    showButtonLoading(downloadBtn, 'Downloading...');

    // Create temporary link for download
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = 'venice-generated-video.mp4';
    link.style.display = 'none';

    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show success message
    showSuccess('Download started!');

    // Hide loading state
    hideButtonLoading(downloadBtn);

    // Check if auto-delete is enabled
    const autoDelete = document.getElementById('auto-delete');
    if (autoDelete && autoDelete.checked) {
      // Perform storage cleanup
      handleStorageCleanup();
    }
  } catch (error) {
    console.error('Error during download:', error);
    hideButtonLoading(downloadBtn);
    showErrorModal('Failed to start download. Please try again.');
  }
}

// Handle storage cleanup
async function handleStorageCleanup() {
  try {
    // Get queue ID from state
    const queueId = window.veniceState && window.veniceState.currentQueueId;
    if (!queueId) {
      console.log('No queue ID available for cleanup');
      return;
    }

    // Get API token from state
    const apiToken = window.veniceState && window.veniceState.apiToken;
    if (!apiToken) {
      console.log('No API token available for cleanup');
      return;
    }

    // Create API instance
    const api = new VeniceAPI(apiToken);

    // Call complete endpoint
    await api.complete(queueId);

    // Show success toast (non-intrusive)
    showToast('Storage cleaned up successfully', 'info');
  } catch (error) {
    console.error('Error during storage cleanup:', error);
    // Show warning toast instead of modal (non-intrusive for background operation)
    showWarning('Storage cleanup failed. Video file may still be available.');
  }
}

// Handle new generation
function handleNewGeneration(event) {
  event.preventDefault();
  
  // Reset state
  if (window.veniceState && window.veniceState.reset) {
    window.veniceState.reset();
  }
  
  // Reset form
  const videoForm = document.getElementById('video-form');
  if (videoForm) {
    videoForm.reset();
  }
  
  // Reset progress display
  updateProgressDisplay(0, 'Waiting to start...');
  
  // Reset queue info
  const queueIdElement = document.getElementById('queue-id');
  if (queueIdElement) {
    queueIdElement.textContent = '-';
  }
  
  const statusElement = document.getElementById('processing-status');
  if (statusElement) {
    statusElement.textContent = 'Not started';
  }
  
  const timeRemainingElement = document.getElementById('time-remaining');
  if (timeRemainingElement) {
    timeRemainingElement.textContent = '-';
  }
  
  // Reset video display
  const videoPlayerWrapper = document.getElementById('video-player-wrapper');
  if (videoPlayerWrapper) {
    videoPlayerWrapper.style.display = 'none';
  }
  
  const videoPlayerPlaceholder = document.getElementById('video-player-placeholder');
  if (videoPlayerPlaceholder) {
    videoPlayerPlaceholder.style.display = 'block';
  }
  
  const videoMetadata = document.getElementById('video-metadata');
  if (videoMetadata) {
    videoMetadata.style.display = 'none';
  }
  
  // Switch to input tab
  switchToTab('input');
}

// Utility function to switch tabs
function switchToTab(tabId) {
  const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
  if (tab) {
    tab.click();
  }
}

// Setup tab navigation event handlers
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });
    });
  });
}

// Update progress display
function updateProgressDisplay(percentage, statusText) {
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  if (progressFill) {
    progressFill.style.width = `${percentage}%`;
  }
  
  if (progressText) {
    progressText.textContent = statusText || `${percentage}% complete`;
  }
}

// Show error modal
function showErrorModal(message) {
  const modal = document.getElementById('error-modal');
  const errorMessage = document.getElementById('error-message');

  if (modal && errorMessage) {
    errorMessage.textContent = message;
    modal.classList.add('active');
  }
}

// Get user-friendly error message
function getUserFriendlyError(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const message = error.message || String(error);

  // Network errors
  if (message.includes('fetch') || message.includes('network') || message.includes('NetworkError')) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('Timeout') || message.includes('AbortError')) {
    return 'Request timed out. The server is taking too long to respond. Please try again.';
  }

  // API token errors
  if (message.includes('Unauthorized') || message.includes('401') || message.includes('Invalid API token')) {
    return 'Invalid API token. Please check your Venice API token and try again.';
  }

  // Credit errors
  if (message.includes('Payment Required') || message.includes('402') || message.includes('Insufficient credits')) {
    return 'Insufficient credits. Please add more credits to your Venice account.';
  }

  // Validation errors
  if (message.includes('Unprocessable') || message.includes('422') || message.includes('validation')) {
    return 'Invalid parameters. Please check your input and try again.';
  }

  // Not found errors
  if (message.includes('Not Found') || message.includes('404')) {
    return 'Resource not found. The requested video or queue may have expired.';
  }

  // Server errors
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return 'Server error. Please try again later.';
  }

  // Payload too large
  if (message.includes('413') || message.includes('Payload Too Large')) {
    return 'Your prompt is too long. Please shorten your prompt and try again.';
  }

  return message;
}

// Check browser compatibility
function checkBrowserCompatibility() {
  const issues = [];

  // Check for fetch API
  if (!window.fetch) {
    issues.push('Fetch API not supported');
  }

  // Check for Promises
  if (!window.Promise) {
    issues.push('Promises not supported');
  }

  // Check for FormData
  if (!window.FormData) {
    issues.push('FormData not supported');
  }

  // Check for video element
  const video = document.createElement('video');
  if (!video.canPlayType) {
    issues.push('Video playback not supported');
  }

  if (issues.length > 0) {
    showToast('Your browser may have compatibility issues. Consider using a modern browser for the best experience.', 'warning');
    console.warn('Browser compatibility issues:', issues);
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    console.warn('Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;
  toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode === toastContainer) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

// Show success toast
function showSuccess(message) {
  showToast(message, 'success');
}

// Show warning toast
function showWarning(message) {
  showToast(message, 'warning');
}

// Show loading indicator
function showLoading(message = 'Processing...') {
  const loadingIndicator = document.getElementById('loading-indicator');
  const loadingText = document.getElementById('loading-text');

  if (loadingIndicator) {
    if (loadingText) {
      loadingText.textContent = message;
    }
    loadingIndicator.classList.add('active');
  }
}

// Hide loading indicator
function hideLoading() {
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.classList.remove('active');
  }
}

// Show loading state on button
function showButtonLoading(button, loadingText = 'Processing...') {
  if (!button) return;

  button.dataset.originalText = button.textContent;
  button.innerHTML = `<span class="spinner"></span> ${loadingText}`;
  button.disabled = true;
}

// Hide loading state on button
function hideButtonLoading(button) {
  if (!button || !button.dataset.originalText) return;

  button.textContent = button.dataset.originalText;
  button.disabled = false;
  delete button.dataset.originalText;
}

// Show form validation errors with inline messages
function showFormErrors(errors) {
  // Clear all previous errors
  clearFormErrors();

  // Display errors
  for (const [field, message] of Object.entries(errors)) {
    const errorElement = document.getElementById(`${field}-error`);
    const inputElement = document.getElementById(field);

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }

    if (inputElement) {
      inputElement.classList.add('input-error');
    }
  }

  // Scroll to first error
  const firstError = Object.keys(errors)[0];
  const firstErrorElement = document.getElementById(`${firstError}-error`);
  if (firstErrorElement) {
    firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// Clear form errors
function clearFormErrors() {
  const errorElements = document.querySelectorAll('.field-error');
  errorElements.forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });

  const inputElements = document.querySelectorAll('.input-error');
  inputElements.forEach(el => {
    el.classList.remove('input-error');
  });
}

// Validate form with inline error display
function validateFormWithErrors() {
  const errors = {};
  const modelSelect = document.getElementById('model');
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const modelType = selectedOption.dataset.type;

  // Validate API token
  const apiToken = document.getElementById('api-token').value.trim();
  if (!apiToken) {
    errors['api-token'] = 'API token is required';
  }

  // Validate prompt or image URL based on model type
  if (modelType === 'text') {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) {
      errors['prompt'] = 'Prompt is required for text-to-video models';
    } else if (prompt.length > 5000) {
      errors['prompt'] = 'Prompt must be 5000 characters or less';
    }
  } else {
    const imageUrl = document.getElementById('image-url').value.trim();
    if (!imageUrl) {
      errors['image-url'] = 'Image URL is required for image-to-video models';
    } else {
      try {
        new URL(imageUrl);
      } catch (e) {
        errors['image-url'] = 'Please enter a valid image URL';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    showFormErrors(errors);
    return false;
  }

  clearFormErrors();
  return true;
}

// Update status with visual feedback
function updateStatus(message, type = 'info') {
  const statusElement = document.getElementById('processing-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `status status-${type}`;
  }
}

// Make utility functions globally accessible
window.showErrorModal = showErrorModal;
window.getUserFriendlyError = getUserFriendlyError;
window.checkBrowserCompatibility = checkBrowserCompatibility;
window.showToast = showToast;
window.showSuccess = showSuccess;
window.showWarning = showWarning;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showButtonLoading = showButtonLoading;
window.hideButtonLoading = hideButtonLoading;
window.showFormErrors = showFormErrors;
window.clearFormErrors = clearFormErrors;
window.validateFormWithErrors = validateFormWithErrors;
window.updateStatus = updateStatus;