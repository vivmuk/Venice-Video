Based on my thorough exploration of the Venice AI Video Generation API documentation, here's a comprehensive explanation of how the API works and a complete Markdown file you can provide to Cursor for implementation:

## How the Venice AI Video Generation API Works

The Venice AI Video Generation API operates as an **asynchronous queue system** with 4 main endpoints:

### **Workflow:**

1. **POST /video/queue** - Submit a video generation request and receive a `queue_id`
2. **POST /video/retrieve** - Poll with the `queue_id` to check status and retrieve the MP4 when ready
3. **POST /video/quote** (optional) - Get a cost estimate before generating
4. **POST /video/complete** (optional) - Clean up the video from storage after download

The process is asynchronous because video generation takes time (1-3 minutes typically). You submit a request, get a queue ID, then poll the retrieve endpoint until the video is ready.

### **Key Features:**
- **29 video models available** (text-to-video and image-to-video)
- Supports multiple durations (4s, 6s, 8s, 10s, 12s, etc. depending on model)
- Resolution support up to 2160p (model-dependent)
- Audio generation support on select models
- Auto-delete option to automatically clean up storage

***

## Complete Implementation Guide (MD File for Cursor)

```markdown
# Venice AI Video Generation API Implementation Guide

## Overview
Venice AI provides an async video generation API with 4 main endpoints. Video generation is asynchronous - you queue a request, receive a queue_id, then poll for completion.

## Base URL
```
https://api.venice.ai/api/v1
```

## Authentication
All requests require Bearer token authentication:
```
Authorization: Bearer <your_api_token>
```

---

## Endpoints

### 1. POST /video/queue
**Purpose:** Submit a new video generation request

**Endpoint:** `POST https://api.venice.ai/api/v1/video/queue`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body Parameters:**
```
{
  "model": "string",              // Required: Model ID (e.g., "veo3-fast-text-to-video")
  "prompt": "string",             // Required: Text description for video generation
  "duration": number,             // Optional: Video length in seconds (model-dependent: 4, 6, 8, 10, 12, etc.)
  "aspect_ratio": "string",       // Optional: Video aspect ratio
  "resolution": "string",         // Optional: Video resolution (720p, 1080p, 2160p - model-dependent)
  "image_url": "string"           // Optional: For image-to-video models only
}
```

**Response (200 - Success):**
```
{
  "model": "video-model-123",
  "queue_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Error Responses:**
- `400` - Bad Request
- `401` - Unauthorized
- `402` - Payment Required
- `413` - Payload Too Large
- `500` - Internal Server Error

**Example cURL:**
```
curl --request POST \
  --url https://api.venice.ai/api/v1/video/queue \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "veo3-fast-text-to-video",
    "prompt": "Cinematic shot of a sunset over mountains",
    "duration": 8
  }'
```

---

### 2. POST /video/retrieve
**Purpose:** Check status and retrieve completed video

**Endpoint:** `POST https://api.venice.ai/api/v1/video/retrieve`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body Parameters:**
```
{
  "queue_id": "string",                    // Required: Queue ID from /video/queue response
  "delete_media_on_completion": boolean    // Optional: Auto-delete after retrieval (default: false)
}
```

**Response Types:**

**1. Processing (200 - JSON):**
```
{
  "status": "PROCESSING",
  "average_execution_time": 145000,    // milliseconds
  "execution_duration": 53200          // milliseconds
}
```

**2. Complete (200 - video/mp4):**
Returns the video file as MP4 binary data

**Error Responses:**
- `400` - Bad Request
- `401` - Unauthorized  
- `404` - Queue ID not found
- `422` - Unprocessable Entity
- `500` - Internal Server Error

**Example cURL:**
```
curl --request POST \
  --url https://api.venice.ai/api/v1/video/retrieve \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "queue_id": "123e4567-e89b-12d3-a456-426614174000",
    "delete_media_on_completion": true
  }'
```

**Important:** Set `delete_media_on_completion: true` to automatically clean up storage and avoid needing to call `/video/complete`.

---

### 3. POST /video/quote
**Purpose:** Get cost estimate before generating

**Endpoint:** `POST https://api.venice.ai/api/v1/video/quote`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:** Same parameters as `/video/queue`

**Response (200):**
```
{
  "quote": 123    // Cost in USD
}
```

**Error Responses:**
- `400` - Bad Request
- `401` - Unauthorized

**Example cURL:**
```
curl --request POST \
  --url https://api.venice.ai/api/v1/video/quote \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model": "veo3-fast-text-to-video",
    "prompt": "Cinematic shot of a sunset over mountains",
    "duration": 8
  }'
```

---

### 4. POST /video/complete
**Purpose:** Delete video from storage after download

**Endpoint:** `POST https://api.venice.ai/api/v1/video/complete`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body Parameters:**
```
{
  "queue_id": "string"    // Required: Queue ID to clean up
}
```

**Response (200):**
```
{
  "success": true
}
```

**Error Responses:**
- `400` - Bad Request
- `401` - Unauthorized
- `500` - Internal Server Error

