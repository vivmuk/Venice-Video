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

    throw new Error(errorMessages[response.status] || `HTTP Error: ${response.status}`);
  }

  // Determine how a model consumes visual input based on its id/constraints.
  // Returns one of: 'text', 'image' (single starting frame via image_url),
  // 'reference' (character/scene refs via reference_image_urls).
  static inputMode(modelId, constraints = {}) {
    const id = (modelId || '').toLowerCase();
    const type = (constraints.model_type || '').toLowerCase();
    if (id.includes('reference-to-video') || type === 'reference-to-video') return 'reference';
    if (id.includes('image-to-video') || type === 'image-to-video') return 'image';
    if (id.includes('video-to-video') || type === 'video-to-video') return 'video';
    return 'text';
  }

  // Build a Venice /video/queue|quote request body that only contains the
  // parameters the selected model actually supports. Centralised so queue()
  // and quote() stay in sync. See Venice API: POST /video/queue.
  static buildRequestBody(params) {
    const c = params.modelConstraints || {};
    const mode = VeniceAPI.inputMode(params.model, c);
    const body = { model: params.model };

    if (params.prompt) body.prompt = params.prompt.trim();
    if (params.negative_prompt && params.negative_prompt.trim()) {
      body.negative_prompt = params.negative_prompt.trim();
    }

    // Duration must be a string like "5s" (not a number). Validate against
    // the model's advertised durations when we know them.
    if (params.duration !== undefined && params.duration !== null && params.duration !== '') {
      let dur;
      if (typeof params.duration === 'string' && params.duration.endsWith('s')) {
        dur = params.duration;
      } else {
        const n = parseInt(params.duration);
        if (!isNaN(n)) dur = `${n}s`;
      }
      if (dur) {
        const allowed = (c.durations || []).map(d =>
          typeof d === 'string' ? (d.endsWith('s') ? d : `${d}s`) : `${d}s`);
        body.duration = (allowed.length && !allowed.includes(dur)) ? allowed[0] : dur;
      }
    }

    // Aspect ratio - only when the model advertises support.
    if (Array.isArray(c.aspect_ratios) && c.aspect_ratios.length > 0) {
      body.aspect_ratio = c.aspect_ratios.includes(params.aspect_ratio)
        ? params.aspect_ratio
        : c.aspect_ratios[0];
    }

    // Resolution - only when supported (or when the model doesn't restrict it).
    if (params.resolution && typeof params.resolution === 'string' && params.resolution.trim()) {
      const res = params.resolution.trim();
      if (Array.isArray(c.resolutions) && c.resolutions.length > 0) {
        body.resolution = c.resolutions.includes(res) ? res : c.resolutions[0];
      } else {
        body.resolution = res;
      }
    }

    // Audio - only when the model can generate it and the user opted in.
    if (c.audio && typeof params.audio === 'boolean') {
      body.audio = params.audio;
    }

    // Seed - optional deterministic seed.
    if (params.seed !== undefined && params.seed !== null && params.seed !== '') {
      const s = parseInt(params.seed);
      if (!isNaN(s)) body.seed = s;
    }

    // Visual inputs, routed by the model's input mode.
    const refs = (params.reference_image_urls || []).filter(Boolean);
    if (mode === 'reference') {
      // Reference-to-video: characters/scenes via reference_image_urls (max 9).
      const all = refs.slice();
      if (params.image_url && !all.includes(params.image_url)) all.unshift(params.image_url);
      if (all.length) body.reference_image_urls = all.slice(0, 9);
    } else if (mode === 'image') {
      // Image-to-video: single starting frame. Pass any extra refs through too.
      if (params.image_url) body.image_url = params.image_url;
      if (params.end_image_url) body.end_image_url = params.end_image_url;
      if (refs.length) body.reference_image_urls = refs.slice(0, 9);
    } else if (mode === 'video') {
      if (params.video_url) body.video_url = params.video_url;
    }

    return { body, mode };
  }

  // Submit a request body to a queue-shaped endpoint and normalise the response.
  async _submitQueue(body) {
    console.log('Queue request body:', JSON.stringify(body, null, 2));
    const data = await this.request('/queue', {
      method: 'POST',
      body: JSON.stringify(body)
    });
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

  // Queue a new video generation request
  async queue(params) {
    // Validate required parameters
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters object is required');
    }
    if (!params.model) {
      throw new Error('Model is required');
    }

    const mode = VeniceAPI.inputMode(params.model, params.modelConstraints || {});
    const hasImage = !!(params.image_url || (params.reference_image_urls && params.reference_image_urls.length));

    if (mode === 'reference') {
      if (!hasImage) {
        throw new Error('At least one reference image is required for this model');
      }
    } else if (mode === 'image' || mode === 'video') {
      if (mode === 'image' && !hasImage) {
        throw new Error('An image is required for image-to-video models');
      }
      if (mode === 'video' && !params.video_url) {
        throw new Error('A source video is required for video-to-video models');
      }
    } else {
      if (!params.prompt) {
        throw new Error('Prompt is required for text-to-video models');
      }
    }
    if (params.prompt && params.prompt.length > 5000) {
      throw new Error('Prompt exceeds maximum length of 5000 characters');
    }

    const { body } = VeniceAPI.buildRequestBody(params);

    try {
      return await this._submitQueue(body);
    } catch (err) {
      // Some models reject image_url and require reference arrays instead.
      // Recover automatically by promoting the image into reference_image_urls.
      const needsRef = /at least one reference|reference_image_urls|reference is required|image_references/i.test(err.message || '');
      if (needsRef && body.image_url && !body.reference_image_urls) {
        console.warn('Model requires references — retrying with reference_image_urls');
        const retry = { ...body, reference_image_urls: [body.image_url] };
        delete retry.image_url;
        return await this._submitQueue(retry);
      }
      throw err;
    }
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
    if (!params || !params.model) {
      throw new Error('Model is required for quote');
    }

    const mode = VeniceAPI.inputMode(params.model, params.modelConstraints || {});
    const hasImage = !!(params.image_url || (params.reference_image_urls && params.reference_image_urls.length));

    if (mode === 'reference' && !hasImage) {
      throw new Error('At least one reference image is required for this model');
    }
    if (mode === 'image' && !hasImage) {
      throw new Error('An image is required for image-to-video models');
    }
    if (mode === 'video' && !params.video_url) {
      throw new Error('A source video is required for video-to-video models');
    }
    if (mode === 'text' && !params.prompt) {
      throw new Error('Prompt is required for text-to-video models');
    }

    const { body } = VeniceAPI.buildRequestBody(params);
    console.log('Quote request body:', JSON.stringify(body, null, 2));

    const data = await this.request('/quote', {
      method: 'POST',
      body: JSON.stringify(body)
    });

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
