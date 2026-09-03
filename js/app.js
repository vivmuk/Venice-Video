// Venice Video Generator - Main Application

// Model Data - loaded from Venice API, one bucket per tab.
let MODELS = {
  'text-to-video': [],
  'image-to-video': [],
  'reference-to-video': [],
  'video-to-video': []
};

// Venice input mode -> tab. Reference-to-video gets its own tab rather than
// being folded into Image, because its inputs and prompt syntax differ.
const MODE_BY_INPUT = {
  text: 'text-to-video',
  image: 'image-to-video',
  reference: 'reference-to-video',
  video: 'video-to-video'
};

// The prompt textarea each tab writes into.
const PROMPT_FIELD = {
  'text-to-video': 'prompt',
  'image-to-video': 'motion-prompt',
  'reference-to-video': 'reference-prompt',
  'video-to-video': 'video-motion-prompt'
};

const MODE_TITLE = {
  'text-to-video': 'text-to-video',
  'image-to-video': 'image-to-video',
  'reference-to-video': 'reference-to-video',
  'video-to-video': 'video-to-video'
};

// The four reference lanes. `tag` names the prompt tag kind the lane is
// addressed by (null = the lane has no @ syntax).
const LANES = {
  element: { accept: 'image', tag: 'element', urlField: null },
  image:   { accept: 'image', tag: 'image',   urlField: 'ref-image-urls' },
  video:   { accept: 'video', tag: null,      urlField: 'ref-video-urls' },
  audio:   { accept: 'audio', tag: null,      urlField: 'ref-audio-urls' }
};

// App State
const appState = {
  mode: 'text-to-video',
  selectedModel: null,
  caps: null,               // VeniceAPI.capabilities() for the selected model
  uploadedImage: null,
  uploadedImageUrl: null,
  uploadedVideoBlob: null,
  uploadedVideoUrl: null,
  uploadedVideoDuration: null,
  uploadedVideoIsVertical: null,
  // Reference lanes. Order is meaningful: slot i is addressed as @Image<i+1>.
  refSlots: { element: [], image: [], video: [], audio: [] },
  modelFilter: '',
  showAllModels: false,   // the full list stays folded until asked for
  isProcessing: false,
  queueId: null,
  videoUrl: null,
  videoBlob: null, // Store the blob for download
  selectedDuration: null,
  selectedResolution: null,
  selectedUpscaleFactor: null,
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

  // Setup prompt counters + tag normalisation on every prompt field
  setupPromptFields();

  // Keep the pasted-URL textareas and the numbered slots in sync
  setupRefUrlTextareas();

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
  applyCapabilities(null);

  console.log('Venice Video Generator initialized');
}

// A short badge for the model card, derived from the model's own name/id.
function deriveBadge(modelId, name) {
  const s = (name + ' ' + modelId).toLowerCase();
  if (/\bturbo\b|\bfast\b|\bflash\b|distilled/.test(s)) return 'fast';
  if (/\bfull\b|\bquality\b/.test(s)) return 'full';
  if (/\bpro\b|\b4k\b/.test(s)) return 'pro';
  return null;
}

// "5s".."15s" -> "5–15s"; the literal 'Auto' is passed through untouched.
function formatDurationRange(durations) {
  const list = durations.map(String);
  if (list.length === 1) return list[0].toLowerCase() === 'auto' ? 'Auto' : list[0];
  const numeric = list.filter((d) => /^\d+s$/i.test(d)).map((d) => parseInt(d, 10));
  const hasAuto = list.some((d) => d.toLowerCase() === 'auto');
  if (!numeric.length) return hasAuto ? 'Auto' : list.join('/');
  const span = numeric.length > 2
    ? `${Math.min(...numeric)}–${Math.max(...numeric)}s`
    : numeric.join('/') + 's';
  return hasAuto ? span + ' / Auto' : span;
}

// One-line capability summary shown under the model name.
function modelSummary(model) {
  const caps = model.caps;
  const bits = [];
  if (caps.durations.length) {
    bits.push(formatDurationRange(caps.durations));
  }
  if (caps.isUpscale) bits.push(caps.upscaleFactors.map((f) => f + 'x').join('/'));
  else if (caps.resolutions.length) bits.push(caps.resolutions[caps.resolutions.length - 1]);
  if (caps.producesAudio) bits.push('audio');
  if (caps.elementLane) bits.push('@elements');
  return bits.join(' · ');
}

