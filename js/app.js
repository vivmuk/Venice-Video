// Venice Video Generator - Main Application

// Model Data - loaded from Venice API
let MODELS = {
  'text-to-video': [],
  'image-to-video': [],
  'video-to-video': []
};

// App State
const appState = {
  mode: 'text-to-video',
  selectedModel: null,
  uploadedImage: null,
  uploadedImageUrl: null,
  uploadedVideoBlob: null,
  uploadedVideoUrl: null,
  uploadedVideoDuration: null,
  uploadedVideoIsVertical: null,
  uploadedRefs: { image: [], video: [], audio: [] }, // host URLs of uploaded files
  uploadedRefsFiles: { image: [], video: [], audio: [] }, // parallel blobs (for save-to-library)
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

  // Setup global error handlers
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    showErrorModal(e.error?.message || 'An unexpected error occurred');
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
    showErrorModal(e.reason?.message || 'An unexpected error occurred');
  });

  // Render the saved-refs gallery from IndexedDB (synchronous, fast)
  renderSavedRefs().catch(() => {});

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
    
    console.log('API returned', models.length, 'models');
    
    models.forEach(model => {
      const constraints = model.model_spec?.constraints || {};
      const name = model.model_spec?.name || model.id;
      const modelId = model.id || '';
      
      // Get model_type from constraints - this is the reliable source
      const modelType = constraints.model_type;
      
      // Skip if no model_type (not a proper video model)
      if (!modelType) {
        console.log('Skipping model without model_type:', modelId);
        return;
      }
      
      // Extract badge from name or id
      let badge = null;
      const nameLower = name.toLowerCase();
      const idLower = modelId.toLowerCase();
      if (nameLower.includes('fast') || idLower.includes('fast')) {
        badge = 'fast';
      } else if (nameLower.includes('full') || idLower.includes('full')) {
        badge = 'full';
      } else if (nameLower.includes('pro') || idLower.includes('pro')) {
        badge = 'pro';
      } else if (nameLower.includes('turbo') || idLower.includes('turbo')) {
        badge = 'fast';
      }
      
      // Parse durations (convert "5s" to 5)
      const durations = (constraints.durations || []).map(d => {
        if (typeof d === 'string') {
          return parseInt(d.replace('s', ''));
        }
        return d;
      });
      
      // Get resolutions
      const resolutions = constraints.resolutions || [];
      
      // Get aspect ratios
      const aspectRatios = constraints.aspect_ratios || [];
      
      // Audio support
      const audio = constraints.audio || false;
      
      // Determine how the model consumes visual input (text / image / reference / video).
      const inputMode = (typeof VeniceAPI !== 'undefined' && VeniceAPI.inputMode)
        ? VeniceAPI.inputMode(modelId, constraints)
        : (modelType || 'text').replace('-to-video', '');

      const modelData = {
        id: model.id,
        name: name,
        badge: badge,
        durations: durations,
        resolutions: resolutions,
        aspectRatios: aspectRatios,
        audio: audio,
        constraints: constraints,
        inputMode: inputMode,
        requiresReference: inputMode === 'reference',
        offline: model.model_spec?.offline || false
      };

      // Categorize model. 4 buckets now: text-to-video, image-to-video (incl.
      // reference-to-video), video-to-video (incl. upscale), and an H2V
      // placeholder if any show up.
      if (inputMode === 'text' || modelType === 'text-to-video') {
        MODELS['text-to-video'].push(modelData);
      } else if (inputMode === 'image' || inputMode === 'reference') {
        MODELS['image-to-video'].push(modelData);
      } else if (inputMode === 'video') {
        MODELS['video-to-video'].push(modelData);
      }
      // Anything else (future H2V etc.) is not surfaced.
    });
    
    // Log model counts for debugging
    console.log('Models loaded from API:', {
      'text-to-video': MODELS['text-to-video'].length,
      'image-to-video': MODELS['image-to-video'].length
    });
    
    appState.modelsLoaded = true;
    
    // Render models for current mode
    renderModels();
    
    // Show success message if models were loaded
    const totalModels = MODELS['text-to-video'].length + MODELS['image-to-video'].length;
    if (totalModels > 0) {
      showToast(`Loaded ${MODELS['text-to-video'].length} text-to-video and ${MODELS['image-to-video'].length} image-to-video models`, 'success');
    }
  } catch (error) {
    console.error('Error loading models from API:', error);
    appState.modelsLoaded = false;
    renderModels();
    
    const errorMsg = token 
      ? 'Failed to load models. Please check your API key.'
      : 'Failed to load models. Please enter your API key.';
    showToast(errorMsg, 'error');
  }
}

