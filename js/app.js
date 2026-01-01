// Venice Video Generator - Main Application

// Model Data - will be populated from API
let MODELS = {
  'text-to-video': [],
  'image-to-video': []
};

// App State
const appState = {
  mode: 'text-to-video',
  selectedModel: null,
  uploadedImage: null,
  uploadedImageUrl: null,
  isProcessing: false,
  queueId: null,
  videoUrl: null,
  videoBlob: null, // Store the blob for download
  selectedDuration: null,
  selectedResolution: null,
  selectedAspectRatio: '16:9',
  modelsLoaded: false,
  customApiKey: null // User's custom API key (if server key expired)
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  // Initialize custom API key from localStorage
  initializeApiKey();

  // Setup prompt counter
  setupPromptCounter();

  // Setup aspect ratio pills
  setupAspectRatioPills();

  // Setup global error handlers
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    showErrorModal(e.error?.message || 'An unexpected error occurred');
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
    showErrorModal(e.reason?.message || 'An unexpected error occurred');
  });

  // Load models automatically (API token is on server or from custom key)
  // Use custom API key if available
  const customKey = getApiKey();
  await loadModels(customKey);

  // Render initial models
  renderModels();

  console.log('Venice Video Generator initialized');
}

// Load models from API
async function loadModels(token) {
  try {
    appState.apiToken = token;
    const api = new VeniceAPI(token);
    const models = await api.getModels();
    
    // Parse models and organize by type
    MODELS['text-to-video'] = [];
    MODELS['image-to-video'] = [];
    
    models.forEach(model => {
      const constraints = model.model_spec?.constraints || {};
      const modelType = constraints.model_type || 'text-to-video';
      const name = model.model_spec?.name || model.id;
      
      // Extract badge from name or id
      let badge = null;
      if (name.toLowerCase().includes('fast') || model.id.includes('fast')) {
        badge = 'fast';
      } else if (name.toLowerCase().includes('full') || model.id.includes('full')) {
        badge = 'full';
      } else if (name.toLowerCase().includes('pro') || model.id.includes('pro')) {
        badge = 'pro';
      }
      
      // Parse durations (convert "5s" to 5)
      const durations = (constraints.durations || []).map(d => parseInt(d.replace('s', '')));
      
      // Get resolutions
      const resolutions = constraints.resolutions || [];
      
      // Get aspect ratios
      const aspectRatios = constraints.aspect_ratios || [];
      
      // Audio support
      const audio = constraints.audio || false;
      
      const modelData = {
        id: model.id,
        name: name,
        badge: badge,
        durations: durations,
        resolutions: resolutions,
        aspectRatios: aspectRatios,
        audio: audio,
        constraints: constraints,
        offline: model.model_spec?.offline || false
      };
      
      if (modelType === 'text-to-video') {
        MODELS['text-to-video'].push(modelData);
      } else if (modelType === 'image-to-video') {
        MODELS['image-to-video'].push(modelData);
      }
    });
    
    appState.modelsLoaded = true;
    renderModels();
    console.log('Models loaded from API:', MODELS);
  } catch (error) {
    console.error('Error loading models:', error);
    showErrorModal('Failed to load models. Please check server configuration and ensure VENICE_API_TOKEN is set in Railway environment variables.');
    appState.modelsLoaded = false;
  }
}

// Mode Switching
function switchMode(mode) {
  appState.mode = mode;
  appState.selectedModel = null;

  // Update mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // Show/hide input sections
  document.getElementById('text-input-section').classList.toggle('hidden', mode !== 'text-to-video');
  document.getElementById('image-input-section').classList.toggle('hidden', mode !== 'image-to-video');

  // Render models for this mode
  renderModels();

  // Reset selected model info
  document.getElementById('selected-model-info').innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Select a model to see details</p>';
}