// Load models from API
async function loadModels(token) {
  try {
    appState.apiToken = token;
    const api = new VeniceAPI(token);
    const models = await api.getModels();

    Object.keys(MODELS).forEach((k) => { MODELS[k] = []; });

    console.log('API returned', models.length, 'models');

    models.forEach((model) => {
      const spec = model.model_spec || {};
      const constraints = spec.constraints || {};
      const modelId = model.id || '';

      // Skip anything that isn't a proper video model.
      if (!modelId || !constraints.model_type) {
        console.log('Skipping model without model_type:', modelId);
        return;
      }

      // Every parameter decision downstream reads from this one object.
      const caps = VeniceAPI.capabilities(modelId, constraints);
      const bucket = MODE_BY_INPUT[caps.mode];
      if (!bucket) return;

      const name = spec.name || modelId;
      MODELS[bucket].push({
        id: modelId,
        name,
        badge: deriveBadge(modelId, name),
        sets: spec.model_sets || [],
        caps,
        constraints,
        durations: caps.durations,
        resolutions: caps.resolutions,
        aspectRatios: caps.aspectRatios,
        audio: caps.producesAudio,
        inputMode: caps.mode,
        requiresReference: caps.mode === 'reference',
        offline: spec.offline || false,
        recommended: VeniceAPI.isRecommended(model),
        rank: VeniceAPI.releaseRank(model)
      });
    });

    // Newest first within every tab, so the top of each list is the most
    // recent model Venice shipped for that category.
    Object.keys(MODELS).forEach((k) => {
      MODELS[k].sort((a, b) => (b.rank - a.rank) || a.name.localeCompare(b.name));
    });

    console.log('Models loaded from API:', Object.fromEntries(
      Object.keys(MODELS).map((k) => [k, MODELS[k].length])
    ));

    appState.modelsLoaded = true;
    renderModels();

    const total = Object.values(MODELS).reduce((n, list) => n + list.length, 0);
    if (total > 0) {
      const counts = Object.keys(MODELS)
        .map((k) => `${MODELS[k].length} ${k.replace('-to-video', '')}`)
        .join(' · ');
      showToast(`Loaded ${total} video models — ${counts}`, 'success');
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

// ----- Reference lanes -------------------------------------------------
//
// Each lane holds an ordered list of { url, file }. The order is the whole
// point: slot i is what the prompt addresses as "@Image<i+1>" and what lands
// at index i of the request array, so adding, removing and renumbering all
// have to stay in lockstep with the prompt text.

// How many slots the selected model accepts in a lane. 0 hides the lane.
function laneMax(lane) {
  const caps = appState.caps;
  if (!caps) return lane === 'image' ? 9 : 0;
  if (lane === 'element') return caps.elementLane ? caps.elementLane.max : 0;
  if (lane === 'image') return caps.imageLane.max;
  if (lane === 'video') return caps.maxReferenceVideos || 0;
  if (lane === 'audio') return caps.maxReferenceAudio || 0;
  return 0;
}

// The canonical tag for a slot, e.g. "@Image2". Null on untagged lanes.
function laneTag(lane, index) {
  const kind = LANES[lane].tag;
  return kind ? RefTags.label(kind, index + 1) : null;
}

function addToLane(lane, url, file) {
  const slots = appState.refSlots[lane];
  if (slots.some((s) => s.url === url)) return false;
  const max = laneMax(lane);
  if (slots.length >= max) {
    showToast(`${lane} references are capped at ${max} for this model`, 'warning');
    return false;
  }
  slots.push({ url, file: file || null });
  syncLaneTextarea(lane);
  renderLane(lane);
  refreshTagUI();
  return true;
}

// Remove slot `index` and shift every later tag down by one, so a prompt that
// said "@Image3" still points at the same picture after @Image2 is deleted.
function removeFromLane(lane, index) {
  const slots = appState.refSlots[lane];
  if (index < 0 || index >= slots.length) return;
  const before = slots.length;
  slots.splice(index, 1);

  const kind = LANES[lane].tag;
  if (kind) {
    const mapping = {};
    for (let i = 1; i <= before; i++) {
      mapping[i] = i < index + 1 ? i : (i === index + 1 ? null : i - 1);
    }
    remapPromptTags(kind, mapping);
  }

  syncLaneTextarea(lane);
  renderLane(lane);
  refreshTagUI();
}

// Rewrite the tags of one kind across every prompt field.
function remapPromptTags(kind, mapping) {
  Object.values(PROMPT_FIELD).forEach((id) => {
    const el = document.getElementById(id);
    if (!el || !el.value) return;
    const next = RefTags.remap(el.value, kind, mapping);
    if (next !== el.value) {
      el.value = next;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

// Mirror the slot list back into the lane's "paste URLs" textarea.
let syncingLane = false;
function syncLaneTextarea(lane) {
  const id = LANES[lane].urlField;
  if (!id) return;
  const ta = document.getElementById(id);
  if (!ta) return;
  syncingLane = true;
  ta.value = appState.refSlots[lane].map((s) => s.url).join('\n');
  syncingLane = false;
}

// …and the other way: typing/pasting URLs rebuilds the slots, keeping any
// blob we already hold for a URL that survived the edit.
function setupRefUrlTextareas() {
  Object.keys(LANES).forEach((lane) => {
    const id = LANES[lane].urlField;
    if (!id) return;
    const ta = document.getElementById(id);
    if (!ta) return;
    ta.addEventListener('change', () => {
      if (syncingLane) return;
      const urls = ta.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).slice(0, laneMax(lane));
      const known = new Map(appState.refSlots[lane].map((s) => [s.url, s.file]));
      appState.refSlots[lane] = urls.map((u) => ({ url: u, file: known.get(u) || null }));
      syncLaneTextarea(lane);
      renderLane(lane);
      refreshTagUI();
    });
  });
}

function renderLane(lane) {
  const container = document.getElementById('lane-' + lane + '-slots');
  if (!container) return;
  const slots = appState.refSlots[lane];
  const max = laneMax(lane);

  container.innerHTML = '';
  slots.forEach((slot, i) => {
    const chip = document.createElement('div');
    chip.className = 'ref-slot';

    const media = document.createElement('div');
    media.className = 'ref-slot-media';
    if (LANES[lane].accept === 'image') {
      media.innerHTML = '<img src="' + escapeAttr(slot.url) + '" alt="reference ' + (i + 1) + '" loading="lazy">';
    } else if (LANES[lane].accept === 'video') {
      media.innerHTML = '<video src="' + escapeAttr(slot.url) + '" muted playsinline preload="metadata"></video>';
    } else {
      media.innerHTML = '<div class="ref-thumb-icon" title="' + escapeAttr(slot.url) + '">AUDIO</div>';
    }
    chip.appendChild(media);

    // The tag badge doubles as the insert button — this is how a reference
    // gets into the prompt without anyone typing "@Image1" by hand.
    const tag = laneTag(lane, i);
    const caption = document.createElement('button');
    caption.type = 'button';
    caption.className = 'ref-slot-tag' + (tag ? '' : ' ref-slot-tag-plain');
    caption.textContent = tag || String(i + 1);
    if (tag) {
      caption.title = 'Insert ' + tag + ' into the prompt';
      caption.addEventListener('click', (ev) => {
        ev.preventDefault();
        insertTagIntoPrompt(tag);
      });
    } else {
      caption.disabled = true;
      caption.title = 'Reference ' + (i + 1);
    }
    chip.appendChild(caption);

    if (slot.file) {
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'ref-thumb-save';
      saveBtn.title = 'Save to library (persistent)';
      saveBtn.textContent = '\u{1F4BE}';
      saveBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        downloadRefToLibrary(LANES[lane].accept, slot.file, slot.url);
      });
      chip.appendChild(saveBtn);
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'ref-thumb-remove';
    removeBtn.title = 'Remove' + (tag ? ' — later tags are renumbered automatically' : '');
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      removeFromLane(lane, i);
    });
    chip.appendChild(removeBtn);

    container.appendChild(chip);
  });

  // A lane that already holds references shrinks its drop zone to a strip.
  const laneEl = document.getElementById('lane-' + lane);
  if (laneEl) laneEl.classList.toggle('has-slots', slots.length > 0);

  const counter = document.getElementById('lane-' + lane + '-counter');
  if (counter) {
    counter.textContent = slots.length + ' / ' + max + (slots.length >= max && max > 0 ? ' (cap reached)' : '');
  }
}

function renderAllLanes() {
  Object.keys(LANES).forEach(renderLane);
}

// Insert a tag at the caret of the prompt field for the current tab.
function insertTagIntoPrompt(tag) {
  const el = document.getElementById(PROMPT_FIELD[appState.mode]);
  if (!el || el.disabled) {
    showToast('This model takes no prompt, so reference tags have nowhere to go', 'warning');
    return;
  }
  RefTags.insertAtCursor(el, tag);
}

// Rebuild the @-chip bars and the "tag points at nothing" warnings.
function refreshTagUI() {
  const caps = appState.caps;
  const chips = [];
  if (caps && caps.elementLane) {
    appState.refSlots.element.forEach((slot, i) => {
      chips.push({ kind: 'element', tag: RefTags.label('element', i + 1), url: slot.url, media: 'image' });
    });
  }
  appState.refSlots.image.forEach((slot, i) => {
    chips.push({ kind: 'image', tag: RefTags.label('image', i + 1), url: slot.url, media: 'image' });
  });

  const counts = {
    image: appState.refSlots.image.length,
    element: (caps && caps.elementLane) ? appState.refSlots.element.length : 0
  };

  document.querySelectorAll('.reftag-bar').forEach((bar) => {
    const targetId = bar.dataset.target;
    const target = document.getElementById(targetId);
    bar.innerHTML = '';
    if (!chips.length || !target || target.disabled) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');

    const lead = document.createElement('span');
    lead.className = 'reftag-lead';
    lead.textContent = 'Insert:';
    bar.appendChild(lead);

    chips.forEach((chip) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reftag-chip';
      btn.title = 'Insert ' + chip.tag + ' into this prompt';
      btn.innerHTML = '<img src="' + escapeAttr(chip.url) + '" alt="" loading="lazy"><span>' + escapeHTML(chip.tag) + '</span>';
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const el = document.getElementById(targetId);
        if (el && !el.disabled) RefTags.insertAtCursor(el, chip.tag);
      });
      bar.appendChild(btn);
    });
  });

  document.querySelectorAll('.reftag-warning').forEach((box) => {
    const el = document.getElementById(box.dataset.target);
    const report = RefTags.audit(el ? el.value : '', counts);
    if (!report.dangling.length) {
      box.textContent = '';
      box.classList.remove('visible');
      return;
    }
    const list = report.dangling.map((d) => RefTags.label(d.kind, d.n)).join(', ');
    box.textContent = `${list} ${report.dangling.length > 1 ? 'point' : 'points'} at a slot you haven't filled — attach that reference or remove the tag.`;
    box.classList.add('visible');
  });
}

