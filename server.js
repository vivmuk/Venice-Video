const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

const SPEC_CACHE_PATH = path.join(__dirname, 'venice-model-spec-cache.json');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 700 * 1024 * 1024 },
});

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
    "media-src 'self' https: blob: data: * https://litterbox.catbox.moe https://files.catbox.moe; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.venice.ai https://api.imgbb.com https://litterbox.catbox.moe;"
  );
  next();
});

// Proxy endpoint to get models (hides API token)
app.get('/api/models', async (req, res) => {
  if (!VENICE_API_TOKEN) {
    return res.status(500).json({ error: 'API token not configured' });
  }

  try {
    // Fetch video models with type=video filter
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
    console.log(`Fetched ${(data.data || []).length} video models from Venice API`);
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

// ----- New endpoints for v2v + Improve (Phase 1) -----

// GET /api/spec-cache — serves the bundled video-model spec snapshot.
app.get('/api/spec-cache', (req, res) => {
  try {
    const data = fs.readFileSync(SPEC_CACHE_PATH, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(data);
  } catch (e) {
    res.status(500).json({ error: 'spec cache missing', detail: e.message });
  }
});

// POST /api/upload — proxy file (image or video) to litterbox.catbox.moe.
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'file too large; max 700 MB' });
      return res.status(415).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: 'no file field' });
    try {
      const isImage = (req.file.mimetype || '').startsWith('image/');
      let payload = req.file.buffer;
      if (isImage) {
        try { payload = await sharp(req.file.buffer).rotate().withMetadata({}).toBuffer(); } catch (e) { /* keep original */ }
      }
      const filename = req.file.originalname || 'upload-' + Date.now();
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('time', '72h');
      const blob = new Blob([payload], { type: req.file.mimetype });
      formData.append('fileToUpload', blob, filename);
      const upstream = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', { method: 'POST', body: formData });
      const text = await upstream.text();
      if (!upstream.ok) throw new Error('litterbox ' + upstream.status + ': ' + text.slice(0, 200));
      return res.json({ url: text.trim(), bytes: req.file.size, mime: req.file.mimetype, isImage });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
});

// POST /api/improve-prompt — Venice chat completion with model-aware system prompt.
app.post('/api/improve-prompt', async (req, res) => {
  if (!VENICE_API_TOKEN) return res.status(500).json({ error: 'VENICE_API_TOKEN env var not set' });
  const { prompt, modelId } = req.body || {};
  if (!prompt || !modelId) return res.status(400).json({ error: 'prompt and modelId required' });
  const systemPrompt = buildSystemPrompt(modelId);
  try {
    const r = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + VENICE_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600,
        temperature: 0.7,
        venice_parameters: { disable_thinking: true, strip_thinking_response: true },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('improve-prompt Venice error:', r.status, JSON.stringify(data).slice(0, 500));
      return res.status(500).json({ error: (data.error && data.error.message) || data.message || 'chat completion failed', veniceStatus: r.status });
    }
    const improved = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim() || prompt;
    return res.json({ original: prompt, improved, model: 'claude-sonnet-4-6' });
  } catch (e) {
    console.error('improve-prompt exception:', e);
    return res.status(500).json({ error: e.message });
  }
});

function buildSystemPrompt(modelId) {
  const id = (modelId || '').toLowerCase();
  const isPreserveFirst = /-video-to-video/.test(id) || /-reference-to-video/.test(id);
  const prefix = isPreserveFirst
    ? 'You are a video-direction consultant for an edit-style V2V / reference-to-video model. The uploaded source video is sacred. Wan-2.7/Grok/HappyHouse edit-models preserve the original ONLY if your rewritten prompt stays below a complexity threshold. Multi-add prompts (2+ characters, props, spatial relations, ethnicities) force a full scene rewrite — original people get replaced. Rule: PRESERVE-FIRST. Add nothing the user did not explicitly request. Prefer minimal phrasing. Avoid cinematic elaboration that adds background detail.'
    : 'You are a video-direction consultant for a generative video model. Rewrite the user intent to be tight, evocative, and concrete.';
  return [
    prefix,
    'Style hint: ' + inferStyleHint(modelId) + '.',
    'Return only the new prompt — no preamble, no labels, no quotes.',
  ].join(' ');
}

function inferStyleHint(modelId) {
  const id = (modelId || '').toLowerCase();
  const hints = [];
  if (/grok|photorealistic/.test(id)) hints.push('photorealistic, natural light, expressive faces');
  if (/kling|cinematic/.test(id)) hints.push('cinematic language: camera movement, lighting, focus pulls');
  if (/wan/.test(id)) hints.push('cinematic mood, sense of motion');
  if (/veo|sora/.test(id)) hints.push('vivid sensory language, scene-driven');
  if (/runway/.test(id)) hints.push('cinematic concise language (max 1000 chars total — be efficient)');
  if (/motion/.test(id)) hints.push('preserve original motion; describe only what moves and where');
  if (/upscale/.test(id)) hints.push('not applicable — do not call for upscale models');
  return hints.length ? hints.join('; ') : 'expand with sensory detail, scene structure, camera direction';
}

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

