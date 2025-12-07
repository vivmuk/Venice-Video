# Venice Video API Interface

A clean, Swiss-designed interface for generating videos using the Venice AI API. This application provides a simple tabbed interface for inputting parameters, monitoring processing status, and displaying generated videos.

## Features

- **Input Tab**: Configure all parameters for video generation
- **Processing Tab**: Monitor the status of video generation
- **Video Display Tab**: View and download generated videos
- **Swiss Design**: Clean typography, ample whitespace, and minimal color palette
- **Responsive Layout**: Works on desktop and mobile devices

## Usage

1. Navigate to the "Input" tab
2. Fill in the video parameters:
   - **Prompt**: Describe the video you want to generate
   - **Duration**: Set the length of the video in seconds
   - **Style**: Choose a visual style for the video
   - **Camera Movement**: Select camera motion options
   - **Resolution**: Set the output resolution
   - **Aspect Ratio**: Choose the video aspect ratio
3. Click "Generate Video" to start the process
4. Switch to the "Processing" tab to monitor progress
5. Once complete, view the video in the "Video Display" tab

## Parameter Showcase

### Video Models

#### Text-to-Video Models

| Model Name | Max Resolution | Duration Range | Audio Support | Special Features |
|------------|----------------|----------------|---------------|------------------|
| veo3-fast-text-to-video | 1080p | 4-8s | Yes | Fast generation |
| veo3-full-text-to-video | 1080p | 4-8s | Yes | Full quality |
| veo3.1-fast-text-to-video | 1080p | 4-8s | Yes | Updated fast model |
| veo3.1-full-text-to-video | 1080p | 4-8s | Yes | Updated full quality |
| sora-2-text-to-video | 720p | 4-12s | Yes | Sora 2 model |
| sora-2-pro-text-to-video | 1080p | 4-12s | Yes | Sora 2 Pro model |
| wan-2.5-preview-text-to-video | 480p | 5-10s | Yes | WAN 2.5 preview |
| wan-2.2-a14b-text-to-video | 480p | 5s | No | WAN 2.2 A14B |
| kling-2.6-pro-text-to-video | N/A | 5-10s | Yes | Kling 2.6 Pro |
| kling-2.5-turbo-pro-text-to-video | N/A | 5-10s | No | Kling 2.5 Turbo Pro |
| ltx-2-fast-text-to-video | 2160p | 6-20s | Yes | LTX 2 Fast |
| ltx-2-full-text-to-video | 2160p | 6-10s | Yes | LTX 2 Full |
| longcat-distilled-text-to-video | 720p | 5-30s | No | Distilled model |
| longcat-text-to-video | 720p | 5-30s | No | Longcat model |

#### Image-to-Video Models

| Model Name | Max Resolution | Duration Range | Audio Support | Special Features |
|------------|----------------|----------------|---------------|------------------|
| veo3-fast-image-to-video | N/A | 8s | Yes | Fast generation |
| veo3-full-image-to-video | N/A | 8s | Yes | Full quality |
| veo3.1-fast-image-to-video | 1080p | 8s | Yes | Updated fast model |
| veo3.1-full-image-to-video | 1080p | 8s | Yes | Updated full quality |
| sora-2-image-to-video | 720p | 4-12s | Yes | Sora 2 model |
| sora-2-pro-image-to-video | 1080p | 4-12s | Yes | Sora 2 Pro model |
| wan-2.5-preview-image-to-video | 480p | 5-10s | Yes | WAN 2.5 preview |
| wan-2.1-pro-image-to-video | N/A | 6s | No | WAN 2.1 Pro |
| kling-2.6-pro-image-to-video | N/A | 5-10s | Yes | Kling 2.6 Pro |
| kling-2.5-turbo-pro-image-to-video | N/A | 5-10s | No | Kling 2.5 Turbo Pro |
| ltx-2-fast-image-to-video | 2160p | 6-20s | Yes | LTX 2 Fast |
| ltx-2-full-image-to-video | 2160p | 6-10s | Yes | LTX 2 Full |
| longcat-distilled-image-to-video | 720p | 5-30s | No | Distilled model |
| longcat-image-to-video | 720p | 5-30s | No | Longcat model |
| ovi-image-to-video | N/A | 5s | Yes | OVI model |

### Parameter Details

#### Model Selection Guidelines

- **Text-to-Video Models**: Use for generating videos from text descriptions
- **Image-to-Video Models**: Use for animating existing images
- **Fast Models**: Prioritize speed over quality
- **Full Quality Models**: Prioritize quality over speed
- **High Resolution Models**: Use for 4K output (2160p)
- **Audio Support**: Models with audio can generate soundtracks