async function uploadIntoLane(files, lane) {
  const max = laneMax(lane);
  if (max === 0) {
    showToast('The selected model does not accept this kind of reference', 'warning');
    return;
  }
  const remaining = max - appState.refSlots[lane].length;
  const capped = Array.from(files).slice(0, Math.max(0, remaining));
  if (capped.length < files.length) showToast('Cap (' + max + ') reached; some files skipped', 'warning');
  for (const f of capped) {
    try {
      showLoading('Uploading ' + f.name + '...');
      const url = await uploadFile(f);
      addToLane(lane, url, f);
      hideLoading();
    } catch (err) {
      hideLoading();
      showToast('Upload failed: ' + err.message, 'error');
      break;
    }
  }
}

async function handleLaneUpload(e, lane) {
  await uploadIntoLane(e.target.files, lane);
  e.target.value = '';
}

function handleLaneDrop(e, lane) {
  e.preventDefault();
  e.stopPropagation();
  const zone = document.getElementById('lane-' + lane + '-drop');
  if (zone) zone.classList.remove('drag-over');
  uploadIntoLane(e.dataTransfer.files || [], lane);
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
    // Images go into the tagged lane so the reference is immediately
    // addressable as @Image<n>; videos and audio into their own lanes.
    const lane = r.kind === 'video' ? 'video' : (r.kind === 'audio' ? 'audio' : 'image');
    const added = addToLane(lane, url, r.file);
    hideLoading();
    if (added) showToast('Loaded "' + r.name + '" as ' + (laneTag(lane, appState.refSlots[lane].length - 1) || 'a reference'), 'success');
    else showToast('"' + r.name + '" is already attached', 'info');
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
  if (!MODELS[mode]) return;
  appState.mode = mode;
  appState.selectedModel = null;
  appState.caps = null;

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  document.getElementById('text-input-section').classList.toggle('hidden', mode !== 'text-to-video');
  document.getElementById('image-input-section').classList.toggle('hidden', mode !== 'image-to-video');
  document.getElementById('reference-input-section').classList.toggle('hidden', mode !== 'reference-to-video');
  document.getElementById('video-input-section').classList.toggle('hidden', mode !== 'video-to-video');

  // References are first-class in the Reference tab and tucked into Advanced
  // everywhere else — the same block, just re-homed.
  const block = document.getElementById('references-block');
  const home = document.getElementById(
    mode === 'reference-to-video' ? 'references-home-primary' : 'references-home-advanced'
  );
  if (block && home && block.parentElement !== home) home.appendChild(block);

  const search = document.getElementById('model-search');
  if (search) {
    search.value = '';
    search.placeholder = `Filter ${MODELS[mode].length} ${MODE_TITLE[mode]} models…`;
  }
  appState.modelFilter = '';
  appState.showAllModels = false;

  renderModels();
  applyCapabilities(null);

  document.getElementById('selected-model-info').innerHTML =
    '<p class="select-hint">Select a model above to begin</p>';
}

