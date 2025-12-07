 // UI Components for Venice Video API app

// Parameter Input Section Component
function createParameterInputSection() {
  const container = document.getElementById('input');
  if (!container) return;

  // All 29 Venice models from the documentation
  const veniceModels = [
    // Text-to-Video Models
    { id: 'veo3-fast-text-to-video', name: 'Veo3 Fast Text-to-Video', type: 'text', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3-full-text-to-video', name: 'Veo3 Full Text-to-Video', type: 'text', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-fast-text-to-video', name: 'Veo3.1 Fast Text-to-Video', type: 'text', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-full-text-to-video', name: 'Veo3.1 Full Text-to-Video', type: 'text', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'sora-2-text-to-video', name: 'Sora 2 Text-to-Video', type: 'text', maxDuration: 12, resolutions: ['720p'], audio: true },
    { id: 'sora-2-pro-text-to-video', name: 'Sora 2 Pro Text-to-Video', type: 'text', maxDuration: 12, resolutions: ['1080p'], audio: true },
    { id: 'wan-2.5-preview-text-to-video', name: 'WAN 2.5 Preview Text-to-Video', type: 'text', maxDuration: 10, resolutions: ['480p'], audio: true },
    { id: 'wan-2.2-a14b-text-to-video', name: 'WAN 2.2 A14B Text-to-Video', type: 'text', maxDuration: 5, resolutions: ['480p'], audio: false },
    { id: 'kling-2.6-pro-text-to-video', name: 'Kling 2.6 Pro Text-to-Video', type: 'text', maxDuration: 10, resolutions: ['720p', '1080p'], audio: true },
    { id: 'kling-2.5-turbo-pro-text-to-video', name: 'Kling 2.5 Turbo Pro Text-to-Video', type: 'text', maxDuration: 10, resolutions: ['720p', '1080p'], audio: false },
    { id: 'ltx-2-fast-text-to-video', name: 'LTX 2 Fast Text-to-Video', type: 'text', maxDuration: 20, resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'ltx-2-full-text-to-video', name: 'LTX 2 Full Text-to-Video', type: 'text', maxDuration: 10, resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'longcat-distilled-text-to-video', name: 'Longcat Distilled Text-to-Video', type: 'text', maxDuration: 30, resolutions: ['720p'], audio: false },
    { id: 'longcat-text-to-video', name: 'Longcat Text-to-Video', type: 'text', maxDuration: 30, resolutions: ['720p'], audio: false },
    
    // Image-to-Video Models
    { id: 'veo3-fast-image-to-video', name: 'Veo3 Fast Image-to-Video', type: 'image', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3-full-image-to-video', name: 'Veo3 Full Image-to-Video', type: 'image', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-fast-image-to-video', name: 'Veo3.1 Fast Image-to-Video', type: 'image', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-full-image-to-video', name: 'Veo3.1 Full Image-to-Video', type: 'image', maxDuration: 8, resolutions: ['720p', '1080p'], audio: true },
    { id: 'sora-2-image-to-video', name: 'Sora 2 Image-to-Video', type: 'image', maxDuration: 12, resolutions: ['720p'], audio: true },
    { id: 'sora-2-pro-image-to-video', name: 'Sora 2 Pro Image-to-Video', type: 'image', maxDuration: 12, resolutions: ['1080p'], audio: true },
    { id: 'wan-2.5-preview-image-to-video', name: 'WAN 2.5 Preview Image-to-Video', type: 'image', maxDuration: 10, resolutions: ['480p'], audio: true },
    { id: 'wan-2.1-pro-image-to-video', name: 'WAN 2.1 Pro Image-to-Video', type: 'image', maxDuration: 6, resolutions: ['720p'], audio: false },
    { id: 'kling-2.6-pro-image-to-video', name: 'Kling 2.6 Pro Image-to-Video', type: 'image', maxDuration: 10, resolutions: ['720p', '1080p'], audio: true },
    { id: 'kling-2.5-turbo-pro-image-to-video', name: 'Kling 2.5 Turbo Pro Image-to-Video', type: 'image', maxDuration: 10, resolutions: ['720p', '1080p'], audio: false },
    { id: 'ltx-2-fast-image-to-video', name: 'LTX 2 Fast Image-to-Video', type: 'image', maxDuration: 20, resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'ltx-2-full-image-to-video', name: 'LTX 2 Full Image-to-Video', type: 'image', maxDuration: 10, resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'longcat-distilled-image-to-video', name: 'Longcat Distilled Image-to-Video', type: 'image', maxDuration: 30, resolutions: ['720p'], audio: false },
    { id: 'longcat-image-to-video', name: 'Longcat Image-to-Video', type: 'image', maxDuration: 30, resolutions: ['720p'], audio: false },
    { id: 'ovi-image-to-video', name: 'OVI Image-to-Video', type: 'image', maxDuration: 5, resolutions: ['720p'], audio: true }
  ];

  // Aspect ratio options
  const aspectRatios = [
    { value: '16:9', label: '16:9 (Widescreen)' },
    { value: '9:16', label: '9:16 (Vertical)' },
    { value: '1:1', label: '1:1 (Square)' },
    { value: '4:3', label: '4:3 (Standard)' },
    { value: '21:9', label: '21:9 (Ultrawide)' }
  ];

  container.innerHTML = `
    <form id="video-form" novalidate>
      <fieldset>
        <legend>Video Parameters</legend>

        <label for="api-token">API Token</label>
        <input type="password" id="api-token" name="api-token" placeholder="Enter your Venice API token" required aria-describedby="api-token-error">
        <div id="api-token-error" class="field-error" role="alert"></div>

        <label for="model">Model</label>
        <select id="model" name="model" required>
          ${veniceModels.map(model => `<option value="${model.id}" data-type="${model.type}" data-max-duration="${model.maxDuration}" data-resolutions='${JSON.stringify(model.resolutions)}' data-audio="${model.audio}">${model.name}</option>`).join('')}
        </select>

        <div id="prompt-input-container">
          <label for="prompt">Prompt</label>
          <textarea id="prompt" name="prompt" rows="4" placeholder="Describe the video you want to generate..." aria-describedby="prompt-error prompt-counter"></textarea>
          <div class="prompt-info">
            <span id="prompt-counter" class="prompt-counter">0 / 5000</span>
          </div>
          <div id="prompt-error" class="field-error" role="alert"></div>
        </div>

        <div id="image-url-container" style="display: none;">
          <label for="image-url">Image URL</label>
          <input type="url" id="image-url" name="image-url" placeholder="Enter image URL for image-to-video models" aria-describedby="image-url-error">
          <div id="image-url-error" class="field-error" role="alert"></div>
        </div>

        <label for="duration">Duration (seconds)</label>
        <select id="duration" name="duration">
          <option value="4">4 seconds</option>
          <option value="5">5 seconds</option>
          <option value="6">6 seconds</option>
          <option value="8">8 seconds</option>
          <option value="10">10 seconds</option>
          <option value="12">12 seconds</option>
          <option value="15">15 seconds</option>
          <option value="20">20 seconds</option>
          <option value="25">25 seconds</option>
          <option value="30">30 seconds</option>
        </select>

        <label for="aspect-ratio">Aspect Ratio</label>
        <select id="aspect-ratio" name="aspect-ratio">
          ${aspectRatios.map(ratio => `<option value="${ratio.value}">${ratio.label}</option>`).join('')}
        </select>

        <label for="resolution">Resolution</label>
        <select id="resolution" name="resolution">
          <option value="720p">720p (HD)</option>
          <option value="1080p">1080p (Full HD)</option>
          <option value="2160p">2160p (4K)</option>
        </select>

        <div id="audio-toggle-container" style="display: none;">
          <label class="checkbox-label">
            <input type="checkbox" id="audio" name="audio">
            Generate with Audio
          </label>
        </div>

        <label class="checkbox-label">
          <input type="checkbox" id="auto-delete" name="auto-delete" checked>
          Auto-delete after download
        </label>

        <label class="checkbox-label">
          <input type="checkbox" id="save-token" name="save-token">
          Remember API token
        </label>

        <div class="button-group">
          <button type="submit" id="generate-btn">Generate Video</button>
          <button type="button" id="cost-estimate-btn">Estimate Cost</button>
        </div>
      </fieldset>
    </form>
  `;

  // Add event listeners for dynamic behavior
  const modelSelect = document.getElementById('model');
  const promptContainer = document.getElementById('prompt-input-container');
  const imageUrlContainer = document.getElementById('image-url-container');
  const audioToggleContainer = document.getElementById('audio-toggle-container');
  const durationSelect = document.getElementById('duration');
  
  // Handle model change to show appropriate input fields
  modelSelect.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
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
  });
  
  // Trigger initial change to set correct UI state
  modelSelect.dispatchEvent(new Event('change'));

  // Add prompt character counter
  const promptTextarea = document.getElementById('prompt');
  const promptCounter = document.getElementById('prompt-counter');

  if (promptTextarea && promptCounter) {
    promptTextarea.addEventListener('input', function() {
      const length = this.value.length;
      promptCounter.textContent = `${length} / 5000`;

      if (length > 5000) {
        promptCounter.classList.add('over-limit');
      } else if (length > 4500) {
        promptCounter.classList.add('near-limit');
        promptCounter.classList.remove('over-limit');
      } else {
        promptCounter.classList.remove('near-limit', 'over-limit');
      }
    });
  }

  // Load saved API token if available
  if (typeof loadSavedApiToken === 'function') {
    loadSavedApiToken();
  }

  // Handle save token checkbox
  const saveTokenCheckbox = document.getElementById('save-token');
  const apiTokenInput = document.getElementById('api-token');

  if (saveTokenCheckbox && apiTokenInput) {
    // Check if token is already saved
    const savedToken = typeof getApiToken === 'function' ? getApiToken() : '';
    if (savedToken) {
      saveTokenCheckbox.checked = true;
    }

    // Save token when form is submitted or on blur
    apiTokenInput.addEventListener('blur', function() {
      if (saveTokenCheckbox.checked && this.value) {
        if (typeof saveApiToken === 'function') {
          saveApiToken(this.value);
        }
      }
    });

    // Clear token when unchecked
    saveTokenCheckbox.addEventListener('change', function() {
      if (!this.checked) {
        if (typeof clearApiToken === 'function') {
          clearApiToken();
        }
      } else if (apiTokenInput.value) {
        if (typeof saveApiToken === 'function') {
          saveApiToken(apiTokenInput.value);
        }
      }
    });
  }

  // Clear field error on input
  const formInputs = document.querySelectorAll('#video-form input, #video-form textarea');
  formInputs.forEach(input => {
    input.addEventListener('input', function() {
      this.classList.remove('input-error');
      const errorElement = document.getElementById(`${this.id}-error`);
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
      }
    });
  });
}