// ----- V2V + Reference + Improve handlers -----

async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch('/api/upload', { method: 'POST', body: fd });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'upload failed (' + resp.status + ')');
  return data.url;
}

function handleVideoDragOver(e) { e.preventDefault(); e.stopPropagation(); document.getElementById('video-upload-zone').classList.add('drag-over'); }
function handleVideoDragLeave(e) { e.preventDefault(); e.stopPropagation(); document.getElementById('video-upload-zone').classList.remove('drag-over'); }
function handleVideoDrop(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('video-upload-zone').classList.remove('drag-over');
  const dt = new DataTransfer();
  for (const f of (e.dataTransfer.files || [])) dt.items.add(f);
  const input = document.getElementById('video-upload');
  if (!input) return;
  input.files = dt.files;
  handleVideoUpload({ target: input });
}

async function handleVideoUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type || !file.type.startsWith('video/')) {
    showToast('Please upload a video file (mp4 / mov / webm)', 'error');
    e.target.value = '';
    return;
  }
  if (file.size > 700 * 1024 * 1024) {
    showToast('File too large — max 700 MB', 'error');
    e.target.value = '';
    return;
  }
  showLoading('Uploading video to litterbox.catbox.moe...');
  try {
    const url = await uploadFile(file);
    appState.uploadedVideoBlob = file;
    appState.uploadedVideoUrl = url;
    const localUrl = URL.createObjectURL(file);
    const videoEl = document.getElementById('video-preview');
    if (videoEl) {
      videoEl.src = localUrl;
      document.getElementById('video-upload-content').style.display = 'none';
      document.getElementById('video-upload-preview').style.display = 'block';
      videoEl.onloadedmetadata = () => {
        appState.uploadedVideoDuration = videoEl.duration || 0;
        appState.uploadedVideoIsVertical = (videoEl.videoHeight || 0) > (videoEl.videoWidth || 0);
        const meta = document.getElementById('video-meta');
        if (meta) {
          const secs = Math.round(videoEl.duration || 0);
          const dims = (videoEl.videoWidth || 0) + 'x' + (videoEl.videoHeight || 0);
          meta.textContent = secs + 's . ' + dims + (appState.uploadedVideoIsVertical ? ' . vertical' : '');
        }
        hideLoading();
      };
      videoEl.onerror = () => hideLoading();
    } else { hideLoading(); }
  } catch (err) {
    hideLoading();
    showToast('Upload failed: ' + err.message, 'error');
  }
}

function removeVideo(e) {
  e.preventDefault(); e.stopPropagation();
  appState.uploadedVideoBlob = null;
  appState.uploadedVideoUrl = null;
  appState.uploadedVideoDuration = null;
  appState.uploadedVideoIsVertical = null;
  const videoEl = document.getElementById('video-preview');
  if (videoEl) videoEl.src = '';
  const c = document.getElementById('video-upload-content');
  const p = document.getElementById('video-upload-preview');
  const meta = document.getElementById('video-meta');
  if (c) c.style.display = '';
  if (p) p.style.display = 'none';
  if (meta) meta.textContent = '';
  const inp = document.getElementById('video-upload');
  if (inp) inp.value = '';
}