function toggleAllModels() {
  appState.showAllModels = !appState.showAllModels;
  renderModels();
}

function handleModelSearch(value) {
  appState.modelFilter = (value || '').trim().toLowerCase();
  renderModels();
}

function modelMatchesFilter(model, filter) {
  if (!filter) return true;
  const haystack = (model.name + ' ' + model.id + ' ' + (model.sets || []).join(' ')).toLowerCase();
  return filter.split(/\s+/).every((term) => haystack.includes(term));
}

// The 2–3 models pinned to the top of a tab: Venice's own recommended /
// featured picks, newest first. If Venice flags fewer than two for a category,
// the newest remaining models fill the row so the section is never a lone card.
function pickRecommended(models) {
  const picks = models.filter((m) => m.recommended && !m.offline).slice(0, 3);
  if (picks.length >= 2) return picks;
  const filler = models.filter((m) => !picks.includes(m) && !m.offline).slice(0, 2 - picks.length);
  return picks.concat(filler);
}

function modelCardHTML(model, isNewest) {
  const badges = [];
  if (isNewest) badges.push('<span class="model-badge new">New</span>');
  if (model.badge) badges.push(`<span class="model-badge ${model.badge}">${model.badge}</span>`);
  if (model.offline) badges.push('<span class="model-badge offline">Off</span>');
  const summary = modelSummary(model);
  return `
      <div class="model-card" data-model-id="${escapeAttr(model.id)}" onclick="selectModel('${escapeAttr(model.id)}')" title="${escapeAttr(model.id)}">
        <div class="model-header">
          <span class="model-name">${escapeHTML(model.name)}</span>
          ${badges.join('')}
        </div>
        ${summary ? `<div class="model-meta">${escapeHTML(summary)}</div>` : ''}
      </div>`;
}