// Processing Status Section Component
function createProcessingStatusSection() {
  const container = document.getElementById('processing');
  if (!container) return;

  container.innerHTML = `
    <div class="processing-container">
      <h3>Processing Status</h3>
      
      <div class="queue-info">
        <p>Queue ID: <span id="queue-id">-</span></p>
        <p>Status: <span id="processing-status">Not started</span></p>
      </div>
      
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" id="progress-fill"></div>
        </div>
        <div class="progress-text" id="progress-text">Waiting to start...</div>
      </div>
      
      <div class="time-remaining">
        <p>Estimated time remaining: <span id="time-remaining">-</span></p>
      </div>
      
      <button id="cancel-btn" class="cancel-button">Cancel Processing</button>
    </div>
  `;
}

// Video Display Section Component
function createVideoDisplaySection() {
  const container = document.getElementById('video');
  if (!container) return;

  container.innerHTML = `
    <div class="video-display-container">
      <h3>Generated Video</h3>
      
      <div class="video-player-container">
        <div id="video-player-placeholder" class="video-placeholder">
          <p>Generated video will appear here</p>
        </div>
        <div id="video-player-wrapper" style="display: none;">
          <video id="video-player" controls></video>
        </div>
      </div>
      
      <div id="video-metadata" class="video-metadata" style="display: none;">
        <h4 id="video-title"></h4>
        <p>Duration: <span id="video-duration"></span></p>
        <p>Resolution: <span id="video-resolution"></span></p>
        <p>Model: <span id="video-model"></span></p>
      </div>
      
      <div class="video-actions">
        <button id="download-btn" class="download-button">Download Video</button>
        <button id="new-generation-btn" class="new-generation-button">Generate New Video</button>
      </div>
    </div>
  `;
}