// Render Models
function renderModels() {
  const grid = document.getElementById('model-grid');
  const models = MODELS[appState.mode] || [];

  if (models.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-xl); color: var(--text-muted);">
        <p style="margin-bottom: var(--space-md);">No models available. Please enter your API token to load models.</p>
        <p style="font-size: 0.9rem;">Models will be automatically loaded when you enter a valid API token.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = models.map(model => {
    const durations = model.durations && model.durations.length > 0 
      ? model.durations.join('s, ') + 's' 
      : 'N/A';
    const resolutions = model.resolutions && model.resolutions.length > 0 
      ? model.resolutions.join(', ') 
      : 'N/A';
    
    return `
      <div class="model-card" data-model-id="${model.id}" onclick="selectModel('${model.id}')">
        <div class="model-header">
          <span class="model-name">${model.name}</span>
          ${model.badge ? `<span class="model-badge ${model.badge}">${model.badge}</span>` : ''}
          ${model.offline ? '<span class="model-badge" style="background: var(--error);">Offline</span>' : ''}
        </div>
        <div class="model-features">
          <span class="feature-tag">
            <svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ${durations}
          </span>
          ${resolutions !== 'N/A' ? `
          <span class="feature-tag">
            <svg viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            ${resolutions}
          </span>
          ` : ''}
          ${model.audio ? '<span class="feature-tag audio"><svg viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>Audio</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Select Model
function selectModel(modelId) {
  const models = MODELS[appState.mode];
  const model = models.find(m => m.id === modelId);

  if (!model) return;

  appState.selectedModel = model;

  // Update UI
  document.querySelectorAll('.model-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.modelId === modelId);
  });

  // Update duration pills (use constraints from API)
  const durations = model.durations && model.durations.length > 0 ? model.durations : [];
  renderDurationPills(durations);

  // Update resolution pills (use constraints from API)
  const resolutions = model.resolutions && model.resolutions.length > 0 ? model.resolutions : [];
  renderResolutionPills(resolutions);

  // Update aspect ratio pills based on model constraints
  updateAspectRatioPills(model.aspectRatios || []);

  // Show/hide audio toggle
  document.getElementById('audio-toggle').classList.toggle('hidden', !model.audio);

  // Update selected model info
  updateSelectedModelInfo(model);
}

// Update aspect ratio pills based on model constraints
function updateAspectRatioPills(availableRatios) {
  const allRatios = ['16:9', '9:16', '1:1'];
  const ratioPills = document.querySelectorAll('[data-ratio]');
  
  ratioPills.forEach(pill => {
    const ratio = pill.dataset.ratio;
    // If model has specific aspect ratios, only show those
    // If empty array, show all (model doesn't restrict)
    if (availableRatios.length > 0 && !availableRatios.includes(ratio)) {
      pill.style.display = 'none';
    } else {
      pill.style.display = 'inline-block';
    }
  });
  
  // If model requires specific aspect ratios and current selection isn't valid, change it
  if (availableRatios.length > 0 && !availableRatios.includes(appState.selectedAspectRatio)) {
    appState.selectedAspectRatio = availableRatios[0];
    ratioPills.forEach(p => {
      p.classList.toggle('selected', p.dataset.ratio === appState.selectedAspectRatio);
    });
  }
}

// Render Duration Pills
function renderDurationPills(durations) {
  const container = document.getElementById('duration-pills');
  if (!durations || durations.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No duration options available</p>';
    appState.selectedDuration = null;
    return;
  }
  container.innerHTML = durations.map((d, i) => `
    <button type="button" class="param-pill ${i === 0 ? 'selected' : ''}" data-duration="${d}" onclick="selectDuration(${d})">${d}s</button>
  `).join('');
  appState.selectedDuration = durations[0];
}

// Render Resolution Pills
function renderResolutionPills(resolutions) {
  const container = document.getElementById('resolution-pills');
  if (!resolutions || resolutions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">No resolution options available</p>';
    appState.selectedResolution = null;
    return;
  }
  container.innerHTML = resolutions.map((r, i) => `
    <button type="button" class="param-pill ${i === 0 ? 'selected' : ''}" data-resolution="${r}" onclick="selectResolution('${r}')">${r}</button>
  `).join('');
  appState.selectedResolution = resolutions[0];
}

// Select Duration
function selectDuration(duration) {
  appState.selectedDuration = duration;
  document.querySelectorAll('#duration-pills .param-pill').forEach(pill => {
    pill.classList.toggle('selected', parseInt(pill.dataset.duration) === duration);
  });
}

// Select Resolution
function selectResolution(resolution) {
  appState.selectedResolution = resolution;
  document.querySelectorAll('#resolution-pills .param-pill').forEach(pill => {
    pill.classList.toggle('selected', pill.dataset.resolution === resolution);
  });
}

// Setup Aspect Ratio Pills
function setupAspectRatioPills() {
  document.querySelectorAll('[data-ratio]').forEach(pill => {
    pill.addEventListener('click', () => {
      appState.selectedAspectRatio = pill.dataset.ratio;
      document.querySelectorAll('[data-ratio]').forEach(p => {
        p.classList.toggle('selected', p.dataset.ratio === pill.dataset.ratio);
      });
    });
  });
}

// Update Selected Model Info
function updateSelectedModelInfo(model) {
  const container = document.getElementById('selected-model-info');
  container.innerHTML = `
    <div style="margin-bottom: var(--space-md);">
      <h4 style="font-family: var(--font-display); font-size: 1.1rem; margin-bottom: var(--space-xs);">${model.name}</h4>
      <p style="font-size: 0.8rem; color: var(--text-muted);">${model.id}</p>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
      <span class="feature-tag">Duration: ${model.durations.join(', ')}s</span>
      <span class="feature-tag">Resolution: ${model.resolutions.join(', ')}</span>
      ${model.audio ? '<span class="feature-tag audio">Audio Supported</span>' : ''}
    </div>
  `;
}

// Setup Prompt Counter
function setupPromptCounter() {
  const textarea = document.getElementById('prompt');
  const counter = document.getElementById('prompt-counter');

  if (textarea && counter) {
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      counter.textContent = `${len} / 5000`;
      counter.classList.toggle('near-limit', len > 4500 && len <= 5000);
      counter.classList.toggle('over-limit', len > 5000);
    });
  }

  // Models are loaded automatically on initialization (no token input needed)
}

// Toggle Token Visibility - REMOVED (API token is now on server)

// Image Upload Handlers
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('upload-zone').classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('upload-zone').classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById('upload-zone').classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processImageFile(files[0]);
  }
}

function handleImageUpload(e) {
  const files = e.target.files;
  if (files.length > 0) {
    processImageFile(files[0]);
  }
}

async function processImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file', 'error');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('Image must be less than 10MB', 'error');
    return;
  }

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    document.getElementById('upload-content').style.display = 'none';
    document.getElementById('upload-preview').style.display = 'block';
    document.getElementById('preview-image').src = dataUrl;
    document.getElementById('upload-zone').classList.add('has-image');
    document.getElementById('image-url').value = '';
  };
  reader.readAsDataURL(file);

  // Upload image to hosting service to get a URL (don't send base64 to API)
  try {
    showToast('Uploading image to hosting service...', 'info');
    const imageUrl = await uploadImageToHosting(file);
    
    if (imageUrl) {
      appState.uploadedImageUrl = imageUrl;
      appState.uploadedImage = null; // Don't store base64 - it's too large
      showToast('Image uploaded successfully!', 'success');
    } else {
      throw new Error('Failed to upload image');
    }
  } catch (error) {
    console.error('Image upload error:', error);
    showToast('Failed to upload image. Please provide an image URL instead, or try again.', 'error');
    // Clear the uploaded URL so user knows it didn't work
    appState.uploadedImageUrl = null;
    appState.uploadedImage = null;
  }
}

// Upload image to a free hosting service
// Using imgbb.com - free image hosting
async function uploadImageToHosting(file) {
  // Convert file to base64 for imgbb API
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove data:image/...;base64, prefix
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const apiKey = 'feba2c30115b4e434ddee77d34147f4a';

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `image=${encodeURIComponent(base64)}`
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Upload failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.success && data.data && data.data.url) {
      return data.data.url;
    } else {
      throw new Error('Invalid response from image hosting');
    }
  } catch (error) {
    console.error('Image hosting error:', error);
    throw error;
  }
}

function removeImage(e) {
  e.stopPropagation();
  appState.uploadedImage = null;

  document.getElementById('upload-content').style.display = 'block';
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('preview-image').src = '';
  document.getElementById('upload-zone').classList.remove('has-image');
  document.getElementById('image-upload').value = '';
}

// Validation
function validateForm() {
  const errors = {};

  if (!appState.selectedModel) {
    showToast('Please select a model', 'warning');
    return false;
  }

  if (appState.mode === 'text-to-video') {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) {
      errors['prompt'] = 'Prompt is required';
    } else if (prompt.length > 5000) {
      errors['prompt'] = 'Prompt must be 5000 characters or less';
    }
  } else {
    const imageUrl = document.getElementById('image-url').value.trim();
    if (!appState.uploadedImageUrl && !imageUrl) {
      errors['image-url'] = 'Please upload an image or provide a URL';
    }
    // Also check for motion prompt (required for image-to-video)
    const motionPrompt = document.getElementById('motion-prompt').value.trim();
    if (!motionPrompt) {
      errors['motion-prompt'] = 'Motion prompt is required for image-to-video';
    }
  }

  // Show errors
  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = document.getElementById(`${field}-error`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
    const inputEl = document.getElementById(field);
    if (inputEl) {
      inputEl.classList.add('input-error');
    }
  });

  // Clear errors on input
  document.querySelectorAll('.form-input, .form-textarea').forEach(input => {
    input.addEventListener('input', () => {
      input.classList.remove('input-error');
      const errorEl = document.getElementById(`${input.id}-error`);
      if (errorEl) {
        errorEl.style.display = 'none';
      }
    }, { once: true });
  });

  return Object.keys(errors).length === 0;
}

// Generate Video
async function handleGenerate() {
  if (!validateForm()) return;

  const generateBtn = document.getElementById('generate-btn');

  try {
    // Show loading
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> Submitting...';
    showLoading('Submitting video generation request...');

    // Build parameters - start with required fields
    const params = {
      model: appState.selectedModel.id,
      modelConstraints: appState.selectedModel.constraints // Pass constraints for validation
    };

    // Add aspect ratio only if model supports it
    const modelAspectRatios = appState.selectedModel.aspectRatios || [];
    if (modelAspectRatios.length > 0) {
      // Model supports aspect ratios - use selected one or first available
      if (modelAspectRatios.includes(appState.selectedAspectRatio)) {
        params.aspect_ratio = appState.selectedAspectRatio;
      } else {
        params.aspect_ratio = modelAspectRatios[0];
      }
    }
    // If model doesn't support aspect_ratio (empty array), don't include it

    // Add duration if valid (will be converted to "5s" format in API)
    if (appState.selectedDuration) {
      params.duration = appState.selectedDuration;
    }

    // Add prompt for text-to-video
    if (appState.mode === 'text-to-video') {
      const prompt = document.getElementById('prompt').value.trim();
      if (!prompt) {
        showToast('Please enter a prompt', 'error');
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';
        hideLoading();
        return;
      }
      params.prompt = prompt;
    } else {
      // For image-to-video, we need to handle the image
      const imageUrl = document.getElementById('image-url').value.trim();
      if (imageUrl) {
        params.image_url = imageUrl;
      } else if (appState.uploadedImageUrl) {
        // Use the uploaded image URL (from hosting service)
        params.image_url = appState.uploadedImageUrl;
      } else {
        // No image provided
        hideLoading();
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';
        showToast('Please upload an image or provide an image URL', 'error');
        return;
      }

      // Prompt is REQUIRED for image-to-video models too
      const motionPrompt = document.getElementById('motion-prompt').value.trim();
      if (!motionPrompt) {
        showToast('Please enter a motion prompt (describes how the image should move)', 'error');
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';
        hideLoading();
        return;
      }
      params.prompt = motionPrompt;
    }

    // Add resolution if selected (optional parameter)
    if (appState.selectedResolution) {
      params.resolution = appState.selectedResolution;
    }

    // Create API instance with custom key if available
    const customKey = getApiKey();
    const api = new VeniceAPI(customKey);
    const response = await api.queue(params);

    if (!response.queue_id) {
      throw new Error('Failed to get queue_id from API response');
    }

    appState.queueId = response.queue_id;
    appState.isProcessing = true;

    hideLoading();
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';

    showToast('Video generation started!', 'success');

    // Show progress section
    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('queue-id').textContent = response.queue_id.substring(0, 8) + '...';

    console.log('Starting polling with queue_id:', response.queue_id, 'model:', response.model);

    // Wait a few seconds before first poll to give the queue time to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Start polling - pass model ID as well since API requires it
    pollForCompletion(api, response.queue_id, response.model || appState.selectedModel?.id);

  } catch (error) {
    console.error('Generation error:', error);
    hideLoading();
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';
    showErrorModal(error.message);
  }
}

// Poll for Completion
async function pollForCompletion(api, queueId, modelId = null) {
  const pollInterval = 10000; // 10 seconds
  const maxAttempts = 120; // 20 minutes max

  // Wait a few seconds before first poll to give the queue time to process
  await new Promise(resolve => setTimeout(resolve, 3000));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!appState.isProcessing) {
      console.log('Polling cancelled');
      return;
    }

    try {
      console.log(`Polling attempt ${attempt + 1} for queue_id: ${queueId}, model: ${modelId}`);
      const status = await api.retrieve(queueId, modelId);

      // Update progress UI
      document.getElementById('progress-fill').style.width = `${status.progress}%`;
      document.getElementById('progress-value').textContent = `${status.progress}%`;

      if (status.estimated_time_remaining) {
        const mins = Math.floor(status.estimated_time_remaining / 60);
        const secs = Math.round(status.estimated_time_remaining % 60);
        document.getElementById('time-remaining').textContent = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      }

      if (status.status === 'completed' && status.video_url) {
        // Success!
        appState.videoUrl = status.video_url;
        appState.videoBlob = status.video_blob; // Store blob for download
        appState.isProcessing = false;

        document.getElementById('status-badge').className = 'status-badge status-success';
        document.getElementById('status-badge').textContent = 'Completed';
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('progress-value').textContent = '100%';

        // Show video section
        document.getElementById('video-section').classList.remove('hidden');
        const videoPlayer = document.getElementById('video-player');
        
        // Set video source - use blob URL
        if (status.video_url && status.video_url.startsWith('blob:')) {
          videoPlayer.src = status.video_url;
        } else if (status.video_blob) {
          // Create blob URL if not already created
          const blobUrl = URL.createObjectURL(status.video_blob);
          videoPlayer.src = blobUrl;
          appState.videoUrl = blobUrl; // Update stored URL
        }

        // Handle video load errors - but don't show error modal for CSP issues
        // The video can still be downloaded even if it can't be displayed
        videoPlayer.onerror = (e) => {
          console.error('Video load error:', e);
          // Check if it's a CSP error
          const errorMsg = e.message || '';
          if (errorMsg.includes('Content Security Policy') || errorMsg.includes('CSP')) {
            console.warn('CSP blocking video playback, but video is available for download');
            // Don't show error modal for CSP issues - video can still be downloaded
          } else {
            showErrorModal('Failed to load video. You can still download it using the Download button.');
          }
        };
        
        // Also listen for loadeddata event to confirm video loaded successfully
        videoPlayer.onloadeddata = () => {
          console.log('Video loaded successfully');
        };

        showToast('Video generated successfully!', 'success');
        return;
      }

      if (status.status === 'failed') {
        throw new Error('Video generation failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      console.error('Polling error:', error);
      
      // If it's a 404 error and we're in early attempts, retry after a longer delay
      if (error.message.includes('Not Found') && attempt < 5) {
        console.log('Queue ID not found yet, retrying after longer delay...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        continue; // Retry
      }
      
      // For other errors or after retries, show error
      appState.isProcessing = false;
      document.getElementById('status-badge').className = 'status-badge status-error';
      document.getElementById('status-badge').textContent = 'Error';
      showErrorModal(error.message);
      return;
    }
  }

  // Timeout
  appState.isProcessing = false;
  showErrorModal('Video generation timed out. Please try again.');
}

// Handle Estimate
async function handleEstimate() {
  if (!validateForm()) return;

  const estimateBtn = document.getElementById('estimate-btn');

  try {
    estimateBtn.disabled = true;
    estimateBtn.innerHTML = '<span class="spinner"></span> Calculating...';

    // Build parameters - start with required fields
    const params = {
      model: appState.selectedModel.id,
      modelConstraints: appState.selectedModel.constraints // Pass constraints for validation
    };

    // Add aspect ratio ONLY if model supports it (has aspect_ratios in constraints)
    const modelAspectRatios = appState.selectedModel.aspectRatios || [];
    if (modelAspectRatios.length > 0) {
      // Model supports aspect ratios - use selected one or first available
      if (modelAspectRatios.includes(appState.selectedAspectRatio)) {
        params.aspect_ratio = appState.selectedAspectRatio;
      } else {
        params.aspect_ratio = modelAspectRatios[0];
      }
    }
    // If model doesn't support aspect_ratio (empty array), don't include it at all

    // Add duration if valid (will be converted to "5s" format in API)
    if (appState.selectedDuration) {
      params.duration = appState.selectedDuration;
    }

    if (appState.mode === 'text-to-video') {
      const prompt = document.getElementById('prompt').value.trim();
      if (!prompt) {
        showToast('Please enter a prompt', 'error');
        estimateBtn.disabled = false;
        estimateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Estimate Cost';
        return;
      }
      params.prompt = prompt;
    } else {
      // For image-to-video
      const imageUrl = document.getElementById('image-url').value.trim();
      if (imageUrl) {
        params.image_url = imageUrl;
      } else if (appState.uploadedImageUrl) {
        // Use the uploaded image URL (from hosting service)
        params.image_url = appState.uploadedImageUrl;
      } else {
        showToast('Please upload an image or provide an image URL', 'error');
        estimateBtn.disabled = false;
        estimateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Estimate Cost';
        return;
      }
      const motionPrompt = document.getElementById('motion-prompt').value.trim();
      if (motionPrompt) {
        params.prompt = motionPrompt;
      }
    }

    // Add resolution if selected (optional parameter)
    if (appState.selectedResolution) {
      params.resolution = appState.selectedResolution;
    }

    // Create API instance with custom key if available
    const customKey = getApiKey();
    const api = new VeniceAPI(customKey);
    const quote = await api.quote(params);

    estimateBtn.disabled = false;
    estimateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Estimate Cost';

    // Show cost modal
    showCostModal(quote);

  } catch (error) {
    console.error('Quote error:', error);
    estimateBtn.disabled = false;
    estimateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Estimate Cost';
    showErrorModal(error.message);
  }
}

// Show Cost Modal
function showCostModal(quote) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'cost-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Cost Estimate</h3>
      <div class="cost-details">
        <p><strong>Estimated Cost:</strong> <span>$${quote.estimated_cost || 'N/A'}</span></p>
        <p><strong>Credits Required:</strong> <span>${quote.credits_required || 'N/A'}</span></p>
      </div>
      <button class="btn btn-primary" onclick="document.getElementById('cost-modal').remove()">OK</button>
    </div>
  `;
  document.body.appendChild(modal);
}

// Handle Cancel
function handleCancel() {
  appState.isProcessing = false;
  appState.queueId = null;

  document.getElementById('progress-section').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-value').textContent = '0%';
  document.getElementById('status-badge').className = 'status-badge status-processing';
  document.getElementById('status-badge').textContent = 'Processing';

  showToast('Generation cancelled', 'warning');
}

// Handle Download
function handleDownload() {
  if (!appState.videoUrl) {
    showToast('No video available', 'error');
    return;
  }

  const link = document.createElement('a');
  link.href = appState.videoUrl;
  link.download = `venice-video-${Date.now()}.mp4`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Download started!', 'success');
}

// Handle New Generation
function handleNewGeneration() {
  appState.isProcessing = false;
  appState.queueId = null;
  
  // Clean up blob URLs to prevent memory leaks
  if (appState.videoUrl && appState.videoUrl.startsWith('blob:')) {
    URL.revokeObjectURL(appState.videoUrl);
  }
  
  appState.videoUrl = null;
  appState.videoBlob = null;

  document.getElementById('progress-section').classList.add('hidden');
  document.getElementById('video-section').classList.add('hidden');
  const videoPlayer = document.getElementById('video-player');
  videoPlayer.src = '';
  videoPlayer.onerror = null; // Clear error handler
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-value').textContent = '0%';
  document.getElementById('status-badge').className = 'status-badge status-processing';
  document.getElementById('status-badge').textContent = 'Processing';
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    error: '<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    warning: '<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>',
    info: '<path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
  };

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24">${icons[type]}</svg>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Loading Indicator
function showLoading(message = 'Processing...') {
  document.getElementById('loading-text').textContent = message;
  document.getElementById('loading-indicator').classList.add('active');
}

function hideLoading() {
  document.getElementById('loading-indicator').classList.remove('active');
}

// Error Modal
function showErrorModal(message) {
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-modal').classList.add('active');
}

function closeErrorModal() {
  document.getElementById('error-modal').classList.remove('active');
}

// API Key Management
function toggleApiKeySection() {
  const section = document.getElementById('api-key-section');
  const toggle = document.querySelector('.api-key-toggle');

  section.classList.toggle('hidden');
  toggle.classList.toggle('active');

  // Load saved API key if exists
  const savedKey = localStorage.getItem('venice_api_key');
  if (savedKey) {
    document.getElementById('api-key-input').value = savedKey;
    updateApiKeyStatus('Custom API key is active', 'using-custom');
  } else {
    updateApiKeyStatus('Enter your Venice API key to use your own account', 'info');
  }
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  const eyeIcon = document.getElementById('eye-icon');

  if (input.type === 'password') {
    input.type = 'text';
    eyeIcon.innerHTML = '<path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>';
  } else {
    input.type = 'password';
    eyeIcon.innerHTML = '<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
  }
}

async function saveApiKey() {
  const input = document.getElementById('api-key-input');
  const apiKey = input.value.trim();

  if (!apiKey) {
    // Clear the saved key
    localStorage.removeItem('venice_api_key');
    appState.customApiKey = null;
    updateApiKeyStatus('Custom API key cleared. Using server key.', 'success');
    showToast('API key cleared', 'info');
    // Reload models with server key (no custom key)
    await loadModels(null);
    return;
  }

  // Validate key format (basic check - Venice API keys typically start with 'vn-' or are long strings)
  if (apiKey.length < 20) {
    updateApiKeyStatus('Invalid API key format (too short)', 'error');
    showToast('Invalid API key format', 'error');
    return;
  }

  // Save to localStorage
  localStorage.setItem('venice_api_key', apiKey);
  appState.customApiKey = apiKey;
  updateApiKeyStatus('Custom API key saved! Reloading models...', 'success');
  showToast('API key saved successfully', 'success');

  // Reload models with new key
  try {
    await loadModels(apiKey);
    updateApiKeyStatus('Custom API key active!', 'using-custom');
  } catch (error) {
    updateApiKeyStatus('Failed to load models with this key. Please check your API key.', 'error');
    showToast('Failed to validate API key', 'error');
  }
}

function updateApiKeyStatus(message, type) {
  const status = document.getElementById('api-key-status');
  if (message) {
    status.textContent = message;
    status.className = 'api-key-status ' + (type || 'info');
    status.style.display = 'flex';
  } else {
    status.style.display = 'none';
  }
}

function getApiKey() {
  // Return custom key if set, otherwise null (server will use its key)
  return appState.customApiKey || localStorage.getItem('venice_api_key') || null;
}

// Initialize custom API key on load
function initializeApiKey() {
  const savedKey = localStorage.getItem('venice_api_key');
  if (savedKey) {
    appState.customApiKey = savedKey;
  }
}

// Make functions globally accessible
window.switchMode = switchMode;
window.selectModel = selectModel;
window.selectDuration = selectDuration;
window.selectResolution = selectResolution;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleDrop = handleDrop;
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;
window.handleGenerate = handleGenerate;
window.handleEstimate = handleEstimate;
window.handleCancel = handleCancel;
window.handleDownload = handleDownload;
window.handleNewGeneration = handleNewGeneration;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showErrorModal = showErrorModal;
window.closeErrorModal = closeErrorModal;
window.toggleApiKeySection = toggleApiKeySection;
window.toggleApiKeyVisibility = toggleApiKeyVisibility;
window.saveApiKey = saveApiKey;
window.getApiKey = getApiKey;