// Render Models
function renderModels() {
  const grid = document.getElementById('model-grid');
  const all = MODELS[appState.mode] || [];
  const allModes = Object.keys(MODELS);
  const totalModelsCount = allModes.reduce((n, m) => n + (MODELS[m]?.length || 0), 0);
  const otherModeNames = allModes
    .filter((m) => m !== appState.mode && (MODELS[m]?.length || 0) > 0)
    .map((m) => m.replace(/-to-video$/, ''))
    .join(', ');

  if (all.length === 0) {
    let message;
    if (totalModelsCount === 0) {
      message = `
        <p style="margin-bottom: var(--space-md);">No models available. Please enter your API key to load models.</p>
        <p style="font-size: 0.9rem;">Click the key icon in the header to add your Venice API key.</p>
      `;
    } else if (otherModeNames) {
      message = `
        <p style="margin-bottom: var(--space-md);">No ${MODE_TITLE[appState.mode]} models available.</p>
        <p style="font-size: 0.9rem;">Switch to ${escapeHTML(otherModeNames)} to see the models you do have.</p>
      `;
    } else {
      message = `
        <p style="margin-bottom: var(--space-md);">No ${MODE_TITLE[appState.mode]} models found.</p>
        <p style="font-size: 0.9rem;">Your API key may not have access to ${MODE_TITLE[appState.mode]} models.</p>
      `;
    }
    grid.innerHTML = `<div class="model-grid-message">${message}</div>`;
    return;
  }

  const filter = appState.modelFilter;
  const newestId = all[0] ? all[0].id : null;
  const recommended = filter ? [] : pickRecommended(all);
  const rest = all.filter((m) => !recommended.includes(m) && modelMatchesFilter(m, filter));

  if (filter && rest.length === 0) {
    grid.innerHTML = `<div class="model-grid-message"><p>No ${MODE_TITLE[appState.mode]} model matches “${escapeHTML(filter)}”.</p></div>`;
    return;
  }

  // Keep the full list folded until it is wanted: the default view is the
  // recommended row and the prompt, which is where most sessions start. A
  // search, or a selection that isn't in the recommended row, opens it.
  const selectedInRest = appState.selectedModel && rest.some((m) => m.id === appState.selectedModel.id);
  const expanded = !!filter || appState.showAllModels || selectedInRest;

  let html = '';
  if (recommended.length) {
    html += `<div class="model-group-head"><span>Recommended</span><span class="model-group-hint">Venice&rsquo;s picks for ${MODE_TITLE[appState.mode]}</span></div>`;
    html += recommended.map((m) => modelCardHTML(m, m.id === newestId)).join('');
  }
  if (rest.length) {
    html += `<button type="button" class="model-group-head model-group-toggle${expanded ? ' expanded' : ''}" onclick="toggleAllModels()" aria-expanded="${expanded}">
        <span>${filter ? 'Matches' : 'All models'} <span class="model-group-caret">&#9662;</span></span>
        <span class="model-group-hint">${rest.length} &middot; newest first</span>
      </button>`;
    if (expanded) html += rest.map((m) => modelCardHTML(m, m.id === newestId)).join('');
  }
  grid.innerHTML = html;

  // Keep the current selection highlighted across a re-render (e.g. filtering).
  if (appState.selectedModel) {
    document.querySelectorAll('.model-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.modelId === appState.selectedModel.id);
    });
  }
}

// Select Model
function selectModel(modelId) {
  const model = (MODELS[appState.mode] || []).find((m) => m.id === modelId);
  if (!model) return;

  appState.selectedModel = model;
  appState.caps = model.caps;

  document.querySelectorAll('.model-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.modelId === modelId);
  });

  applyCapabilities(model.caps);
  updateSelectedModelInfo(model);
}

// Show exactly the controls the selected model accepts, and nothing else.
// Every branch here is driven by VeniceAPI.capabilities(), which is derived
// from the model's own published constraints.
function applyCapabilities(caps) {
  const show = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.style.display = on ? '' : 'none';
  };
  const toggleHidden = (id, hidden) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', hidden);
  };

  if (!caps) {
    renderDurationPills([]);
    renderResolutionPills([]);
    renderAspectRatioPills([]);
    show('upscale-section', false);
    toggleHidden('audio-toggle', true);
    toggleHidden('audio-always-on', true);
    Object.keys(LANES).forEach((lane) => toggleHidden('lane-' + lane, lane !== 'image'));
    toggleHidden('ref-extra-lanes', true);
    renderAllLanes();
    refreshTagUI();
    return;
  }

  // Duration / aspect ratio.
  renderDurationPills(caps.durations);
  renderAspectRatioPills(caps.aspectRatios);

  // Resolution, or the upscale factor that replaces it.
  if (caps.isUpscale) {
    renderResolutionPills([]);
    renderUpscalePills(caps.upscaleFactors);
  } else {
    show('upscale-section', false);
    appState.selectedUpscaleFactor = null;
    renderResolutionPills(caps.resolutions);
  }

  // Audio: a switch only where the model actually accepts the `audio` flag.
  toggleHidden('audio-toggle', !caps.audioToggle);
  toggleHidden('audio-always-on', !(caps.producesAudio && !caps.audioToggle));
  const audioCheckbox = document.getElementById('audio-checkbox');
  if (audioCheckbox && caps.audioToggle) audioCheckbox.checked = true;

  // Reference lanes.
  Object.keys(LANES).forEach((lane) => {
    const max = laneMax(lane);
    toggleHidden('lane-' + lane, max === 0);
    const maxEl = document.getElementById('lane-' + lane + '-max');
    if (maxEl) maxEl.textContent = String(max);
    // Drop anything past the new cap so the numbering can't outrun the model.
    if (appState.refSlots[lane].length > max) {
      const dropped = appState.refSlots[lane].length - max;
      appState.refSlots[lane] = appState.refSlots[lane].slice(0, max);
      syncLaneTextarea(lane);
      showToast(max === 0
        ? `${appState.selectedModel.name} does not accept ${lane} references — ${dropped} removed`
        : `${appState.selectedModel.name} takes at most ${max} ${lane} reference${max === 1 ? '' : 's'} — ${dropped} removed`,
        'warning');
    }
  });

  const extra = document.getElementById('ref-extra-lanes');
  if (extra) extra.classList.toggle('hidden', laneMax('video') === 0 && laneMax('audio') === 0);

  const laneTitle = document.getElementById('lane-image-title');
  if (laneTitle) laneTitle.textContent = caps.imageLane.label;
  const laneField = document.getElementById('lane-image-field');
  if (laneField) laneField.textContent = caps.imageLane.field + '[]';
  const laneHint = document.getElementById('lane-image-hint');
  if (laneHint) {
    laneHint.textContent = caps.refImageMinShortSide
      ? `PNG / JPG / WEBP — this model needs at least ${caps.refImageMinShortSide}px on the short side`
      : 'PNG / JPG / WEBP — faces, scenery, characters';
  }

  // Advanced fields, each gated on a published capability.
  show('end-image-section', caps.endImage !== 'none');
  const endHint = document.getElementById('end-image-hint');
  if (endHint) endHint.textContent = caps.endImage === 'required' ? '(required — this is a transition model)' : '(optional)';
  show('audio-url-section', caps.audioInput);
  show('ref-video-duration-section', caps.supportsReferenceVideoDuration);
  show('negative-prompt-section', caps.supportsNegativePrompt);
  show('seed-section', caps.supportsSeed);

  // Prompt: length limit and, for upscale models, no prompt at all.
  const promptEl = document.getElementById(PROMPT_FIELD[appState.mode]);
  if (promptEl) {
    promptEl.disabled = !caps.supportsPrompt;
    promptEl.placeholder = caps.supportsPrompt
      ? promptEl.dataset.placeholder || promptEl.placeholder
      : 'This model upscales the source clip — no prompt needed.';
  }
  updatePromptCounters(caps.promptLimit);

  renderAllLanes();
  refreshTagUI();
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

  container.innerHTML = ratios.map((r) => `
    <button type="button" class="param-pill ${r === selected ? 'selected' : ''}" data-ratio="${escapeAttr(r)}" onclick="selectAspectRatio('${escapeAttr(r)}')">${escapeHTML(r)}</button>
  `).join('');
}

