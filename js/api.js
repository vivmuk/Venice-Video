// Venice Video API Integration Class

class VeniceAPI {
  constructor(token) {
    if (!token) {
      throw new Error('API token is required');
    }
    this.token = token;
    this.baseUrl = 'https://api.venice.ai/api/v1/video';
    this.modelsBaseUrl = 'https://api.venice.ai/api/v1';
  }

  // Helper method for API requests
  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.handleError(response);
      }

      // Check if response is video
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('video/mp4')) {
        return {
          status: 'completed',
          video_blob: await response.blob(),
          video_url: URL.createObjectURL(await response.blob())
        };
      }

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

  // Queue a new video generation request
  async queue(params) {
    // Validate required parameters
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters object is required');
    }

    if (!params.model) {
      throw new Error('Model is required');
    }

    // For text-to-video, prompt is required
    // For image-to-video, image_url is required
    const isImageToVideo = params.model.includes('image-to-video');

    if (isImageToVideo) {
      if (!params.image_url) {
        throw new Error('Image URL is required for image-to-video models');
      }
    } else {
      if (!params.prompt) {
        throw new Error('Prompt is required for text-to-video models');
      }
      if (params.prompt.length > 5000) {
        throw new Error('Prompt exceeds maximum length of 5000 characters');
      }
    }

    // Build request body
    const body = {
      model: params.model
    };

    if (params.prompt) body.prompt = params.prompt;
    if (params.image_url) body.image_url = params.image_url;
    
    // Duration must be a string like "5s" or "10s", not a number
    // Only include if provided and valid
    if (params.duration !== undefined && params.duration !== null) {
      // If it's already a string with 's', use it; otherwise convert number to string
      if (typeof params.duration === 'string' && params.duration.endsWith('s')) {
        body.duration = params.duration;
      } else {
        const durationNum = parseInt(params.duration);
        if (!isNaN(durationNum)) {
          body.duration = `${durationNum}s`;
        }
      }
    }
    
    // Aspect ratio - only include if model constraints require it
    // Some models require it, others don't support it
    if (params.aspect_ratio) {
      const validAspectRatios = ['16:9', '9:16', '1:1'];
      if (validAspectRatios.includes(params.aspect_ratio)) {
        body.aspect_ratio = params.aspect_ratio;
      }
    } else if (params.modelConstraints && params.modelConstraints.aspect_ratios && params.modelConstraints.aspect_ratios.length > 0) {
      // If model requires aspect_ratio but none provided, use first available
      body.aspect_ratio = params.modelConstraints.aspect_ratios[0];
    }
    
    // Resolution - only include if model supports it and it's provided
    if (params.resolution && typeof params.resolution === 'string' && params.resolution.trim()) {
      body.resolution = params.resolution.trim();
    }

    // Log request body for debugging
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

  // Retrieve video generation status
  async retrieve(queueId, deleteOnCompletion = false) {
    if (!queueId) {
      throw new Error('Queue ID is required');
    }

    const requestBody = {
      queue_id: queueId,
      delete_media_on_completion: deleteOnCompletion
    };

    console.log('Retrieve request body:', JSON.stringify(requestBody, null, 2));

    const data = await this.request('/retrieve', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    console.log('Retrieve response:', JSON.stringify(data, null, 2));

    // Handle video blob response (already handled in request method)
    if (data.status === 'completed' && data.video_url) {
      return {
        status: 'completed',
        progress: 100,
        video_url: data.video_url,
        video_blob: data.video_blob,
        estimated_time_remaining: 0
      };
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

    // For text-to-video, prompt is required
    // For image-to-video, image_url is required
    const isImageToVideo = params.model.includes('image-to-video');

    if (isImageToVideo) {
      if (!params.image_url) {
        throw new Error('Image URL is required for image-to-video models');
      }
    } else {
      if (!params.prompt) {
        throw new Error('Prompt is required for text-to-video models');
      }
    }

    const body = {
      model: params.model
    };

    if (params.prompt) body.prompt = params.prompt;
    if (params.image_url) body.image_url = params.image_url;
    
    // Duration must be a string like "5s" or "10s", not a number
    // Only include if provided and valid
    if (params.duration !== undefined && params.duration !== null) {
      // If it's already a string with 's', use it; otherwise convert number to string
      if (typeof params.duration === 'string' && params.duration.endsWith('s')) {
        body.duration = params.duration;
      } else {
        const durationNum = parseInt(params.duration);
        if (!isNaN(durationNum)) {
          body.duration = `${durationNum}s`;
        }
      }
    }
    
    // Aspect ratio - only include if model constraints require it
    // Some models require it, others don't support it
    if (params.aspect_ratio) {
      const validAspectRatios = ['16:9', '9:16', '1:1'];
      if (validAspectRatios.includes(params.aspect_ratio)) {
        body.aspect_ratio = params.aspect_ratio;
      }
    } else if (params.modelConstraints && params.modelConstraints.aspect_ratios && params.modelConstraints.aspect_ratios.length > 0) {
      // If model requires aspect_ratio but none provided, use first available
      body.aspect_ratio = params.modelConstraints.aspect_ratios[0];
    }
    
    // Resolution - only include if model supports it and it's provided
    if (params.resolution && typeof params.resolution === 'string' && params.resolution.trim()) {
      body.resolution = params.resolution.trim();
    }

    // Log request body for debugging
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

  // Fetch available video models from API
  async getModels() {
    try {
      const response = await fetch(`${this.modelsBaseUrl}/models?type=video`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }
}

// Make VeniceAPI globally accessible
window.VeniceAPI = VeniceAPI;

console.log('VeniceAPI loaded successfully');