function appendRef(url, targetId, thumbsId, counterId, max, kind, file) {
  const ta = document.getElementById(targetId);
  if (!ta) return;
  const lines = ta.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  if (lines.includes(url)) return;
  if (lines.length >= max) {
    showToast('Ref cap (' + max + ') reached - extra drop ignored', 'warning');
    return;
  }
  lines.push(url);
  ta.value = lines.join('\n');
  if (counterId) updateRefCounter(counterId, lines.length, max);
  const thumbs = document.getElementById(thumbsId);
  if (!thumbs) return;
  const chip = document.createElement('div');
  chip.className = 'ref-thumb';
  if (/image/.test(thumbsId)) {
    chip.innerHTML = '<img src="' + url + '" alt="ref" loading="lazy">';
  } else if (/video/.test(thumbsId)) {
    chip.innerHTML = '<video src="' + url + '" muted playsinline preload="metadata"></video>';
  } else {
    chip.innerHTML = '<div class="ref-thumb-icon" title="' + url + '">AUDIO</div>';
  }
  // Save-to-library button (only if we have the blob)
  if (file) {
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'ref-thumb-save';
    saveBtn.title = 'Save to library (persistent)';
    saveBtn.textContent = '\u{1F4BE}';
    saveBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      downloadRefToLibrary(kind, file, url);
    });
    chip.appendChild(saveBtn);
  }
  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'ref-thumb-remove';
  removeBtn.title = 'Remove';
  removeBtn.innerHTML = '\u00d7';
  removeBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    const cur = ta.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const next = cur.filter((u) => u !== url);
    ta.value = next.join('\n');
    if (counterId) updateRefCounter(counterId, next.length, max);
    if (kind) {
      if (appState.uploadedRefs[kind]) appState.uploadedRefs[kind] = appState.uploadedRefs[kind].filter((u) => u !== url);
      if (appState.uploadedRefsFiles[kind]) appState.uploadedRefsFiles[kind] = appState.uploadedRefsFiles[kind].filter((x) => x.url !== url);
    }
    chip.remove();
  });
  chip.appendChild(removeBtn);
  thumbs.appendChild(chip);
}

function updateRefCounter(counterId, current, max) {
  const el = document.getElementById(counterId);
  if (!el) return;
  el.textContent = current + ' / ' + max + (current >= max ? ' (cap reached)' : '');
}

async function uploadAndAppend(files, kind) {
  const map = {
    image: { target: 'ref-image-urls', thumbs: 'ref-image-thumbs', counter: 'ref-image-counter', max: 9, key: 'image' },
    video: { target: 'ref-video-urls', thumbs: 'ref-video-thumbs', counter: 'ref-video-counter', max: 3, key: 'video' },
    audio: { target: 'ref-audio-urls', thumbs: 'ref-audio-thumbs', counter: 'ref-audio-counter', max: 3, key: 'audio' },
  };
  const m = map[kind];
  if (!m) return;
  const remaining = m.max - appState.uploadedRefs[m.key].length;
  const capped = Array.from(files).slice(0, Math.max(0, remaining));
  if (capped.length < files.length) showToast('Cap (' + m.max + ') reached; some files skipped', 'warning');
  for (const f of capped) {
    try {
      showLoading('Uploading ' + f.name + '...');
      const url = await uploadFile(f);
      appState.uploadedRefs[m.key].push(url);
      appState.uploadedRefsFiles[m.key].push({ url, file: f });
      appendRef(url, m.target, m.thumbs, m.counter, m.max, m.key, f);
      hideLoading();
    } catch (err) {
      hideLoading();
      showToast('Upload failed: ' + err.message, 'error');
      break;
    }
  }
}