// Select Aspect Ratio
function selectAspectRatio(ratio) {
  appState.selectedAspectRatio = ratio;
  document.querySelectorAll('#aspect-pills .param-pill').forEach((pill) => {
    pill.classList.toggle('selected', pill.dataset.ratio === ratio);
  });
}

// Render Duration Pills.
// Durations stay strings end to end ("5s", "Auto"): the edit and upscale
// models advertise the literal 'Auto', which parsing to a number destroyed.
function renderDurationPills(durations) {
  const container = document.getElementById('duration-pills');
  const section = document.getElementById('duration-section');
  if (!container) return;

  if (!durations || durations.length === 0) {
    if (section) section.style.display = 'none';
    container.innerHTML = '';
    appState.selectedDuration = null;
    return;
  }
  if (section) section.style.display = '';

  const selected = durations.includes(appState.selectedDuration) ? appState.selectedDuration : durations[0];
  appState.selectedDuration = selected;
  container.innerHTML = durations.map((d) => {
    const label = String(d).toLowerCase() === 'auto' ? 'Auto' : String(d);
    return `<button type="button" class="param-pill ${d === selected ? 'selected' : ''}" data-duration="${escapeAttr(d)}" onclick="selectDuration('${escapeAttr(d)}')">${escapeHTML(label)}</button>`;
  }).join('');
}

// Render Resolution Pills
function renderResolutionPills(resolutions) {
  const container = document.getElementById('resolution-pills');
  const section = document.getElementById('resolution-section');
  if (!container) return;

  if (!resolutions || resolutions.length === 0) {
    if (section) section.style.display = 'none';
    container.innerHTML = '';
    appState.selectedResolution = null;
    return;
  }
  if (section) section.style.display = '';

  const selected = resolutions.includes(appState.selectedResolution) ? appState.selectedResolution : resolutions[0];
  appState.selectedResolution = selected;
  container.innerHTML = resolutions.map((r) => `
    <button type="button" class="param-pill ${r === selected ? 'selected' : ''}" data-resolution="${escapeAttr(r)}" onclick="selectResolution('${escapeAttr(r)}')">${escapeHTML(r)}</button>
  `).join('');
}

// Upscale models take `upscale_factor` in place of `resolution`.
function renderUpscalePills(factors) {
  const container = document.getElementById('upscale-pills');
  const section = document.getElementById('upscale-section');
  if (!container || !section) return;

  if (!factors || factors.length === 0) {
    section.style.display = 'none';
    container.innerHTML = '';
    appState.selectedUpscaleFactor = null;
    return;
  }
  section.style.display = '';

  const selected = factors.includes(appState.selectedUpscaleFactor) ? appState.selectedUpscaleFactor : factors[0];
  appState.selectedUpscaleFactor = selected;
  container.innerHTML = factors.map((f) => `
    <button type="button" class="param-pill ${f === selected ? 'selected' : ''}" data-factor="${f}" onclick="selectUpscaleFactor(${f})">${f}&times;</button>
  `).join('');
}

