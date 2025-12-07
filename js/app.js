// Venice Video Generator - Main Application

// Model Data
const MODELS = {
  'text-to-video': [
    { id: 'veo3-fast-text-to-video', name: 'Veo3 Fast', badge: 'fast', durations: [4, 6, 8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3-full-text-to-video', name: 'Veo3 Full', badge: 'full', durations: [4, 6, 8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-fast-text-to-video', name: 'Veo3.1 Fast', badge: 'fast', durations: [4, 6, 8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-full-text-to-video', name: 'Veo3.1 Full', badge: 'full', durations: [4, 6, 8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'sora-2-text-to-video', name: 'Sora 2', badge: null, durations: [4, 6, 8, 10, 12], resolutions: ['720p'], audio: true },
    { id: 'sora-2-pro-text-to-video', name: 'Sora 2 Pro', badge: 'pro', durations: [4, 6, 8, 10, 12], resolutions: ['1080p'], audio: true },
    { id: 'kling-2.6-pro-text-to-video', name: 'Kling 2.6 Pro', badge: 'pro', durations: [5, 10], resolutions: ['720p', '1080p'], audio: true },
    { id: 'kling-2.5-turbo-pro-text-to-video', name: 'Kling 2.5 Turbo', badge: 'fast', durations: [5, 10], resolutions: ['720p', '1080p'], audio: false },
    { id: 'ltx-2-fast-text-to-video', name: 'LTX 2 Fast', badge: 'fast', durations: [6, 10, 15, 20], resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'ltx-2-full-text-to-video', name: 'LTX 2 Full', badge: 'full', durations: [6, 10], resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'wan-2.5-preview-text-to-video', name: 'WAN 2.5', badge: null, durations: [5, 10], resolutions: ['480p'], audio: true },
    { id: 'wan-2.2-a14b-text-to-video', name: 'WAN 2.2', badge: null, durations: [5], resolutions: ['480p'], audio: false },
    { id: 'longcat-distilled-text-to-video', name: 'Longcat Distilled', badge: 'fast', durations: [5, 10, 15, 20, 25, 30], resolutions: ['720p'], audio: false },
    { id: 'longcat-text-to-video', name: 'Longcat', badge: null, durations: [5, 10, 15, 20, 25, 30], resolutions: ['720p'], audio: false }
  ],
  'image-to-video': [
    { id: 'veo3-fast-image-to-video', name: 'Veo3 Fast', badge: 'fast', durations: [8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3-full-image-to-video', name: 'Veo3 Full', badge: 'full', durations: [8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-fast-image-to-video', name: 'Veo3.1 Fast', badge: 'fast', durations: [8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'veo3.1-full-image-to-video', name: 'Veo3.1 Full', badge: 'full', durations: [8], resolutions: ['720p', '1080p'], audio: true },
    { id: 'sora-2-image-to-video', name: 'Sora 2', badge: null, durations: [4, 6, 8, 10, 12], resolutions: ['720p'], audio: true },
    { id: 'sora-2-pro-image-to-video', name: 'Sora 2 Pro', badge: 'pro', durations: [4, 6, 8, 10, 12], resolutions: ['1080p'], audio: true },
    { id: 'kling-2.6-pro-image-to-video', name: 'Kling 2.6 Pro', badge: 'pro', durations: [5, 10], resolutions: ['720p', '1080p'], audio: true },
    { id: 'kling-2.5-turbo-pro-image-to-video', name: 'Kling 2.5 Turbo', badge: 'fast', durations: [5, 10], resolutions: ['720p', '1080p'], audio: false },
    { id: 'ltx-2-fast-image-to-video', name: 'LTX 2 Fast', badge: 'fast', durations: [6, 10, 15, 20], resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'ltx-2-full-image-to-video', name: 'LTX 2 Full', badge: 'full', durations: [6, 10], resolutions: ['720p', '1080p', '2160p'], audio: true },
    { id: 'wan-2.5-preview-image-to-video', name: 'WAN 2.5', badge: null, durations: [5, 10], resolutions: ['480p'], audio: true },
    { id: 'wan-2.1-pro-image-to-video', name: 'WAN 2.1 Pro', badge: 'pro', durations: [6], resolutions: ['720p'], audio: false },
    { id: 'longcat-distilled-image-to-video', name: 'Longcat Distilled', badge: 'fast', durations: [5, 10, 15, 20, 25, 30], resolutions: ['720p'], audio: false },
    { id: 'longcat-image-to-video', name: 'Longcat', badge: null, durations: [5, 10, 15, 20, 25, 30], resolutions: ['720p'], audio: false },
    { id: 'ovi-image-to-video', name: 'OVI', badge: null, durations: [5], resolutions: ['720p'], audio: true }
  ]
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
  selectedDuration: null,
  selectedResolution: null,
  selectedAspectRatio: '16:9'
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // Render initial models
  renderModels();

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

  console.log('Venice Video Generator initialized');
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
  const models = MODELS[appState.mode];

  grid.innerHTML = models.map(model => `
    <div class="model-card" data-model-id="${model.id}" onclick="selectModel('${model.id}')">
      <div class="model-header">
        <span class="model-name">${model.name}</span>
        ${model.badge ? `<span class="model-badge ${model.badge}">${model.badge}</span>` : ''}
      </div>
      <div class="model-features">
        <span class="feature-tag">
          <svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          ${model.durations.join(', ')}s
        </span>
        <span class="feature-tag">
          <svg viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          ${model.resolutions.join(', ')}
        </span>
        ${model.audio ? '<span class="feature-tag audio"><svg viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>Audio</span>' : ''}
      </div>
    </div>
  `).join('');
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

  // Update duration pills
  renderDurationPills(model.durations);

  // Update resolution pills
  renderResolutionPills(model.resolutions);

  // Show/hide audio toggle
  document.getElementById('audio-toggle').classList.toggle('hidden', !model.audio);

  // Update selected model info
  updateSelectedModelInfo(model);
}

// Render Duration Pills
function renderDurationPills(durations) {
  const container = document.getElementById('duration-pills');
  container.innerHTML = durations.map((d, i) => `
    <button type="button" class="param-pill ${i === 0 ? 'selected' : ''}" data-duration="${d}" onclick="selectDuration(${d})">${d}s</button>
  `).join('');
  appState.selectedDuration = durations[0];
}

// Render Resolution Pills
function renderResolutionPills(resolutions) {
  const container = document.getElementById('resolution-pills');
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
}

// Toggle Token Visibility
function toggleTokenVisibility() {
  const input = document.getElementById('api-token');
  const icon = document.getElementById('eye-icon');

  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = '<path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>';
  } else {
    input.type = 'password';
    icon.innerHTML = '<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
  }
}

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

function processImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file', 'error');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('Image must be less than 10MB', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    appState.uploadedImage = e.target.result;
    appState.uploadedImageUrl = null;

    document.getElementById('upload-content').style.display = 'none';
    document.getElementById('upload-preview').style.display = 'block';
    document.getElementById('preview-image').src = e.target.result;
    document.getElementById('upload-zone').classList.add('has-image');
    document.getElementById('image-url').value = '';
  };
  reader.readAsDataURL(file);
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
  const token = document.getElementById('api-token').value.trim();

  if (!token) {
    errors['api-token'] = 'API token is required';
  }

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
    if (!appState.uploadedImage && !imageUrl) {
      errors['image-url'] = 'Please upload an image or provide a URL';
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
  const token = document.getElementById('api-token').value.trim();

  try {
    // Show loading
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner"></span> Submitting...';
    showLoading('Submitting video generation request...');

    // Build parameters - start with required fields only
    const params = {
      model: appState.selectedModel.id
    };

    // Add duration if valid
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
      } else if (appState.uploadedImage) {
        // For now, we'll need a URL - show error
        hideLoading();
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';
        showToast('Please provide an image URL. Direct upload coming soon!', 'warning');
        return;
      }

      const motionPrompt = document.getElementById('motion-prompt').value.trim();
      if (motionPrompt) {
        params.prompt = motionPrompt;
      }
    }

    // Create API instance and queue
    const api = new VeniceAPI(token);
    const response = await api.queue(params);

    appState.queueId = response.queue_id;
    appState.isProcessing = true;

    hideLoading();
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';

    showToast('Video generation started!', 'success');

    // Show progress section
    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('queue-id').textContent = response.queue_id.substring(0, 8) + '...';

    // Start polling
    pollForCompletion(api, response.queue_id);

  } catch (error) {
    console.error('Generation error:', error);
    hideLoading();
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';
    showErrorModal(error.message);
  }
}

// Poll for Completion
async function pollForCompletion(api, queueId) {
  const pollInterval = 10000; // 10 seconds
  const maxAttempts = 120; // 20 minutes max

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!appState.isProcessing) {
      console.log('Polling cancelled');
      return;
    }

    try {
      const status = await api.retrieve(queueId);

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
        appState.isProcessing = false;

        document.getElementById('status-badge').className = 'status-badge status-success';
        document.getElementById('status-badge').textContent = 'Completed';
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('progress-value').textContent = '100%';

        // Show video section
        document.getElementById('video-section').classList.remove('hidden');
        document.getElementById('video-player').src = status.video_url;

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
  const token = document.getElementById('api-token').value.trim();

  try {
    estimateBtn.disabled = true;
    estimateBtn.innerHTML = '<span class="spinner"></span> Calculating...';

    // Build parameters - start with required fields only
    const params = {
      model: appState.selectedModel.id
    };

    // Add duration if valid
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
      }
      const motionPrompt = document.getElementById('motion-prompt').value.trim();
      if (motionPrompt) {
        params.prompt = motionPrompt;
      }
    }

    // Temporarily removing aspect_ratio and resolution to debug 400 errors
    // These will be re-added once we confirm the basic request works
    // if (appState.selectedAspectRatio && appState.selectedAspectRatio !== '16:9') {
    //   params.aspect_ratio = appState.selectedAspectRatio;
    // }
    // if (appState.selectedResolution) {
    //   params.resolution = appState.selectedResolution;
    // }

    const api = new VeniceAPI(token);
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
  appState.videoUrl = null;

  document.getElementById('progress-section').classList.add('hidden');
  document.getElementById('video-section').classList.add('hidden');
  document.getElementById('video-player').src = '';
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

// Make functions globally accessible
window.switchMode = switchMode;
window.selectModel = selectModel;
window.selectDuration = selectDuration;
window.selectResolution = selectResolution;
window.toggleTokenVisibility = toggleTokenVisibility;
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