#### Duration Options

- Range: 4 seconds to 30 seconds
- Model-dependent available options
- Common durations: 4s, 5s, 6s, 8s, 10s, 12s, 20s, 30s

#### Resolution Options

- 480p (SD)
- 720p (HD)
- 1080p (Full HD)
- 2160p (4K)

#### Aspect Ratio Options

- 1:1 (Square)
- 4:3 (Standard)
- 16:9 (Widescreen)
- 9:16 (Vertical)

#### Audio Generation Support

- Available on select models
- Automatically generated based on video content
- Cannot be customized separately

#### Auto-Delete Feature

- Automatically cleans up video storage after retrieval
- Set `delete_media_on_completion: true` in retrieve request
- Prevents manual cleanup via `/video/complete` endpoint

### API Workflow

#### 4-Endpoint Asynchronous Workflow

1. **Queue Submission** (`POST /video/queue`)
   - Submit video generation parameters
   - Receive unique `queue_id` for tracking

2. **Status Polling** (`POST /video/retrieve`)
   - Poll with `queue_id` to check progress
   - Returns "PROCESSING" status with timing info
   - Returns MP4 video when complete

3. **Video Retrieval**
   - When processing completes, endpoint returns MP4 binary
   - Download and save video file

4. **Storage Cleanup** (`POST /video/complete`)
   - Optional cleanup of stored video
   - Not needed if using auto-delete feature

### Error Handling Reference

| HTTP Code | Error Type | Common Causes | Solutions |
|-----------|------------|---------------|-----------|
| 400 | Bad Request | Invalid parameters, missing required fields | Check request format and required parameters |
| 401 | Unauthorized | Missing or invalid API token | Verify Bearer token in Authorization header |
| 402 | Payment Required | Insufficient credits or account issues | Check account balance and payment method |
| 404 | Not Found | Invalid queue_id or endpoint | Verify queue_id and endpoint URL |
| 413 | Payload Too Large | Image file too large for upload | Compress image or use smaller resolution |
| 422 | Unprocessable Entity | Semantic errors in request | Check parameter values and constraints |
| 500 | Internal Server Error | Server-side issues | Retry request or contact support |

### Usage Examples

#### Simple Text-to-Video Generation

```json
{
  "model": "veo3-fast-text-to-video",
  "prompt": "Cinematic shot of a sunset over mountains",
  "duration": 8,
  "aspect_ratio": "16:9",
  "resolution": "1080p"
}
```

#### Image-to-Video with Parameters

```json
{
  "model": "veo3.1-fast-image-to-video",
  "prompt": "Add motion to this landscape photo",
  "image_url": "https://example.com/landscape.jpg",
  "duration": 8,
  "aspect_ratio": "16:9"
}
```

#### Cost Estimation Workflow

1. Call `POST /video/quote` with same parameters as queue
2. Receive cost estimate in USD
3. Confirm before calling `POST /video/queue`

#### Best Practices for Parameter Selection

1. Match duration to content complexity
2. Use higher resolution models only when needed
3. Select aspect ratio based on display platform
4. Use fast models for prototyping
5. Use full quality models for final outputs
6. Enable auto-delete to simplify cleanup
7. Always validate parameters before submission

## Deployment

### Railway Deployment

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Deploy to Railway**:
   - Connect your GitHub repository to Railway
   - Railway will automatically detect the `package.json` and `server.js`
   - The server will start automatically with the correct CSP headers

3. **Environment Variables** (if needed):
   - Railway will use the PORT environment variable automatically
   - No additional configuration needed

The server includes proper Content Security Policy headers to allow:
- Blob URLs for video playback
- API connections to Venice AI and imgbb.com
- Google Fonts for styling

## Technical Overview

This application is built with:

- **Node.js/Express** for serving static files with proper headers
- **HTML5** for structure
- **Milligram CSS Framework** for base styling
- **Custom CSS** for Swiss design principles
- **Vanilla JavaScript** for interactivity and API integration

All code is organized in the following files:

- `server.js`: Express server with CSP headers
- `package.json`: Node.js dependencies and scripts
- `index.html`: Main HTML structure
- `css/milligram.min.css`: Base CSS framework
- `css/styles.css`: Custom styling
- `js/api.js`: Venice API integration class
- `js/app.js`: Main application logic
- `js/components.js`: UI component functions
- `js/utils.js`: Utility functions
- `js/main.js`: Application initialization
- `js/state.js`: Global state management