// Select Duration
function selectDuration(duration) {
  appState.selectedDuration = duration;
  document.querySelectorAll('#duration-pills .param-pill').forEach((pill) => {
    pill.classList.toggle('selected', pill.dataset.duration === String(duration));
  });
}

// Select Resolution
function selectResolution(resolution) {
  appState.selectedResolution = resolution;
  document.querySelectorAll('#resolution-pills .param-pill').forEach((pill) => {
    pill.classList.toggle('selected', pill.dataset.resolution === resolution);
  });
}

// Select Upscale Factor
function selectUpscaleFactor(factor) {
  appState.selectedUpscaleFactor = factor;
  document.querySelectorAll('#upscale-pills .param-pill').forEach((pill) => {
    pill.classList.toggle('selected', parseInt(pill.dataset.factor, 10) === factor);
  });
}

// Fill the seed field with a random value.
function randomizeSeed() {
  const seed = document.getElementById('seed-input');
  if (seed) seed.value = Math.floor(Math.random() * 2147483647);
}

// Update Selected Model Info — the sidebar summary of what this model accepts.
function updateSelectedModelInfo(model) {
  const container = document.getElementById('selected-model-info');
  const caps = model.caps;
  const tags = [];

  if (caps.durations.length) tags.push(formatDurationRange(caps.durations));
  if (caps.isUpscale) tags.push(caps.upscaleFactors.map((f) => f + '×').join(' / ') + ' upscale');
  else if (caps.resolutions.length) tags.push(caps.resolutions.join(', '));
  if (caps.aspectRatios.length) tags.push(caps.aspectRatios.length + ' aspect ratios');

  const featureTags = [];
  if (caps.producesAudio) featureTags.push(caps.audioToggle ? 'Audio (optional)' : 'Audio (always on)');
  if (caps.audioInput) featureTags.push('Audio track in');
  if (caps.elementLane) featureTags.push('@Element refs');
  if (caps.endImage === 'required') featureTags.push('End frame required');
  if (caps.promptLimit !== 5000) featureTags.push(`Prompt ≤ ${caps.promptLimit}`);
  if (caps.refImageMinShortSide) featureTags.push(`Refs ≥ ${caps.refImageMinShortSide}px`);

  container.innerHTML = `
    <p class="selected-model-name">${escapeHTML(model.name)}</p>
    <p class="selected-model-id">${escapeHTML(model.id)}</p>
    <div class="selected-model-tags">
      ${tags.map((t) => `<span class="feature-tag">${escapeHTML(t)}</span>`).join('')}
      ${featureTags.map((t) => `<span class="feature-tag audio">${escapeHTML(t)}</span>`).join('')}
    </div>
  `;
}

// Wire up every prompt field: live counter, tag warnings, and canonicalising
// whatever @-tag spelling the user typed the moment they leave the field.
function setupPromptFields() {
  Object.entries(PROMPT_FIELD).forEach(([mode, id]) => {
    const textarea = document.getElementById(id);
    if (!textarea) return;
    textarea.dataset.placeholder = textarea.placeholder;

    textarea.addEventListener('input', () => {
      updatePromptCounters(appState.caps ? appState.caps.promptLimit : 5000);
      refreshTagUI();
    });

    textarea.addEventListener('blur', () => {
      const canonical = RefTags.normalize(textarea.value);
      if (canonical !== textarea.value) {
        textarea.value = canonical;
        showToast('Reference tags rewritten to the form the API expects', 'info');
        refreshTagUI();
      }
    });
  });
  updatePromptCounters(5000);
}

