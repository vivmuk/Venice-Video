const express = require('express');
const path = require('path');

// Use built-in fetch for Node 18+, or node-fetch for older versions
let fetch;
if (typeof globalThis.fetch !== 'undefined') {
  // Node 18+ has built-in fetch
  fetch = globalThis.fetch;
} else {
  // Fallback to node-fetch for older Node versions
  fetch = require('node-fetch');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Get API token from environment variable
const VENICE_API_TOKEN = process.env.VENICE_API_TOKEN;

if (!VENICE_API_TOKEN) {
  console.warn('WARNING: VENICE_API_TOKEN environment variable is not set. API calls will fail.');
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Set Content Security Policy headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "media-src 'self' https: blob: data: *; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.venice.ai https://api.imgbb.com;"
  );
  next();
});

// Proxy endpoint to get models (hides API token)
app.get('/api/models', async (req, res) => {
  if (!VENICE_API_TOKEN) {
    return res.status(500).json({ error: 'API token not configured' });
  }

  try {
    const response = await fetch('https://api.venice.ai/api/v1/models?type=video', {
      headers: {
        'Authorization': `Bearer ${VENICE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for video queue
app.post('/api/video/queue', async (req, res) => {
  if (!VENICE_API_TOKEN) {
    return res.status(500).json({ error: 'API token not configured' });
  }

  try {
    const response = await fetch('https://api.venice.ai/api/v1/video/queue', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error queueing video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for video retrieve
app.post('/api/video/retrieve', async (req, res) => {
  if (!VENICE_API_TOKEN) {
    return res.status(500).json({ error: 'API token not configured' });
  }

  try {
    const response = await fetch('https://api.venice.ai/api/v1/video/retrieve', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    // Check if response is video (binary)
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('video/mp4')) {
      // Handle video response - convert to buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }

    // Otherwise it's JSON
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error retrieving video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint for video quote
app.post('/api/video/quote', async (req, res) => {
  if (!VENICE_API_TOKEN) {
    return res.status(500).json({ error: 'API token not configured' });
  }

  try {
    const response = await fetch('https://api.venice.ai/api/v1/video/quote', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Error getting quote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve index.html for all other routes (for SPA routing if needed)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (VENICE_API_TOKEN) {
    console.log('Venice API token is configured');
  } else {
    console.log('WARNING: Venice API token is not configured');
  }
});