async function handleRefImageUpload(e) { await uploadAndAppend(e.target.files, 'image'); e.target.value = ''; }
function handleRefImageDrop(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('ref-image-drop-zone')?.classList.remove('drag-over');
  const dt = new DataTransfer();
  for (const f of (e.dataTransfer.files || [])) dt.items.add(f);
  const input = document.getElementById('ref-image-drop-input');
  if (!input) return;
  input.files = dt.files;
  handleRefImageUpload({ target: input });
}
async function handleRefVideoUpload(e) { await uploadAndAppend(e.target.files, 'video'); e.target.value = ''; }
function handleRefVideoDrop(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('ref-video-drop-zone')?.classList.remove('drag-over');
  const dt = new DataTransfer();
  for (const f of (e.dataTransfer.files || [])) dt.items.add(f);
  const input = document.getElementById('ref-video-drop-input');
  if (!input) return;
  input.files = dt.files;
  handleRefVideoUpload({ target: input });
}
async function handleRefAudioUpload(e) { await uploadAndAppend(e.target.files, 'audio'); e.target.value = ''; }
function handleRefAudioDrop(e) {
  e.preventDefault(); e.stopPropagation();
  document.getElementById('ref-audio-drop-zone')?.classList.remove('drag-over');
  const dt = new DataTransfer();
  for (const f of (e.dataTransfer.files || [])) dt.items.add(f);
  const input = document.getElementById('ref-audio-drop-input');
  if (!input) return;
  input.files = dt.files;
  handleRefAudioUpload({ target: input });
}