// Counter under each prompt, using the selected model's own character limit.
function updatePromptCounters(limit) {
  const max = limit || 5000;
  Object.values(PROMPT_FIELD).forEach((id) => {
    const textarea = document.getElementById(id);
    const counter = document.getElementById(id + '-counter');
    if (!textarea || !counter) return;
    const length = textarea.value.length;
    counter.textContent = `${length} / ${max}`;
    counter.classList.toggle('near-limit', length > max * 0.9 && length <= max);
    counter.classList.toggle('over-limit', length > max);
  });
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

// Validation — gated on the selected model's own capabilities, so a field is
// only ever demanded when that model actually needs it.
function validateForm() {
  const errors = {};

  if (!appState.selectedModel) {
    showToast('Please select a model', 'warning');
    return false;
  }

  const caps = appState.caps;
  const promptId = PROMPT_FIELD[appState.mode];
  const promptEl = document.getElementById(promptId);
  const promptText = promptEl ? promptEl.value.trim() : '';

  if (caps.supportsPrompt) {
    if (!promptText) {
      errors[promptId] = appState.mode === 'text-to-video'
        ? 'Prompt is required'
        : 'A motion prompt is required for this model';
    } else if (promptText.length > caps.promptLimit) {
      errors[promptId] = `${appState.selectedModel.name} caps the prompt at ${caps.promptLimit} characters`;
    }
  }

  if (appState.mode === 'image-to-video') {
    if (!appState.uploadedImageUrl) {
      errors['image-url'] = 'Please upload a source image';
    }
    if (caps.endImage === 'required' && !document.getElementById('end-image-url').value.trim()) {
      errors['end-image-url'] = 'This transition model also needs an end frame image URL (Advanced options)';
    }
  } else if (appState.mode === 'reference-to-video') {
    const refCount = appState.refSlots.image.length + appState.refSlots.element.length + appState.refSlots.video.length;
    if (refCount === 0) {
      errors[promptId] = 'Attach at least one reference before generating';
      showToast('Drop a reference image below the model list to get started', 'warning');
    }
    if (appState.refSlots.audio.length && !appState.refSlots.image.length && !appState.refSlots.element.length && !appState.refSlots.video.length) {
      errors[promptId] = 'Reference audio has to accompany an image or video reference';
    }
  } else if (appState.mode === 'video-to-video') {
    if (!appState.uploadedVideoUrl) {
      errors['video-url'] = 'Please upload a source video';
    }
  }

  // A tag pointing at an empty slot reaches the model as literal text, which
  // is never what the user meant.
  if (promptText) {
    const report = RefTags.audit(promptText, {
      image: appState.refSlots.image.length,
      element: (caps && caps.elementLane) ? appState.refSlots.element.length : 0
    });
    if (report.dangling.length) {
      const list = report.dangling.map((d) => RefTags.label(d.kind, d.n)).join(', ');
      errors[promptId] = `${list} has no reference attached — add it or remove the tag`;
    }
  }

  Object.entries(errors).forEach(([field, message]) => {
    const errorEl = document.getElementById(`${field}-error`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
    const inputEl = document.getElementById(field);
    if (inputEl) inputEl.classList.add('input-error');
  });

  if (Object.keys(errors).length) {
    const first = Object.values(errors)[0];
    showToast(first, 'warning');
  }

  document.querySelectorAll('.form-input, .form-textarea').forEach((input) => {
    input.addEventListener('input', () => {
      input.classList.remove('input-error');
      const errorEl = document.getElementById(`${input.id}-error`);
      if (errorEl) errorEl.style.display = 'none';
    }, { once: true });
  });

  return Object.keys(errors).length === 0;
}

// Collect all generation parameters from the form + selected model.
// Shared by Generate and Estimate so the two never drift apart.
function buildGenerationParams() {
  const model = appState.selectedModel;
  const caps = appState.caps;
  const params = {
    model: model.id,
    modelConstraints: model.constraints // used for per-model validation/filtering
  };

  if (caps.aspectRatios.length > 0) {
    params.aspect_ratio = caps.aspectRatios.includes(appState.selectedAspectRatio)
      ? appState.selectedAspectRatio
      : caps.aspectRatios[0];
  }

  if (appState.selectedDuration) params.duration = appState.selectedDuration;
  if (caps.isUpscale) {
    if (appState.selectedUpscaleFactor) params.upscale_factor = appState.selectedUpscaleFactor;
  } else if (appState.selectedResolution) {
    params.resolution = appState.selectedResolution;
  }

  if (caps.audioToggle) {
    const audioEl = document.getElementById('audio-checkbox');
    params.audio = !!(audioEl && audioEl.checked);
  }

  const oneUrl = (id) => {
    const el = document.getElementById(id);
    return el && el.value.trim() ? el.value.trim() : '';
  };

  if (caps.supportsNegativePrompt) {
    const neg = document.getElementById('negative-prompt');
    if (neg && neg.value.trim()) params.negative_prompt = neg.value.trim();
  }
  if (caps.supportsSeed) {
    const seed = document.getElementById('seed-input');
    if (seed && seed.value.trim() !== '') params.seed = seed.value.trim();
  }

  // Reference lanes -> the request arrays they are numbered against. The
  // order of each lane is exactly the order the prompt's @-tags address.
  const laneUrls = (lane) => appState.refSlots[lane].map((s) => s.url);
  const images = laneUrls('image');
  if (images.length) {
    params[caps.imageLane.field] = images;
  }
  if (caps.elementLane && appState.refSlots.element.length) {
    params.elements = appState.refSlots.element.map((s) => ({ frontal_image_url: s.url }));
  }
  if (caps.maxReferenceVideos && appState.refSlots.video.length) {
    params.reference_video_urls = laneUrls('video');
  }
  if (caps.maxReferenceAudio && appState.refSlots.audio.length) {
    params.reference_audio_urls = laneUrls('audio');
  }

  if (caps.endImage !== 'none') {
    const endImageUrl = oneUrl('end-image-url');
    if (endImageUrl) params.end_image_url = endImageUrl;
  }
  if (caps.audioInput) {
    const audioUrl = oneUrl('audio-url');
    if (audioUrl) params.audio_url = audioUrl;
  }
  if (caps.supportsReferenceVideoDuration) {
    const refVideoDur = document.getElementById('ref-video-duration');
    if (refVideoDur && refVideoDur.value.trim() !== '') {
      params.reference_video_total_duration = refVideoDur.value.trim();
    }
  }

  // Prompt + primary visual input, per tab. The prompt is canonicalised here
  // too, so a tag typed as "@image 2" still reaches Venice as "@Image2" even
  // if the field never lost focus.
  const promptEl = document.getElementById(PROMPT_FIELD[appState.mode]);
  if (caps.supportsPrompt && promptEl) {
    params.prompt = RefTags.normalize(promptEl.value.trim());
  }

  if (appState.mode === 'image-to-video') {
    if (appState.uploadedImageUrl) params.image_url = appState.uploadedImageUrl;
  } else if (appState.mode === 'video-to-video') {
    params.video_url = appState.uploadedVideoUrl || '';
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