**Example cURL:**
```
curl --request POST \
  --url https://api.venice.ai/api/v1/video/complete \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "queue_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Note:** You can skip this endpoint if you set `delete_media_on_completion: true` in the retrieve request.

---

## Available Video Models

### Text-to-Video Models:
- `veo3-fast-text-to-video` - Fast, up to 1080p, 4-8s, Audio
- `veo3-full-text-to-video` - Full quality, up to 1080p, 4-8s, Audio
- `veo3.1-fast-text-to-video` - Fast, up to 1080p, 4-8s, Audio
- `veo3.1-full-text-to-video` - Full quality, up to 1080p, 4-8s, Audio
- `sora-2-text-to-video` - 720p, 4-12s, Audio
- `sora-2-pro-text-to-video` - 1080p, 4-12s, Audio
- `wan-2.5-preview-text-to-video` - up to 480p, 5-10s, Audio
- `wan-2.2-a14b-text-to-video` - up to 480p, 5s
- `kling-2.6-pro-text-to-video` - 5-10s, Audio
- `kling-2.5-turbo-pro-text-to-video` - 5-10s
- `ltx-2-fast-text-to-video` - up to 2160p, 6-20s, Audio
- `ltx-2-full-text-to-video` - up to 2160p, 6-10s, Audio
- `longcat-distilled-text-to-video` - up to 720p, 5-30s
- `longcat-text-to-video` - up to 720p, 5-30s

### Image-to-Video Models:
- `veo3-fast-image-to-video` - 8s, Audio
- `veo3-full-image-to-video` - 8s, Audio
- `veo3.1-fast-image-to-video` - up to 1080p, 8s, Audio
- `veo3.1-full-image-to-video` - up to 1080p, 8s, Audio
- `sora-2-image-to-video` - 720p, 4-12s, Audio
- `sora-2-pro-image-to-video` - 1080p, 4-12s, Audio
- `wan-2.5-preview-image-to-video` - up to 480p, 5-10s, Audio
- `wan-2.1-pro-image-to-video` - 6s
- `kling-2.6-pro-image-to-video` - 5-10s, Audio
- `kling-2.5-turbo-pro-image-to-video` - 5-10s
- `ltx-2-fast-image-to-video` - up to 2160p, 6-20s, Audio
- `ltx-2-full-image-to-video` - up to 2160p, 6-10s, Audio
- `longcat-distilled-image-to-video` - up to 720p, 5-30s
- `longcat-image-to-video` - up to 720p, 5-30s
- `ovi-image-to-video` - 5s, Audio

---

## Implementation Workflow

### Basic Flow:
```
1. [Optional] Call /video/quote to get cost estimate
2. Call /video/queue with parameters → receive queue_id
3. Poll /video/retrieve with queue_id every 5-10 seconds
4. When status != "PROCESSING", download MP4
5. [Optional] Call /video/complete to clean up (or use auto-delete)
```

### Recommended Implementation:
```
import time
import requests

API_BASE = "https://api.venice.ai/api/v1"
HEADERS = {
    "Authorization": f"Bearer {YOUR_TOKEN}",
    "Content-Type": "application/json"
}

# Step 1: Queue video generation
queue_response = requests.post(
    f"{API_BASE}/video/queue",
    headers=HEADERS,
    json={
        "model": "veo3-fast-text-to-video",
        "prompt": "Cinematic shot of a sunset over mountains",
        "duration": 8
    }
)
queue_id = queue_response.json()["queue_id"]

# Step 2: Poll for completion
while True:
    retrieve_response = requests.post(
        f"{API_BASE}/video/retrieve",
        headers=HEADERS,
        json={
            "queue_id": queue_id,
            "delete_media_on_completion": True  # Auto-cleanup
        }
    )
    
    if retrieve_response.headers.get("Content-Type") == "video/mp4":
        # Video is ready
        with open("output.mp4", "wb") as f:
            f.write(retrieve_response.content)
        break
    else:
        # Still processing
        status_data = retrieve_response.json()
        print(f"Status: {status_data['status']}")
        print(f"Progress: {status_data['execution_duration']}ms / {status_data['average_execution_time']}ms")
        time.sleep(10)  # Wait 10 seconds before next poll
```

---

## Best Practices

1. **Use webhooks if available** instead of polling (check API docs for webhook support)
2. **Set `delete_media_on_completion: true`** to avoid manual cleanup
3. **Poll every 10-15 seconds** to balance responsiveness and API load
4. **Use /video/quote** before generation to estimate costs
5. **Handle all error codes** appropriately (401, 402, 413, etc.)
6. **Store queue_ids** persistently in case of application restart
7. **Implement exponential backoff** for failed retrieve attempts

---

## Notes
- Video generation typically takes 1-3 minutes depending on model
- Some models support audio generation
- Duration and resolution options vary by model
- For image-to-video, provide `image_url` in request body
- API uses Bearer token authentication
- Async pattern requires polling or webhooks
```

***

This comprehensive guide includes all four endpoints, all available models (29 total), request/response formats, error codes, and implementation examples.[1][2][3][4][5]

[1](https://veniceai-sabrina-activate-videos-page.mintlify.app/api-reference/endpoint/video/queue)
[2](https://veniceai-sabrina-activate-videos-page.mintlify.app/api-reference/endpoint/video/retrieve)
[3](https://veniceai-sabrina-activate-videos-page.mintlify.app/api-reference/endpoint/video/quote)
[4](https://veniceai-sabrina-activate-videos-page.mintlify.app/api-reference/endpoint/video/complete)
[5](https://veniceai-sabrina-activate-videos-page.mintlify.app/models/video)