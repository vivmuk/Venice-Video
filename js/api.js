// Venice Video API Integration Class
// Now uses server-side proxy endpoints (API token is stored on server)

class VeniceAPI {
  constructor(customToken = null) {
    // Check for custom token (user-provided when server key expires)
    this.customToken = customToken || (typeof getApiKey === 'function' ? getApiKey() : null);

    if (this.customToken) {
      // Use direct Venice API with custom token
      this.baseUrl = 'https://api.venice.ai/api/v1/video';
      this.modelsBaseUrl = 'https://api.venice.ai/api/v1';
      this.useDirectApi = true;
    } else {
      // Use server proxy (server handles authentication)
      this.baseUrl = '/api/video';
      this.modelsBaseUrl = '/api';
      this.useDirectApi = false;
    }
  }

  // Helper method for API requests (uses server proxy or direct API with custom token)
  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // Add authorization header if using custom token
      if (this.useDirectApi && this.customToken) {
        headers['Authorization'] = `Bearer ${this.customToken}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleError(response);
      }

      // Check if response is video - clone the response so we can read it multiple times
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('video/mp4')) {
        // Clone the response before reading to avoid "body stream already read" error
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        return {
          status: 'completed',
          video_blob: blob,
          video_url: videoUrl
        };
      }

      // For JSON responses, read the body
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Request timeout: The server is taking too long to respond.');
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to the Venice API. Check your internet connection.');
      }

      throw error;
    }
  }

  // Handle API errors
  async handleError(response) {
    let errorData = {};
    let errorText = '';
    try {
      errorText = await response.text();
      console.error('Raw API error response:', errorText);
      if (errorText) {
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          // If it's not JSON, use the text as the error message
          errorData = { message: errorText };
        }
      }
    } catch (e) {
      console.error('Error reading response:', e);
    }

    console.error(`API Error ${response.status}:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      errorText: errorText,
      errorData: errorData
    });

    // Build detailed error message
    let errorMessage = errorData.message || errorData.error || errorData.detail || errorText || 'Invalid request parameters';
    if (errorData.details) {
      errorMessage += `: ${JSON.stringify(errorData.details)}`;
    }
    if (errorData.errors) {
      errorMessage += `: ${JSON.stringify(errorData.errors)}`;
    }

    const errorMessages = {
      400: `Bad Request: ${errorMessage}`,
      401: 'Unauthorized: Invalid API token. Please check your API key.',
      402: 'Payment Required: Insufficient credits in your account.',
      404: 'Not Found: The requested resource was not found.',
      413: 'Payload Too Large: Your prompt exceeds the maximum length.',
      422: `Validation Error: ${errorMessage}`,
      429: 'Rate Limited: Too many requests. Please wait a moment.',
      500: 'Server Error: Venice API is experiencing issues. Try again later.'
    };

    // Preserve structured data so callers can self-heal (strip an unsupported
    // parameter and retry) rather than surfacing a raw validation error.
    const err = new Error(errorMessages[response.status] || `HTTP Error: ${response.status}`);
    err.status = response.status;
    err.apiError = errorData;
    throw err;
  }

  // Determine how a model consumes visual input based on its id/constraints.
  // Returns one of: 'text', 'image' (single starting frame via image_url),
  // 'reference' (character/scene refs via reference_image_urls).
  static inputMode(modelId, constraints = {}) {
    const id = (modelId || '').toLowerCase();
    const type = (constraints.model_type || '').toLowerCase();
    if (id.includes('reference-to-video') || type === 'reference-to-video') return 'reference';
    if (id.includes('image-to-video') || type === 'image-to-video') return 'image';
    // Codex fix: video-input models can be recognized by their constraints even
    // when the id / model_type doesn't include 'video-to-video'. Runway Gen-4
    // Aleph and Topaz Video Upscale advertise video_input: true but lack the
    // substring -- sending them to the Text tab caused wrong-form validation.
    if (id.includes('video-to-video')
        || type === 'video-to-video'
        || constraints.video_input === true) {
      return 'video';
    }
    return 'text';
  }

  // Venice's /models payload does not advertise which models accept the
  // `elements[]` / `scene_image_urls[]` multi-subject fields, so the families
  // the video API docs name for it are listed here. Everything else gets the
  // flat `reference_image_urls` lane instead, and the self-healing retry
  // re-routes if the API disagrees with this table.
  static get ELEMENTS_CAPABLE() {
    return /^kling-(o3|v3)[a-z0-9.-]*-reference-to-video$/;
  }

  // Models that need a second image as the end of a transition.
  static get TRANSITION_MODELS() {
    return /-transition$/;
  }

  // The full parameter surface a single model accepts, derived from its own
  // `constraints` wherever Venice publishes them. This is what the UI reads to
  // decide which control to show — nothing is offered generically.
  static capabilities(modelId, constraints = {}) {
    const id = (modelId || '').toLowerCase();
    const c = constraints || {};
    const mode = VeniceAPI.inputMode(modelId, c);

    // Durations arrive as strings ("5s", "Auto"); keep them as strings so the
    // literal 'Auto' the edit/upscale models require survives intact.
    const durations = (Array.isArray(c.durations) ? c.durations : []).map(String);

    // Upscale models advertise their factors in `resolutions` ("2x", "4x") and
    // take `upscale_factor` in place of `resolution`.
    const rawResolutions = (Array.isArray(c.resolutions) ? c.resolutions : []).map(String);
    const factorLike = rawResolutions.filter((r) => /^\d+x$/i.test(r));
    const isUpscale = factorLike.length > 0 && factorLike.length === rawResolutions.length;

    const elementsCapable = VeniceAPI.ELEMENTS_CAPABLE.test(id);
    const isTransition = VeniceAPI.TRANSITION_MODELS.test(id);

    return {
      id: modelId,
      mode,
      durations,
      // Upscale factors replace the resolution pills for upscale models.
      resolutions: isUpscale ? [] : rawResolutions,
      upscaleFactors: isUpscale ? factorLike.map((r) => parseInt(r, 10)) : [],
      isUpscale,
      aspectRatios: Array.isArray(c.aspect_ratios) ? c.aspect_ratios : [],

      // Audio. `audio` says the model can produce a soundtrack;
      // `audio_configurable` says the request may carry the `audio` flag.
      // 26 of Venice's video models generate audio but reject the parameter,
      // so the toggle is only offered when it is actually configurable.
      producesAudio: c.audio === true,
      audioToggle: c.audio_configurable === true,
      // `audio_url` — a background-music track fed into the model.
      audioInput: c.audio_input === true,
      // `reference_audio_urls` — per-reference voice/music donors.
      referenceAudio: c.per_reference_audio === true,
      videoInput: c.video_input === true,

      promptLimit: Number(c.prompt_character_limit) > 0 ? Number(c.prompt_character_limit) : 5000,
      refImageMinShortSide: Number(c.reference_image_min_short_side_pixels) || null,

      // Primary visual input.
      needsImage: mode === 'image',
      needsVideo: mode === 'video',
      needsReference: mode === 'reference',

      // End frame: required by the transition models, optional elsewhere on
      // image-driven models, meaningless for text and video input.
      endImage: isTransition ? 'required' : (mode === 'image' ? 'optional' : 'none'),

      // Tagged reference lanes. `imageLane` is what "@Image1..N" addresses;
      // `elementLane` is what "@Element1..N" addresses (null when the model
      // has no multi-subject support).
      imageLane: {
        field: elementsCapable ? 'scene_image_urls' : 'reference_image_urls',
        max: elementsCapable ? 4 : 9,
        label: elementsCapable ? 'Scenes' : 'Reference Images'
      },
      elementLane: elementsCapable ? { field: 'elements', max: 4, label: 'Subjects' } : null,

      // Untagged extras.
      maxReferenceVideos: (mode === 'reference' || mode === 'video') ? 3 : 0,
      maxReferenceAudio: c.per_reference_audio === true ? 3 : 0,
      supportsReferenceVideoDuration: mode === 'reference' || mode === 'video',
      supportsNegativePrompt: !isUpscale,
      supportsSeed: !isUpscale,
      // Upscale models transform a clip; there is nothing to describe.
      supportsPrompt: !isUpscale
    };
  }

  // Sort key for "newest first".
  //
  // Venice stamps a handful of models (Veo 3.1, LTX Video 2.0, Kling 2.6) with
  // a `created` date exactly one year early — before Venice shipped video at
  // all — which would bury its newest models at the bottom of the list. Any
  // stamp that predates the platform's first video launch is shifted forward a
  // year so the ordering the user sees matches the real release order.
  static releaseRank(model) {
    const created = Number(model && model.created) || 0;
    const FIRST_VIDEO_LAUNCH = Date.UTC(2025, 8, 1) / 1000; // 2025-09-01
    if (created > 0 && created < FIRST_VIDEO_LAUNCH) return created + 365 * 24 * 3600;
    return created;
  }

  // Venice's own curation — the sets it flags as recommended or featured.
  static isRecommended(model) {
    const sets = (model && model.model_spec && model.model_spec.model_sets) || [];
    return sets.indexOf('venice_recommendations') !== -1 || sets.indexOf('featured') !== -1;
  }

  // Build a Venice /video/queue|quote request body that only contains the
  // parameters the selected model actually supports. Centralised so queue()
  // and quote() stay in sync. See Venice API: POST /video/queue.
  static buildRequestBody(params) {
    const c = params.modelConstraints || {};
    const caps = VeniceAPI.capabilities(params.model, c);
    const mode = caps.mode;
    const body = { model: params.model };
    const tags = (typeof RefTags !== 'undefined') ? RefTags : null;

    const toArr = (v) => Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
    const refs = toArr(params.reference_image_urls);
    const scenes = toArr(params.scene_image_urls);
    const elements = Array.isArray(params.elements) ? params.elements.filter(Boolean) : [];

    // Prompt. Reference tags are rewritten into the exact "@Image1"/"@Element1"
    // spelling the API matches on, whatever the user typed.
    if (caps.supportsPrompt && params.prompt) {
      let prompt = params.prompt.trim();
      if (tags) prompt = tags.normalize(prompt);
      if (prompt) body.prompt = prompt.slice(0, caps.promptLimit);
    }
    if (caps.supportsNegativePrompt && params.negative_prompt && params.negative_prompt.trim()) {
      body.negative_prompt = params.negative_prompt.trim().slice(0, caps.promptLimit);
    }

    // Duration is a string: "5s", or the literal "Auto" the edit and upscale
    // models advertise. Whatever the user's selection looks like, the value
    // sent is the model's *own* published spelling for it — matching the
    // constraint list case-insensitively and echoing the entry back means the
    // request always carries a member of that model's enum, whichever casing
    // Venice uses for it.
    if (params.duration !== undefined && params.duration !== null && params.duration !== '') {
      const requested = String(params.duration).trim();
      const wanted = /^\d+$/.test(requested) ? `${requested}s` : requested;
      const published = caps.durations.map(String);
      const match = published.find((d) => d.toLowerCase() === wanted.toLowerCase());
      if (match) {
        body.duration = match;
      } else if (published.length) {
        body.duration = published[0];
      } else if (wanted) {
        body.duration = wanted;
      }
    }

    // Aspect ratio - only when the model advertises support.
    if (caps.aspectRatios.length > 0) {
      body.aspect_ratio = caps.aspectRatios.includes(params.aspect_ratio)
        ? params.aspect_ratio
        : caps.aspectRatios[0];
    }

    // Resolution, or the upscale factor that replaces it on upscale models.
    if (caps.isUpscale) {
      const requested = parseInt(params.upscale_factor !== undefined && params.upscale_factor !== null && params.upscale_factor !== ''
        ? params.upscale_factor
        : String(params.resolution || '').replace(/x$/i, ''), 10);
      const factor = caps.upscaleFactors.includes(requested) ? requested : caps.upscaleFactors[0];
      if (!isNaN(factor)) body.upscale_factor = factor;
    } else if (caps.resolutions.length > 0 && params.resolution && String(params.resolution).trim()) {
      // Only when the model publishes a resolution list. A model that
      // advertises none (Kling O3, Ovi, Runway) picks its own — sending one
      // anyway is a 400.
      const res = String(params.resolution).trim();
      body.resolution = caps.resolutions.includes(res) ? res : caps.resolutions[0];
    }

    // Audio. `audio: true` in the constraints only means the model produces a
    // soundtrack; `audio_configurable` is what says the request may carry the
    // flag. Sending it to a model that generates audio unconditionally is a
    // 400, so the two are kept apart.
    if (caps.audioToggle && typeof params.audio === 'boolean') {
      body.audio = params.audio;
    }

    // Seed - optional deterministic seed.
    if (caps.supportsSeed && params.seed !== undefined && params.seed !== null && params.seed !== '') {
      const s = parseInt(params.seed, 10);
      if (!isNaN(s)) body.seed = s;
    }

    // Primary visual input, routed by the model's input mode.
    if (mode === 'reference') {
      // Reference-to-video: characters/scenes addressed from the prompt.
      // On elements-capable models "@Image" points at scene_image_urls and
      // "@Element" at elements[]; everywhere else both collapse onto the flat
      // reference_image_urls lane.
      const flat = refs.slice();
      if (params.image_url && !flat.includes(params.image_url)) flat.unshift(params.image_url);
      if (caps.elementLane) {
        if (elements.length) body.elements = elements.slice(0, caps.elementLane.max);
        if (scenes.length) body.scene_image_urls = scenes.slice(0, caps.imageLane.max);
        if (flat.length) body.reference_image_urls = flat.slice(0, 9);
      } else if (flat.length) {
        body.reference_image_urls = flat.slice(0, caps.imageLane.max);
      }
    } else if (mode === 'image') {
      // Image-to-video: single starting frame. Pass any extra refs through too.
      if (params.image_url) body.image_url = params.image_url;
      if (refs.length) body.reference_image_urls = refs.slice(0, caps.imageLane.max);
    } else if (mode === 'video') {
      if (params.video_url) body.video_url = params.video_url;
      // V2V edit models (Wan Edit, Grok V2V Private, HappyHorse Edit) commonly
      // accept reference_image_urls for character/scene refs. The auto-heal
      // retry strips them on rejection.
      if (refs.length) body.reference_image_urls = refs.slice(0, caps.imageLane.max);
    } else {
      // text-to-video: still honour explicit reference images if the user
      // supplied them (some text models accept style/character references).
      if (refs.length) body.reference_image_urls = refs.slice(0, caps.imageLane.max);
    }

    // Additional optional media/reference inputs, each gated on the capability
    // the model actually advertises. Caps mirror the documented maximums.
    if (caps.endImage !== 'none' && params.end_image_url) body.end_image_url = params.end_image_url;
    if (params.video_url && mode !== 'video' && caps.videoInput) body.video_url = params.video_url;
    if (caps.audioInput && params.audio_url) body.audio_url = params.audio_url;

    const refVideos = toArr(params.reference_video_urls);
    if (caps.maxReferenceVideos && refVideos.length) {
      body.reference_video_urls = refVideos.slice(0, caps.maxReferenceVideos);
    }

    const refAudio = toArr(params.reference_audio_urls);
    if (caps.maxReferenceAudio && refAudio.length) {
      body.reference_audio_urls = refAudio.slice(0, caps.maxReferenceAudio);
    }

    // Scene images on a model that has no element lane still belong in the
    // request when the caller explicitly supplied them.
    if (!caps.elementLane && scenes.length) body.scene_image_urls = scenes.slice(0, 4);
    if (!caps.elementLane && elements.length) body.elements = elements.slice(0, 4);

    if (caps.supportsReferenceVideoDuration
        && params.reference_video_total_duration !== undefined
        && params.reference_video_total_duration !== null
        && params.reference_video_total_duration !== '') {
      const d = parseInt(params.reference_video_total_duration, 10);
      if (!isNaN(d)) body.reference_video_total_duration = d;
    }

    if (!caps.isUpscale && params.upscale_factor !== undefined && params.upscale_factor !== null && params.upscale_factor !== '') {
      const u = parseInt(params.upscale_factor, 10);
      if (!isNaN(u)) body.upscale_factor = u;
    }

    // Escape hatch: merge any raw custom fields verbatim (advanced users /
    // forward-compat with new Venice parameters). Explicit fields win.
    if (params.customFields && typeof params.customFields === 'object') {
      for (const [k, v] of Object.entries(params.customFields)) {
        if (v !== undefined && v !== null && v !== '' && !(k in body)) {
          body[k] = v;
        }
      }
    }

    return { body, mode, caps };
  }


  // Extract the request-body field names an API 400 flagged as unsupported /
  // invalid / unrecognised, so the caller can strip them and retry. This is how
  // we cope with every model having a different accepted parameter set without
  // hardcoding per-model schemas — the API's own validation is the source of
  // truth. Only fields whose message reads as "not accepted" are returned;
  // "required"/"missing" fields are left for the reference fallback instead.
  static unsupportedFields(apiError) {
    if (!apiError || typeof apiError !== 'object') return [];
    const fields = new Set();
    const isUnsupported = (m) => typeof m === 'string' &&
      /not support|unsupported|unrecogni|unexpected|not allowed|not permitted|cannot be|must not|invalid|no longer|not applicable|not available for/i.test(m) &&
      !/required|missing|at least one|must be provided|must be one of/i.test(m);

    if (Array.isArray(apiError.issues)) {
      for (const issue of apiError.issues) {
        if (issue && Array.isArray(issue.path) && issue.path.length && isUnsupported(issue.message)) {
          fields.add(String(issue.path[0]));
        }
      }
    }
    // Zod-style nested details: { <field>: { _errors: [...] } }
    if (apiError.details && typeof apiError.details === 'object') {
      for (const [key, val] of Object.entries(apiError.details)) {
        if (key === '_errors') continue;
        const errs = val && val._errors;
        if (Array.isArray(errs) && errs.some(isUnsupported)) fields.add(key);
      }
    }
    return [...fields];
  }

  // Move a rejected reference lane onto `reference_image_urls` and rewrite the
  // prompt's tags to match the new positions, so a model that doesn't accept
  // `elements[]` / `scene_image_urls[]` still receives the images the prompt
  // talks about. Mutates `body` in place; a no-op for any other field.
  static _foldReferenceLane(body, field) {
    if (field !== 'elements' && field !== 'scene_image_urls') return;
    const tags = (typeof RefTags !== 'undefined') ? RefTags : null;

    const base = Array.isArray(body.reference_image_urls) ? body.reference_image_urls.filter(Boolean) : [];
    const scenes = Array.isArray(body.scene_image_urls) ? body.scene_image_urls.filter(Boolean) : [];
    const elementUrls = (Array.isArray(body.elements) ? body.elements : [])
      .map((el) => el && (el.frontal_image_url || (el.reference_image_urls || [])[0]))
      .filter(Boolean);

    if (field === 'scene_image_urls') {
      // Scenes are the "@Image" lane already, so they only need shifting past
      // whatever `reference_image_urls` was already carrying.
      if (!scenes.length) return;
      body.reference_image_urls = base.concat(scenes).slice(0, 9);
      if (tags && body.prompt) body.prompt = tags.retarget(body.prompt, 'image', 'image', base.length);
      console.warn('Folded scene_image_urls into reference_image_urls and renumbered the prompt tags');
      return;
    }

    // A model that rejects `elements` has no split reference surface at all, so
    // the whole tagged surface collapses into one array: existing refs, then
    // scenes (which keep their "@Image" identity, shifted past those refs),
    // then the element images renumbered onto "@Image" after them. Folding
    // both together is what keeps "@Image1" from meaning two different
    // pictures once the element images join that same numbering.
    if (!elementUrls.length && !scenes.length) return;
    body.reference_image_urls = base.concat(scenes, elementUrls).slice(0, 9);
    if (tags && body.prompt) {
      if (base.length) body.prompt = tags.retarget(body.prompt, 'image', 'image', base.length);
      body.prompt = tags.retarget(body.prompt, 'element', 'image', base.length + scenes.length);
    }
    delete body.scene_image_urls;
    console.warn('Folded elements (and scene_image_urls) into reference_image_urls and renumbered the prompt tags');
  }

  // POST a body to a queue-shaped endpoint, self-healing on 400s: strip any
  // parameter the model rejects (or promote image_url -> reference_image_urls
  // when references are required) and retry until the request is accepted.
  async _submitHealing(endpoint, initialBody) {
    let body = { ...initialBody };
    let promotedRefs = false;
    const stripped = [];

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        console.log(`${endpoint} request body:`, JSON.stringify(body, null, 2));
        const data = await this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
        if (stripped.length) console.warn(`Succeeded after dropping unsupported params: ${stripped.join(', ')}`);
        return data;
      } catch (err) {
        if (err.status !== 400 || !err.apiError) throw err;

        // 1) References required -> promote the starting image into an array.
        const needsRef = /at least one reference|reference is required|image_references|reference_image_urls/i.test(err.message || '');
        if (needsRef && body.image_url && !body.reference_image_urls && !promotedRefs) {
          promotedRefs = true;
          body = { ...body, reference_image_urls: [body.image_url] };
          delete body.image_url;
          console.warn('Model requires references — retrying with reference_image_urls');
          continue;
        }

        // 2) Unsupported/invalid fields -> strip them and retry. Never strip
        //    the essentials (model/prompt) or a field we can't remove.
        const bad = VeniceAPI.unsupportedFields(err.apiError)
          .filter(f => f in body && f !== 'model' && f !== 'prompt');
        if (bad.length) {
          body = { ...body };
          for (const f of bad) {
            // Dropping a tagged reference lane would silently throw away the
            // user's images and leave "@Element1" in the prompt pointing at
            // nothing. Fold the images into reference_image_urls instead and
            // renumber the prompt tags so they still address the right slot.
            VeniceAPI._foldReferenceLane(body, f);
            delete body[f];
            stripped.push(f);
          }
          console.warn('Dropping unsupported params and retrying:', bad);
          continue;
        }

        throw err;
      }
    }
    throw new Error('Unable to submit request after adjusting parameters for this model.');
  }

  // Shared input validation for queue() and quote() so they never drift.
  static validateInputs(params) {
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters object is required');
    }
    if (!params.model) {
      throw new Error('Model is required');
    }

    const caps = VeniceAPI.capabilities(params.model, params.modelConstraints || {});
    const mode = caps.mode;
    const len = (v) => Array.isArray(v) ? v.filter(Boolean).length : (v ? 1 : 0);
    const elementImages = (params.elements || []).filter((el) => el && (el.frontal_image_url || len(el.reference_image_urls))).length;
    const hasImage = !!(params.image_url || len(params.reference_image_urls) || len(params.scene_image_urls) || elementImages);
    const hasVideo = !!(params.video_url || len(params.reference_video_urls));

    if (mode === 'reference') {
      if (!hasImage && !hasVideo) {
        throw new Error('At least one reference image or video is required for this model');
      }
    } else if (mode === 'image') {
      if (!hasImage) {
        throw new Error('An image is required for image-to-video models');
      }
      if (caps.endImage === 'required' && !params.end_image_url) {
        throw new Error('This transition model needs both a start image and an end frame image');
      }
    } else if (mode === 'video') {
      if (!hasVideo) {
        throw new Error('A source video is required for video-to-video models');
      }
    } else if (!params.prompt) {
      throw new Error('Prompt is required for text-to-video models');
    }

    // reference_audio_urls can never be the only reference input (per API).
    if (len(params.reference_audio_urls) && !hasImage && !hasVideo) {
      throw new Error('Reference audio must be paired with a reference image or video — audio-only input is rejected.');
    }

    // Prompt limit is per-model: Runway caps at 1000, Grok at 4096.
    if (params.prompt && params.prompt.length > caps.promptLimit) {
      throw new Error(`Prompt exceeds this model's maximum length of ${caps.promptLimit} characters`);
    }
  }

  // Queue a new video generation request
  async queue(params) {
    VeniceAPI.validateInputs(params);

    const { body } = VeniceAPI.buildRequestBody(params);
    const data = await this._submitHealing('/queue', body);
    console.log('Queue response:', JSON.stringify(data, null, 2));

    if (!data.queue_id) {
      console.error('Queue response missing queue_id:', data);
      throw new Error('Invalid queue response: queue_id not found in response');
    }
    return {
      queue_id: data.queue_id,
      model: data.model || body.model,
      message: data.message
    };
  }

  // Retrieve video generation status
  async retrieve(queueId, model = null, deleteOnCompletion = false) {
    if (!queueId) {
      throw new Error('Queue ID is required');
    }

    const requestBody = {
      queue_id: queueId,
      delete_media_on_completion: deleteOnCompletion
    };

    // Add model if provided (API may require it)
    if (model) {
      requestBody.model = model;
    }

    console.log('Retrieve request body:', JSON.stringify(requestBody, null, 2));

    const data = await this.request('/retrieve', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    // Handle video blob response (already handled in request method)
    // If data has video_url, it means the video is ready
    if (data.status === 'completed' && data.video_url) {
      console.log('Video completed!', data.video_url);
      return {
        status: 'completed',
        progress: 100,
        video_url: data.video_url,
        video_blob: data.video_blob,
        estimated_time_remaining: 0
      };
    }

    // For processing status, log minimal info to avoid cluttering console
    if (data.status === 'PROCESSING' || data.status === 'processing') {
      const progress = data.average_execution_time && data.execution_duration
        ? Math.min(95, Math.round((data.execution_duration / data.average_execution_time) * 100))
        : 0;
      console.log(`Processing... ${progress}% (${data.execution_duration}ms / ${data.average_execution_time}ms)`);
    } else {
      console.log('Retrieve response:', JSON.stringify(data, null, 2));
    }

    // Calculate progress if we have timing info
    let progress = 0;
    if (data.average_execution_time && data.execution_duration) {
      progress = Math.min(95, Math.round((data.execution_duration / data.average_execution_time) * 100));
    }

    return {
      status: data.status ? data.status.toLowerCase() : 'processing',
      progress: progress,
      video_url: data.video_url,
      estimated_time_remaining: data.average_execution_time
        ? Math.max(0, (data.average_execution_time - data.execution_duration) / 1000)
        : null
    };
  }

  // Get cost quote for video generation
  async quote(params) {
    VeniceAPI.validateInputs(params);

    const { body } = VeniceAPI.buildRequestBody(params);
    const data = await this._submitHealing('/quote', body);

    return {
      estimated_cost: data.quote || data.estimated_cost,
      credits_required: data.quote || data.credits_required
    };
  }

  // Complete and cleanup video storage
  async complete(queueId) {
    if (!queueId) {
      throw new Error('Queue ID is required');
    }

    const data = await this.request('/complete', {
      method: 'POST',
      body: JSON.stringify({ queue_id: queueId })
    });

    return {
      success: data.success !== false,
      message: data.message || 'Storage cleanup completed'
    };
  }

  // Fetch available video models from API (via server proxy or direct with custom token)
  async getModels() {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      // Add authorization header if using custom token
      if (this.useDirectApi && this.customToken) {
        headers['Authorization'] = `Bearer ${this.customToken}`;
      }

      // Fetch video models with type=video filter
      const response = await fetch(`${this.modelsBaseUrl}/models?type=video`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      const models = data.data || [];
      
      console.log(`API returned ${models.length} video models`);
      return models;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }
}

// Make VeniceAPI globally accessible
window.VeniceAPI = VeniceAPI;

console.log('VeniceAPI loaded successfully');