async function handleImprove(fieldId) {
  const ta = document.getElementById(fieldId);
  if (!ta) return;
  if (ta.disabled) return;
  const original = ta.value.trim();
  if (!original) { showToast('Add a prompt first, then Improve', 'warning'); return; }
  if (!appState.selectedModel) { showToast('Select a video model first', 'warning'); return; }
  const btn = document.querySelector(`[onclick*="handleImprove('${fieldId}')"]`);
  if (btn) btn.disabled = true;
  const prevHtml = btn ? btn.innerHTML : '';
  if (btn) btn.innerHTML = '<span class="spinner"></span> Polishing...';
  try {
    const resp = await fetch('/api/improve-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: original, modelId: appState.selectedModel.id }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'improve failed (' + resp.status + ')');
    ta.value = data.improved || original;
    ta.dispatchEvent(new Event('input'));
    if (btn) {
      btn.innerHTML = 'Undo';
      btn.disabled = false;
      btn.onclick = () => {
        ta.value = original;
        ta.dispatchEvent(new Event('input'));
        btn.innerHTML = prevHtml;
        btn.setAttribute('onclick', "handleImprove('" + fieldId + "')");
        btn.onclick = null;
      };
    }
    showToast('Prompt polished', 'success');
  } catch (err) {
    showToast('Improve failed: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ----- Saved-refs library (IndexedDB-backed) -----

const refDB = {
  db: 'venice-refs',
  store: 'refs',
  version: 1,
  open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(this.db, this.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.store)) {
          db.createObjectStore(this.store, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  },
  put(r) {
    return this.open().then((db) => new Promise((res, rej) => {
      const tx = db.transaction(this.store, 'readwrite');
      tx.objectStore(this.store).put(r);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  },
  all() {
    return this.open().then((db) => new Promise((res, rej) => {
      const tx = db.transaction(this.store, 'readonly');
      const req = tx.objectStore(this.store).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    }));
  },
  del(id) {
    return this.open().then((db) => new Promise((res, rej) => {
      const tx = db.transaction(this.store, 'readwrite');
      tx.objectStore(this.store).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  },
};

function escapeHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHTML(s); }

async function downloadRefToLibrary(kind, file, url) {
  if (!file) return;
  const base = (file.name || 'ref').replace(/\.[^.]+$/, '');
  const name = prompt('Name this reference', base);
  if (!name || !name.trim()) return;
  const id = 'ref-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  try {
    await refDB.put({
      id,
      name: name.trim().slice(0, 80),
      kind,
      file,
      url,
      mime: file.type || '',
      size: file.size || 0,
      createdAt: Date.now(),
    });
    await renderSavedRefs();
    showToast('Saved "' + name.trim() + '" to library', 'success');
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

async function renderSavedRefs() {
  const list = document.getElementById('saved-refs-list');
  const empty = document.getElementById('saved-refs-empty');
  if (!list || !empty) return;
  let refs;
  try { refs = await refDB.all(); } catch (e) { return; }
  refs = refs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 50);
  list.innerHTML = '';
  if (refs.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  for (const r of refs) {
    const card = document.createElement('div');
    card.className = 'saved-ref-card';
    const thumb = document.createElement('div');
    thumb.className = 'saved-ref-thumb';
    if (r.file) {
      try {
        const localUrl = URL.createObjectURL(r.file);
        thumb.innerHTML = '<img src="' + localUrl + '" alt="' + escapeAttr(r.name) + '" loading="lazy">';
      } catch (e) {
        thumb.innerHTML = '<div class="saved-ref-icon">↻</div>';
      }
    } else if (r.url) {
      thumb.innerHTML = '<img src="' + escapeAttr(r.url) + '" alt="' + escapeAttr(r.name) + '" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{className:\'saved-ref-icon\',textContent:\'↻\'}))">';
    } else {
      thumb.innerHTML = '<div class="saved-ref-icon">↻</div>';
    }
    card.appendChild(thumb);
    const label = document.createElement('div');
    label.className = 'saved-ref-label';
    label.textContent = r.name;
    label.title = r.name;
    card.appendChild(label);
    const meta = document.createElement('div');
    meta.className = 'saved-ref-meta';
    const size = r.size ? Math.round(r.size / 1024) + ' KB' : '';
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '';
    const kindLabel = r.kind ? r.kind[0].toUpperCase() + r.kind.slice(1) : '';
    meta.textContent = [kindLabel, size, date].filter(Boolean).join(' · ');
    card.appendChild(meta);
    const actions = document.createElement('div');
    actions.className = 'saved-ref-actions';
    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'saved-ref-load';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => loadSavedRef(r));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'saved-ref-delete';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => removeSavedRef(r));
    actions.appendChild(loadBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
    list.appendChild(card);
  }
}

async function loadSavedRef(r) {
  showLoading('Re-publishing "' + r.name + '"...');
  try {
    let url = r.url;
    if (!url && r.file) url = await uploadFile(r.file);
    if (!url) throw new Error('No file or URL available for this reference');
    const map = {
      image: ['ref-image-urls', 'ref-image-thumbs', 'ref-image-counter', 9],
      video: ['ref-video-urls', 'ref-video-thumbs', 'ref-video-counter', 3],
      audio: ['ref-audio-urls', 'ref-audio-thumbs', 'ref-audio-counter', 3],
    };
    const entry = map[r.kind] || map.image;
    appendRef(url, entry[0], entry[1], entry[2], entry[3], r.kind, r.file);
    hideLoading();
    showToast('Loaded "' + r.name + '"', 'success');
  } catch (err) {
    hideLoading();
    showToast('Load failed: ' + err.message, 'error');
  }
}

async function removeSavedRef(r) {
  if (!confirm('Delete saved reference "' + r.name + '"?')) return;
  try {
    await refDB.del(r.id);
    await renderSavedRefs();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
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
  document.getElementById('video-input-section').classList.toggle('hidden', mode !== 'video-to-video');

  // Render models for this mode
  renderModels();

  // Reset selected model info
  document.getElementById('selected-model-info').innerHTML = '<p class="select-hint">Select a model above to begin</p>';
}

// Render Models
function renderModels() {
  const grid = document.getElementById('model-grid');
  const models = MODELS[appState.mode] || [];
  const allModes = ['text-to-video', 'image-to-video', 'video-to-video'];
  const totalModelsCount = allModes.reduce((n, m) => n + (MODELS[m]?.length || 0), 0);
  const otherModes = allModes.filter((m) => m !== appState.mode);
  const otherModelsCount = otherModes.reduce((n, m) => n + (MODELS[m]?.length || 0), 0);
  const otherModeNames = otherModes.filter((m) => (MODELS[m]?.length || 0) > 0)
                                   .map((m) => m.replace(/-/g, ' '))
                                   .join(', ');

  if (models.length === 0) {
    let message = '';
    if (totalModelsCount === 0) {
      // No models loaded at all
      message = `
        <p style="margin-bottom: var(--space-md);">No models available. Please enter your API key to load models.</p>
        <p style="font-size: 0.9rem;">Click the key icon in the header to add your Venice API key.</p>
      `;
    } else if (otherModelsCount > 0) {
      const modeDisplay = appState.mode.replace(/-/g, ' ');
      message = `
        <p style="margin-bottom: var(--space-md);">No ${modeDisplay} models available.</p>
        <p style="font-size: 0.9rem;">Switch to ${otherModeNames} mode to see them.</p>
      `;
    } else {
      // Models loaded but none for this mode
      const modeDisplay = appState.mode.replace(/-/g, ' ');
      message = `
        <p style="margin-bottom: var(--space-md);">No ${modeDisplay} models found.</p>
        <p style="font-size: 0.9rem;">Your API key may not have access to ${modeDisplay} models.</p>
      `;
    }
    
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: var(--space-xl); color: var(--text-muted);">
        ${message}
      </div>
    `;
    return;
  }

  grid.innerHTML = models.map(model => {
    const offlineBadge = model.offline ? '<span class="model-badge" style="background:var(--error);">Off</span>' : '';
    const badge = model.badge ? `<span class="model-badge ${model.badge}">${model.badge}</span>` : '';
    return `
      <div class="model-card" data-model-id="${model.id}" onclick="selectModel('${model.id}')">
        <div class="model-header">
          <span class="model-name">${model.name}</span>
          ${badge}${offlineBadge}
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
  renderAspectRatioPills(model.aspectRatios || []);

  // Show/hide audio toggle. Audio defaults ON for models that support it.
  document.getElementById('audio-toggle').classList.toggle('hidden', !model.audio);
  const audioCheckbox = document.getElementById('audio-checkbox');
  if (audioCheckbox && model.audio) audioCheckbox.checked = true;

  // Reference-to-video models use the image as a character/scene reference.
  const refHint = document.getElementById('reference-hint');
  if (refHint) refHint.classList.toggle('hidden', !model.requiresReference);
  const imgLabel = document.getElementById('image-label');
  if (imgLabel) imgLabel.textContent = model.requiresReference ? 'Reference Image' : 'Source Image';

  // Update selected model info
  updateSelectedModelInfo(model);
}

// Render aspect ratio pills from the model's advertised ratios.
// Hides the control entirely for models that don't accept an aspect ratio.
function renderAspectRatioPills(ratios) {
  const container = document.getElementById('aspect-pills');
  const section = document.getElementById('aspect-section');
  if (!container) return;

  if (!ratios || ratios.length === 0) {
    if (section) section.style.display = 'none';
    appState.selectedAspectRatio = null;
    container.innerHTML = '';
    return;
  }

  if (section) section.style.display = '';
  const selected = ratios.includes(appState.selectedAspectRatio)
    ? appState.selectedAspectRatio
    : (ratios.includes('16:9') ? '16:9' : ratios[0]);
  appState.selectedAspectRatio = selected;

  container.innerHTML = ratios.map(r => `
    <button type="button" class="param-pill ${r === selected ? 'selected' : ''}" data-ratio="${r}" onclick="selectAspectRatio('${r}')">${r}</button>
  `).join('');
}

// Select Aspect Ratio
function selectAspectRatio(ratio) {
  appState.selectedAspectRatio = ratio;
  document.querySelectorAll('#aspect-pills .param-pill').forEach(pill => {
    pill.classList.toggle('selected', pill.dataset.ratio === ratio);
  });
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

// Fill the seed field with a random value.
function randomizeSeed() {
  const seed = document.getElementById('seed-input');
  if (seed) seed.value = Math.floor(Math.random() * 2147483647);
}

// Update Selected Model Info
function updateSelectedModelInfo(model) {
  const container = document.getElementById('selected-model-info');
  const durStr = model.durations.length ? model.durations.join(', ') + 's' : '';
  const resStr = model.resolutions.length ? model.resolutions.join(', ') : '';
  container.innerHTML = `
    <p class="selected-model-name">${model.name}</p>
    <p class="selected-model-id">${model.id}</p>
    <div class="selected-model-tags">
      ${durStr ? `<span class="feature-tag">${durStr}</span>` : ''}
      ${resStr ? `<span class="feature-tag">${resStr}</span>` : ''}
      ${model.audio ? '<span class="feature-tag audio">Audio</span>' : ''}
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
  appState.uploadedImageUrl = null;

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
  } else if (appState.mode === 'video-to-video') {
    // Codex P1 fix: V2V mode has its own gate -- it doesn't need an image,
    // an #motion-prompt, or ref-image urls from the image panel.
    if (!appState.uploadedVideoUrl) {
      errors['video-url'] = 'Please upload a source video';
    }
    const motionPrompt = document.getElementById('video-motion-prompt').value.trim();
    if (!motionPrompt) {
      errors['video-motion-prompt'] = 'Motion prompt is required for video-to-video';
    }
  } else {
    // image-to-video / reference-to-video
    const refImgEl = document.getElementById('ref-image-urls');
    const refVidEl = document.getElementById('ref-video-urls');
    const hasRefUrls = (refImgEl && refImgEl.value.trim()) || (refVidEl && refVidEl.value.trim());
    if (!appState.uploadedImageUrl && !hasRefUrls) {
      errors['image-url'] = appState.selectedModel && appState.selectedModel.requiresReference
        ? 'Please upload an image or add reference image/video URLs'
        : 'Please upload an image';
    }
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

// Collect all generation parameters from the form + selected model.
// Shared by Generate and Estimate so the two never drift apart.
function buildGenerationParams() {
  const model = appState.selectedModel;
  const params = {
    model: model.id,
    modelConstraints: model.constraints // used for per-model validation/filtering
  };

  // Aspect ratio - only when the model supports it.
  const ratios = model.aspectRatios || [];
  if (ratios.length > 0) {
    params.aspect_ratio = ratios.includes(appState.selectedAspectRatio)
      ? appState.selectedAspectRatio
      : ratios[0];
  }

  // Duration / resolution (validated again in the API layer).
  if (appState.selectedDuration) params.duration = appState.selectedDuration;
  if (appState.selectedResolution) params.resolution = appState.selectedResolution;

  // Audio - only when the model can generate it.
  if (model.audio) {
    const audioEl = document.getElementById('audio-checkbox');
    params.audio = !!(audioEl && audioEl.checked);
  }

  // Advanced options.
  const neg = document.getElementById('negative-prompt');
  if (neg && neg.value.trim()) params.negative_prompt = neg.value.trim();
  const seed = document.getElementById('seed-input');
  if (seed && seed.value.trim() !== '') params.seed = seed.value.trim();

  // Parse a textarea/input of URLs separated by newlines or commas.
  const parseUrlList = (id) => {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) return [];
    return el.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  };
  const oneUrl = (id) => {
    const el = document.getElementById(id);
    return el && el.value.trim() ? el.value.trim() : '';
  };

  // Advanced reference / media fields (each maps to a Venice video-queue param).
  const refImageUrls = parseUrlList('ref-image-urls');
  const refVideoUrls = parseUrlList('ref-video-urls');
  const refAudioUrls = parseUrlList('ref-audio-urls');
  const endImageUrl = oneUrl('end-image-url');
  const refVideoDur = document.getElementById('ref-video-duration');

  if (refVideoUrls.length) params.reference_video_urls = refVideoUrls;
  if (refAudioUrls.length) params.reference_audio_urls = refAudioUrls;
  if (endImageUrl) params.end_image_url = endImageUrl;
  if (refVideoDur && refVideoDur.value.trim() !== '') {
    params.reference_video_total_duration = refVideoDur.value.trim();
  }

  // Prompt + primary visual input. Four modes share the same params API;
  // only the field ids and primary input channel differ.
  if (appState.mode === 'text-to-video') {
    params.prompt = document.getElementById('prompt').value.trim();
    if (refImageUrls.length) params.reference_image_urls = refImageUrls;
  } else if (appState.mode === 'video-to-video') {
    params.video_url = appState.uploadedVideoUrl || '';
    const el = document.getElementById('video-motion-prompt');
    params.prompt = (el && el.value || '').trim();
    // Codex fix: forward reference_image_urls to V2V-aware models
    // (Wan Edit, Grok V2V Private, HappyHorse Edit). Documented in api.js
    // buildRequestBody V2V branch.
    if (refImageUrls.length) params.reference_image_urls = refImageUrls;
  } else {
    const uploaded = appState.uploadedImageUrl || '';
    if (model.requiresReference) {
      const all = [];
      if (uploaded) all.push(uploaded);
      all.push(...refImageUrls);
      params.reference_image_urls = all;
    } else {
      if (uploaded) params.image_url = uploaded;
      if (refImageUrls.length) params.reference_image_urls = refImageUrls;
    }
    params.prompt = document.getElementById('motion-prompt').value.trim();
  }

  return params;
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

    const params = buildGenerationParams();

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
    const queueDisplay = document.getElementById('queue-id-display');
    if (queueDisplay) queueDisplay.textContent = 'ID: ' + response.queue_id.substring(0, 16) + '...';

    console.log('Starting polling with queue_id:', response.queue_id, 'model:', response.model);

    // Wait a few seconds before first poll to give the queue time to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Start polling - pass model ID as well since API requires it.
    // Honor the auto-delete toggle so storage is cleaned up on completion.
    const autoDeleteEl = document.getElementById('auto-delete-checkbox');
    const autoDelete = !!(autoDeleteEl && autoDeleteEl.checked);
    pollForCompletion(api, response.queue_id, response.model || appState.selectedModel?.id, autoDelete);

  } catch (error) {
    console.error('Generation error:', error);
    hideLoading();
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Generate Video';
    showErrorModal(error.message);
  }
}

// Poll for Completion
async function pollForCompletion(api, queueId, modelId = null, deleteOnCompletion = false) {
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
      const status = await api.retrieve(queueId, modelId, deleteOnCompletion);

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
        appState.isProcessing = false;

        document.getElementById('status-badge').className = 'status-badge status-success';
        document.getElementById('status-badge').textContent = 'Completed';
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('progress-value').textContent = '100%';

        const videoPlayer = document.getElementById('video-player');

        // Prefer blob (already fetched) to avoid a second network round-trip.
        // status.video_url may be blob:, https:, or any other scheme — all work as src.
        if (status.video_blob) {
          const blobUrl = URL.createObjectURL(status.video_blob);
          appState.videoUrl = blobUrl;
          appState.videoBlob = status.video_blob;
          videoPlayer.src = blobUrl;
        } else {
          appState.videoUrl = status.video_url;
          videoPlayer.src = status.video_url;
        }

        videoPlayer.load();

        videoPlayer.onerror = () => {
          console.error('Video load error');
          showToast('Video ready — use Download if preview does not play.', 'warning');
        };

        videoPlayer.onloadeddata = () => console.log('Video loaded successfully');

        // Show full-width video section and scroll to it
        const videoSection = document.getElementById('video-section');
        videoSection.classList.remove('hidden');
        setTimeout(() => videoSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

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

    const params = buildGenerationParams();

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
    try {
      await loadModels(null);
    } catch (error) {
      console.error('Error loading models after clearing key:', error);
    }
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
  showToast('API key saved. Loading models...', 'info');

  // Reload models with new key
  try {
    await loadModels(apiKey);
    
    // Check if models were loaded successfully
    const textToVideoCount = MODELS['text-to-video'].length;
    const imageToVideoCount = MODELS['image-to-video'].length;
    const totalCount = textToVideoCount + imageToVideoCount;
    
    if (totalCount > 0) {
      updateApiKeyStatus(`Custom API key active! ${textToVideoCount} text-to-video, ${imageToVideoCount} image-to-video models loaded.`, 'using-custom');
      showToast(`Successfully loaded ${totalCount} model${totalCount > 1 ? 's' : ''}`, 'success');
    } else {
      updateApiKeyStatus('API key valid but no models found. Check your API key permissions.', 'error');
      showToast('No models found with this API key', 'warning');
    }
  } catch (error) {
    console.error('Error loading models with custom key:', error);
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
window.selectAspectRatio = selectAspectRatio;
window.randomizeSeed = randomizeSeed;
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
