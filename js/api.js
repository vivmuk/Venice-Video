// Venice Video API Integration Class

class VeniceAPI {
  constructor(token) {
    if (!token) {
      throw new Error('API token is required');
    }
    this.token = token;
    this.baseUrl = 'https://api.venice.ai/api/v1/video';
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
    try {
      const text = await response.text();
      if (text) {
        errorData = JSON.parse(text);
      }
    } catch (e) {
      // If parsing fails, errorData remains empty object
    }

    console.error(`API Error ${response.status}:`, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      errorData
    });

    // Build detailed error message
    let errorMessage = errorData.message || errorData.error || 'Invalid request parameters';
    if (errorData.details) {
      errorMessage += `: ${JSON.stringify(errorData.details)}`;
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

    // Build request body - only include defined parameters
    const body = {
      model: params.model
    };

    if (params.prompt) body.prompt = params.prompt;
    if (params.image_url) body.image_url = params.image_url;
    if (params.duration !== undefined && params.duration !== null && !isNaN(params.duration)) {
      body.duration = parseInt(params.duration);
    }
    // Only include aspect_ratio if it's a valid non-empty string
    if (params.aspect_ratio && typeof params.aspect_ratio === 'string' && params.aspect_ratio.trim()) {
      body.aspect_ratio = params.aspect_ratio.trim();
    }
    // Only include resolution if it's a valid non-empty string
    if (params.resolution && typeof params.resolution === 'string' && params.resolution.trim()) {
      body.resolution = params.resolution.trim();
    }

    // Log request body for debugging
    console.log('Queue request body:', JSON.stringify(body, null, 2));

    const data = await this.request('/queue', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return {
      queue_id: data.queue_id,
      model: data.model,
      message: data.message
    };
  }

  // Retrieve video generation status
  async retrieve(queueId, deleteOnCompletion = false) {
    if (!queueId) {
      throw new Error('Queue ID is required');
    }

    const data = await this.request('/retrieve', {
      method: 'POST',
      body: JSON.stringify({
        queue_id: queueId,
        delete_media_on_completion: deleteOnCompletion
      })
    });

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
    if (params.duration !== undefined && params.duration !== null && !isNaN(params.duration)) {
      body.duration = parseInt(params.duration);
    }
    // Only include aspect_ratio if it's a valid non-empty string
    if (params.aspect_ratio && typeof params.aspect_ratio === 'string' && params.aspect_ratio.trim()) {
      body.aspect_ratio = params.aspect_ratio.trim();
    }
    // Only include resolution if it's a valid non-empty string
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
}

// Make VeniceAPI globally accessible
window.VeniceAPI = VeniceAPI;

console.log('VeniceAPI loaded successfully');