// Tab Navigation Component
function createTabNavigation() {
  const container = document.querySelector('.tab-navigation');
  if (!container) return;

  container.innerHTML = `
    <li class="tab active" data-tab="input">Input Parameters</li>
    <li class="tab" data-tab="processing">Processing Status</li>
    <li class="tab" data-tab="video">Video Display</li>
  `;
  
  // Add event listeners for tab navigation
  const tabs = container.querySelectorAll('.tab');
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

// Error Modal Component
function createErrorModal() {
  // Remove existing modal if present
  const existingModal = document.getElementById('error-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.className = 'error-modal';
  modal.id = 'error-modal';
  
  modal.innerHTML = `
    <div class="error-content">
      <h3>Error</h3>
      <p id="error-message"></p>
      <button id="close-error" class="close-button">Close</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listener to close button
  document.getElementById('close-error').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  
  // Close modal when clicking outside content
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

// Initialize all components
function initializeComponents() {
  createParameterInputSection();
  createProcessingStatusSection();
  createVideoDisplaySection();
  createTabNavigation();
  createErrorModal();
}

// Make components globally accessible
window.createParameterInputSection = createParameterInputSection;
window.createProcessingStatusSection = createProcessingStatusSection;
window.createVideoDisplaySection = createVideoDisplaySection;
window.createTabNavigation = createTabNavigation;
window.createErrorModal = createErrorModal;
window.initializeComponents = initializeComponents;