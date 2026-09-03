# Venice Video API Interface

A clean, Swiss-designed interface for generating videos using the Venice AI API. This application provides a simple tabbed interface for inputting parameters, monitoring processing status, and displaying generated videos.

## Features

- **Four model categories, all models listed**: Text-, Image-, Reference- and
  Video-to-video each get their own tab. Reference-to-video is now a first-class
  category rather than being folded into Image, because its inputs and prompt
  syntax are different.
- **Recommended first, then newest first**: each tab opens on two or three
  models Venice itself flags (`venice_recommendations` / `featured`), with the
  full list — every model the API returns — folded behind *All models*, ordered
  newest first. A filter box narrows the list by name, id or model set.
- **Reference tags that stay correct**: every reference you drop is numbered and
  labelled (`@Image1`, `@Image2`, `@Element1`…). Click a chip to insert that tag
  at the caret; type `@ref 2`, `@character3` or `@picture-1` and it is rewritten
  into the exact spelling Venice matches on. Delete a reference and the later
  tags in your prompt renumber themselves, so the prompt never drifts out of
  sync with the request arrays.
- **Model-aware parameters**: every control is derived from the selected model's
  own `constraints` — duration, aspect ratio, resolution or upscale factor,
  audio, prompt length, reference caps and which reference lanes exist. Controls
  a model does not accept are not shown at all.
- **Self-healing requests**: if Venice rejects a specific field, the app strips
  exactly that field — read from the API's own error `path` — and retries. When
  the rejected field is a tagged reference lane (`elements` / `scene_image_urls`)
  its images are folded into `reference_image_urls` and the prompt's tags are
  renumbered to follow them, so the references still bind.
- **Audio done properly**: `audio: true` in the constraints only means the model
  produces a soundtrack; `audio_configurable` is what says the request may carry
  the `audio` flag. The toggle appears only for the 44 models that accept it;
  the rest show a note saying audio is always on.
- **Swiss Design**: clean typography, ample whitespace, and a minimal palette.
- **Responsive Layout**: works on desktop and mobile devices.

## How parameters are chosen per model

`VeniceAPI.capabilities(modelId, constraints)` is the single source of truth. It
reads the model's published constraints and returns the exact parameter surface
for that model; the UI and the request builder both read from it.

| Constraint | Drives |
|---|---|
| `model_type`, `video_input`, id suffix | Which tab the model appears in (text / image / reference / video) |
| `durations` | Duration pills. Kept as strings, so the literal `Auto` the edit and upscale models require survives |
| `aspect_ratios` | Aspect-ratio pills — hidden entirely when the list is empty |
| `resolutions` | Resolution pills; a list of `2x` / `4x` marks an upscale model, which gets Upscale Factor pills and sends `upscale_factor` instead of `resolution` |
| `audio` | Whether the model produces sound |
| `audio_configurable` | Whether the `audio` toggle is offered at all |
| `audio_input` | Whether the Audio Track URL (`audio_url`) field is shown |
| `per_reference_audio` | Whether the Reference Audio lane (`reference_audio_urls`) is shown |
| `prompt_character_limit` | The prompt counter's limit and the validation cut-off (Runway 1000, Grok 4096, otherwise 5000) |
| `reference_image_min_short_side_pixels` | The minimum-size hint on the reference drop zone |

Two things Venice does not publish in `constraints` are named explicitly in
`js/api.js`: the Kling O3 / V3 reference-to-video family, which accepts
`elements[]` and `scene_image_urls[]`, and the `-transition` models, which
require an end frame. Both are documented at their definitions, and the
self-healing retry covers the case where the table and the API disagree.

Because Venice stamps a few models (Veo 3.1, LTX Video 2.0, Kling 2.6) with a
`created` date a year earlier than they shipped — before Venice had video at all
— `VeniceAPI.releaseRank()` shifts any pre-launch timestamp forward a year so
"newest first" matches the real release order.

## Reference tags (`@Image1`, `@Element1`)

Venice indexes reference media by position in the request array, and the prompt
addresses those positions by tag:

| Prompt tag | Request field | Cap |
|---|---|---|
| `@Image1`…`@Image9` | `reference_image_urls[]` | 9 |
| `@Image1`…`@Image4` | `scene_image_urls[]` (elements-capable models) | 4 |
| `@Element1`…`@Element4` | `elements[]` | 4 |

`js/reftags.js` owns the whole tag lifecycle:

- `normalize()` rewrites any accepted spelling (`@image 1`, `@ref-2`,
  `@character3`, `@picture_1`) into the canonical `@Image1` / `@Element1`. It
  runs when a prompt field loses focus and again just before submission.
- `remap()` renumbers tags when a reference is removed, so deleting the second
  of three references turns `@Image3` into `@Image2`.
- `retarget()` re-points tags at a different array — used by the self-healing
  retry when `elements` has to fall back to `reference_image_urls`.
- `audit()` reports tags that point at a slot with nothing in it; the UI warns
  under the prompt and generation is blocked until it is resolved.

## Supported request parameters

The app builds `POST /video/queue` (and `/video/quote`) bodies from the following
fields, matching the current Venice video API. Each is only included when the
selected model's capabilities say so, and any field the API reports as
unsupported is dropped automatically on retry:

| Parameter | Type | Included when |
|-----------|------|---------------|
| `model` | string | Always. |
| `prompt` | string | The model takes a prompt (everything but upscale). Truncated to the model's `prompt_character_limit`, and reference tags are canonicalised first. |
| `negative_prompt` | string | Non-upscale models. |
| `duration` | string | The model publishes `durations`. Sent as `"5s"`, `"8s"`, or the literal `"Auto"`. |
| `aspect_ratio` | string | The model publishes `aspect_ratios`. |
| `resolution` | string | The model publishes `resolutions` and is not an upscale model. |
| `upscale_factor` | integer | Upscale models (`resolutions` of `2x` / `4x`), in place of `resolution`. |
| `seed` | integer | Non-upscale models, when a seed is entered. |
| `audio` | boolean | `audio_configurable` is true. Defaults on. |
| `image_url` | string (URL) | Image-to-video starting frame. |
| `end_image_url` | string (URL) | Image-driven models; required on `-transition` models. |
| `video_url` | string (URL) | Video-input models. |
| `audio_url` | string (URL) | `audio_input` models — a background music track. |
| `reference_image_urls` | string[] | The `@Image` lane on models without an element lane (max 9). |
| `scene_image_urls` | string[] | The `@Image` lane on elements-capable models (max 4). |
| `elements` | object[] | The `@Element` lane on elements-capable models (max 4): `{ frontal_image_url }`. |
| `reference_video_urls` | string[] | Reference- and video-mode models (max 3). |
| `reference_audio_urls` | string[] | `per_reference_audio` models (max 3). Must accompany an image/video reference. |
| `reference_video_total_duration` | integer | Reference- and video-mode models. |

## Usage

1. **Pick a category** in the header: Text, Image, Reference or Video.
2. **Pick a model.** Two or three of Venice's recommended picks are shown up
   front; open *All models* for the full list (newest first) or type in the
   filter box. The sidebar summarises what the model you chose accepts.
3. **Give it its input** — a prompt, a source image, references, or a source
   clip, depending on the category.
4. **In Reference mode**, drop your references first. Each is numbered on the
   spot (`@Image1`, `@Element1`…); click a chip to drop that tag into the
   prompt. Tags are rewritten into the API's exact form, and renumbered if you
   remove a reference.
5. **Set the parameters.** Only the controls the selected model supports appear;
   defaults are already valid for it.
6. Optionally hit **Estimate Cost** first, then **Generate Video**. Progress
   shows in the sidebar and the finished clip appears below with a download
   button.

## Parameter Showcase

### Video Models

Read live from `GET /models?type=video`; the snapshot below is the bundled
`venice-model-spec-cache.json` and is ordered newest first, exactly as the app
orders each tab. `Audio` is `yes` when the model produces a soundtrack and
`toggle` when the request may also carry the `audio` flag.

#### Text-to-Video — 37 models

| Model | ID | Duration | Resolution | Aspect ratios | Audio | Notes |
|---|---|---|---|---|---|---|
| Gemini Omni Flash | `gemini-omni-flash-text-to-video` | 4–10s | — | 16:9, 9:16 | no | — |
| HappyHorse 1.1 | `happyhorse-1-1-text-to-video` | 3–15s | 1080p, 720p | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 9:21, 5:4, 4:5 | yes, always on | — |
| Kling V3 Turbo Pro | `kling-v3-turbo-pro-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | no | — |
| Kling V3 Turbo Standard | `kling-v3-turbo-standard-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | no | — |
| Wan 2.7 Uncensored | `wan-2-7-uncensored-text-to-video` | 5–15s | 1080p, 720p | 16:9, 9:16, 1:1 | yes, always on | — |
| HappyHorse 1.0 | `happyhorse-1-0-text-to-video` | 3–15s | 1080p, 720p | 16:9, 9:16, 1:1 | yes, always on | — |
| Kling O3 4K | `kling-o3-4k-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | — |
| Kling V3 4K | `kling-v3-4k-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | — |
| Grok Imagine Private | `grok-imagine-text-to-video-private` | 1–15s | 480p, 720p | 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16 | yes, always on | prompt ≤ 4096 |
| Runway Gen-4.5 | `runway-gen4-5-text` | 2–10s | — | 16:9, 9:16 | no | prompt ≤ 1000 |
| PixVerse C1 | `pixverse-c1-text-to-video` | 3–15s | 360p, 540p, 720p, 1080p | 16:9, 4:3, 1:1, 3:4, 9:16, 2:3, 3:2, 21:9 | yes, toggle | — |
| Wan 2.7 | `wan-2-7-text-to-video` | 5–15s | 1080p, 720p | 16:9, 9:16, 1:1 | no | `audio_url` input |
| LTX Video 2.3 Fast | `ltx-2-v2-3-fast-text-to-video` | 6–20s | 1080p, 1440p, 2160p | 16:9, 9:16 | yes, toggle | — |
| LTX Video 2.3 Full Quality | `ltx-2-v2-3-full-text-to-video` | 6–10s | 1080p, 1440p, 2160p | 16:9, 9:16 | yes, toggle | — |
| Kling O3 Pro | `kling-o3-pro-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | — |
| Kling O3 Standard | `kling-o3-standard-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | — |
| Kling V3 Pro | `kling-v3-pro-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | — |
| Kling V3 Standard | `kling-v3-standard-text-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | — |
| Vidu Q3 | `vidu-q3-text-to-video` | 3–16s | 360p, 540p, 720p, 1080p | 16:9, 9:16, 4:3, 3:4, 1:1 | yes, toggle | — |
| PixVerse v5.6 | `pixverse-v5.6-text-to-video` | 5s/8s | 360p, 540p, 720p, 1080p | 16:9, 9:16, 1:1, 4:3, 3:4 | yes, toggle | — |
| LTX Video 2.0 19B Distilled | `ltx-2-19b-distilled-text-to-video` | 5–18s | 720p | 16:9, 4:3, 1:1, 3:4, 9:16 | yes, toggle | — |
| LTX Video 2.0 19B | `ltx-2-19b-full-text-to-video` | 5–18s | 720p | 16:9, 4:3, 1:1, 3:4, 9:16 | yes, toggle | — |
| Wan 2.6 | `wan-2.6-text-to-video` | 5–15s | 1080p, 720p | 16:9, 9:16, 1:1 | yes, toggle | `audio_url` input |
| Longcat Distilled | `longcat-distilled-text-to-video` | 5–30s | 720p | 16:9, 9:16, 1:1 | no | — |
| Longcat Full Quality | `longcat-text-to-video` | 5–30s | 720p | 16:9, 9:16, 1:1 | no | — |
| Kling 2.6 Pro | `kling-2.6-pro-text-to-video` | 5s/10s | — | 16:9, 9:16, 1:1 | yes, toggle | — |
| LTX Video 2.0 Fast | `ltx-2-fast-text-to-video` | 6–20s | 1080p, 1440p, 2160p | 16:9 | yes, toggle | — |
| LTX Video 2.0 Full Quality | `ltx-2-full-text-to-video` | 6–10s | 1080p, 1440p, 2160p | 16:9 | yes, toggle | — |
| Veo 3.1 Fast | `veo3.1-fast-text-to-video` | 4–8s | 720p, 1080p, 4k | 16:9, 9:16 | yes, toggle | — |
| Veo 3.1 Full Quality | `veo3.1-full-text-to-video` | 4–8s | 720p, 1080p, 4k | 16:9, 9:16 | yes, toggle | — |
| Kling 2.5 Turbo Pro | `kling-2.5-turbo-pro-text-to-video` | 5s/10s | — | 16:9, 9:16, 1:1 | no | — |
| Sora 2 Pro | `sora-2-pro-text-to-video` | 4–20s | 720p, 1080p, true_1080p | 16:9, 9:16 | yes, always on | — |
| Sora 2 | `sora-2-text-to-video` | 4–12s | 720p | 16:9, 9:16 | yes, always on | — |
| Veo 3 Fast | `veo3-fast-text-to-video` | 4–8s | 720p, 1080p | 16:9, 9:16 | yes, always on | — |
| Veo 3 Full Quality | `veo3-full-text-to-video` | 4–8s | 720p, 1080p | 16:9, 9:16 | yes, always on | — |
| Wan 2.2 A14B | `wan-2.2-a14b-text-to-video` | 5s | 720p, 580p, 480p | 16:9, 9:16, 1:1 | no | — |
| Wan 2.5 Preview | `wan-2.5-preview-text-to-video` | 5s/10s | 1080p, 720p, 480p | 16:9, 9:16, 1:1 | yes, always on | `audio_url` input |

#### Image-to-Video — 42 models

| Model | ID | Duration | Resolution | Aspect ratios | Audio | Notes |
|---|---|---|---|---|---|---|
| Gemini Omni Flash | `gemini-omni-flash-image-to-video` | 4–10s | — | 16:9, 9:16 | no | — |
| HappyHorse 1.1 | `happyhorse-1-1-image-to-video` | 3–15s | 1080p, 720p | — | yes, always on | refs ≥ 300px |
| Kling V3 Turbo Pro | `kling-v3-turbo-pro-image-to-video` | 3–15s | — | — | no | — |
| Kling V3 Turbo Standard | `kling-v3-turbo-standard-image-to-video` | 3–15s | — | — | no | — |
| Grok Imagine 1.5 Private | `grok-imagine-1-5-image-to-video-private` | 1–15s | 480p, 720p | — | yes, always on | prompt ≤ 4096 |
| Wan 2.7 Uncensored | `wan-2-7-uncensored-image-to-video` | 5–15s | 1080p, 720p | — | yes, always on | — |
| HappyHorse 1.0 | `happyhorse-1-0-image-to-video` | 3–15s | 1080p, 720p | — | yes, always on | refs ≥ 300px |
| Kling O3 4K | `kling-o3-4k-image-to-video` | 3–15s | — | — | yes, toggle | — |
| Grok Imagine Private | `grok-imagine-image-to-video-private` | 1–15s | 480p, 720p | — | yes, always on | prompt ≤ 4096 |
| Runway Gen-4.5 | `runway-gen4-5` | 2–10s | — | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 | no | prompt ≤ 1000 |
| PixVerse C1 | `pixverse-c1-image-to-video` | 3–15s | 360p, 540p, 720p, 1080p | — | yes, toggle | — |
| PixVerse C1 Transition | `pixverse-c1-transition` | 3–15s | 360p, 540p, 720p, 1080p | 16:9, 4:3, 1:1, 3:4, 9:16, 2:3, 3:2, 21:9 | yes, toggle | end frame required |
| Wan 2.7 | `wan-2-7-image-to-video` | 5–15s | 1080p, 720p | — | no | `audio_url` input |
| LTX Video 2.3 Fast | `ltx-2-v2-3-fast-image-to-video` | 6–20s | 1080p, 1440p, 2160p | 16:9, 9:16 | yes, toggle | — |
| LTX Video 2.3 Full Quality | `ltx-2-v2-3-full-image-to-video` | 6–10s | 1080p, 1440p, 2160p | 16:9, 9:16 | yes, toggle | — |
| Kling O3 Pro | `kling-o3-pro-image-to-video` | 3–15s | — | — | yes, toggle | — |
| Kling O3 Standard | `kling-o3-standard-image-to-video` | 3–15s | — | — | yes, toggle | — |
| Kling V3 Pro | `kling-v3-pro-image-to-video` | 3–15s | — | — | yes, toggle | — |
| Kling V3 Standard | `kling-v3-standard-image-to-video` | 3–15s | — | — | yes, toggle | — |
| Vidu Q3 | `vidu-q3-image-to-video` | 3–16s | 360p, 540p, 720p, 1080p | — | yes, toggle | — |
| PixVerse v5.6 | `pixverse-v5.6-image-to-video` | 5s/8s | 360p, 540p, 720p, 1080p | — | yes, toggle | — |
| PixVerse v5.6 Transition | `pixverse-v5.6-transition` | 5s/8s | 360p, 540p, 720p, 1080p | 16:9, 9:16, 1:1, 4:3, 3:4 | yes, toggle | end frame required |
| Runway Gen-4 Turbo | `runway-gen4-turbo` | 2–10s | — | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 | no | prompt ≤ 1000 |
| Wan 2.6 Flash | `wan-2.6-flash-image-to-video` | 5–15s | 1080p, 720p | — | yes, always on | `audio_url` input |
| LTX Video 2.0 19B Distilled | `ltx-2-19b-distilled-image-to-video` | 5–18s | 720p | 16:9, 4:3, 1:1, 3:4, 9:16 | yes, toggle | — |
| LTX Video 2.0 19B | `ltx-2-19b-full-image-to-video` | 5–18s | 720p | 16:9, 4:3, 1:1, 3:4, 9:16 | yes, toggle | — |
| Wan 2.6 | `wan-2.6-image-to-video` | 5–15s | 1080p, 720p | — | yes, toggle | `audio_url` input |
| Longcat Distilled | `longcat-distilled-image-to-video` | 5–30s | 720p | — | no | — |
| Longcat Full Quality | `longcat-image-to-video` | 5–30s | 720p | — | no | — |
| Kling 2.6 Pro | `kling-2.6-pro-image-to-video` | 5s/10s | — | — | yes, toggle | — |
| LTX Video 2.0 Fast | `ltx-2-fast-image-to-video` | 6–20s | 1080p, 1440p, 2160p | 16:9 | yes, toggle | — |
| LTX Video 2.0 Full Quality | `ltx-2-full-image-to-video` | 6–10s | 1080p, 1440p, 2160p | 16:9 | yes, toggle | — |
| Veo 3.1 Fast | `veo3.1-fast-image-to-video` | 4–8s | 720p, 1080p, 4k | — | yes, toggle | — |
| Veo 3.1 Full Quality | `veo3.1-full-image-to-video` | 4–8s | 720p, 1080p, 4k | — | yes, toggle | — |
| Kling 2.5 Turbo Pro | `kling-2.5-turbo-pro-image-to-video` | 5s/10s | — | — | no | — |
| Ovi | `ovi-image-to-video` | 5s | — | — | yes, always on | — |
| Sora 2 | `sora-2-image-to-video` | 4–12s | 720p | 16:9, 9:16 | yes, always on | — |
| Sora 2 Pro | `sora-2-pro-image-to-video` | 4–20s | 720p, 1080p, true_1080p | 16:9, 9:16 | yes, always on | — |
| Veo 3 Fast | `veo3-fast-image-to-video` | 8s | — | 16:9 | yes, always on | — |
| Veo 3 Full Quality | `veo3-full-image-to-video` | 8s | — | 16:9 | yes, always on | — |
| Wan 2.1 Pro | `wan-2.1-pro-image-to-video` | 6s | — | 16:9 | no | — |
| Wan 2.5 Preview | `wan-2.5-preview-image-to-video` | 5s/10s | 1080p, 720p, 480p | — | yes, always on | `audio_url` input |

#### Reference-to-Video — 10 models

| Model | ID | Duration | Resolution | Aspect ratios | Audio | Notes |
|---|---|---|---|---|---|---|
| Gemini Omni Flash R2V | `gemini-omni-flash-reference-to-video` | 4–10s | — | 16:9, 9:16 | no | — |
| HappyHorse 1.1 Reference | `happyhorse-1-1-reference-to-video` | 3–15s | 1080p, 720p | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 9:21, 5:4, 4:5 | yes, always on | refs ≥ 400px |
| HappyHorse 1.0 Reference | `happyhorse-1-0-reference-to-video` | 3–15s | 1080p, 720p | 16:9, 9:16, 1:1, 4:3, 3:4 | yes, always on | refs ≥ 400px |
| Kling O3 4K R2V | `kling-o3-4k-reference-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | `elements[]` + `scene_image_urls[]` (`@Element`/`@Image`) |
| Kling V3 4K R2V | `kling-v3-4k-reference-to-video` | 3–15s | — | — | yes, toggle | `elements[]` + `scene_image_urls[]` (`@Element`/`@Image`) |
| Grok Imagine R2V Private | `grok-imagine-reference-to-video-private` | 1–10s | 480p, 720p | 16:9, 4:3, 3:2, 1:1, 2:3, 3:4, 9:16 | no | prompt ≤ 4096 |
| PixVerse C1 R2V | `pixverse-c1-reference-to-video` | 3–15s | 360p, 540p, 720p, 1080p | 16:9, 4:3, 1:1, 3:4, 9:16, 2:3, 3:2, 21:9 | yes, toggle | — |
| Wan 2.7 Reference | `wan-2-7-reference-to-video` | 5s/10s | 1080p, 720p | — | yes, always on | `reference_audio_urls` |
| Kling O3 Standard R2V | `kling-o3-standard-reference-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | `elements[]` + `scene_image_urls[]` (`@Element`/`@Image`) |
| Kling O3 Pro R2V | `kling-o3-pro-reference-to-video` | 3–15s | — | 16:9, 9:16, 1:1 | yes, toggle | `elements[]` + `scene_image_urls[]` (`@Element`/`@Image`) |

#### Video-to-Video — 7 models

| Model | ID | Duration | Resolution | Aspect ratios | Audio | Notes |
|---|---|---|---|---|---|---|
| Kling V3 Pro Motion Control | `kling-v3-pro-motion-control` | Auto | — | — | no | — |
| Kling V3 Standard Motion Control | `kling-v3-standard-motion-control` | Auto | — | — | no | — |
| HappyHorse 1.0 Edit | `happyhorse-1-0-video-to-video` | Auto | 1080p, 720p | — | yes, always on | refs ≥ 300px |
| Grok Imagine Private | `grok-imagine-video-to-video-private` | 5–15s | 480p, 720p | — | yes, always on | prompt ≤ 4096 |
| Topaz Video Upscale | `topaz-video-upscale` | Auto | 2x, 4x | — | no | upscale — uses `upscale_factor` |
| Wan 2.7 Edit | `wan-2-7-video-to-video` | Auto | 1080p, 720p | — | no | — |
| Runway Gen-4 Aleph | `runway-gen4-aleph` | 2–10s | — | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9 | no | prompt ≤ 1000 |

### Parameter Details

#### Model Selection Guidelines

- **Text**: generate from a description alone.
- **Image**: animate a still, or morph between a start and end frame
  (the `-transition` models).
- **Reference**: keep specific characters, objects or locations consistent by
  attaching them and naming them in the prompt with `@Image1` / `@Element1`.
- **Video**: edit, re-motion or upscale a clip you already have.
- Within a family, *Fast* / *Turbo* / *Distilled* trade quality for speed and
  *Full* / *Pro* / *4K* trade speed for quality.

#### Duration Options

Model-dependent, ranging from 1s to 30s across the catalog. The edit and upscale
models advertise the single literal value `Auto`, which is sent through verbatim.
The pills only ever show what the selected model published.

#### Resolution Options

`360p`, `480p`, `540p`, `720p`, `1080p`, `true_1080p`, `2160p`, `4k` — again per
model. Models advertising `2x` / `4x` are upscale models: they get Upscale Factor
pills and the request carries `upscale_factor` instead of `resolution`. A model
that publishes no resolutions picks its own, and none is sent.

#### Aspect Ratio Options

`1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `9:21`, `16:9`, `21:9`.
The control is hidden entirely for models that publish no ratios.

#### Audio Generation Support

Three distinct cases, all read from the constraints:

- `audio: false` — silent output; no control shown.
- `audio: true, audio_configurable: false` — always generates audio and rejects
  the `audio` parameter. A note is shown instead of a toggle.
- `audio: true, audio_configurable: true` — the toggle is shown and defaults on.

Separately, `audio_input: true` models accept a background track via `audio_url`,
and `per_reference_audio: true` models accept `reference_audio_urls`.

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
  "duration": "8s",
  "aspect_ratio": "16:9"
}
```

#### Reference-to-Video

Reference-to-video models use character/scene references instead of a single
starting frame. On most of them the references are one flat array addressed as
`@Image1`, `@Image2`, …:

```json
{
  "model": "wan-2-7-reference-to-video",
  "prompt": "@Image1 walking through a neon city, cinematic tracking shot",
  "reference_image_urls": ["https://example.com/character.jpg"],
  "duration": "5s"
}
```

The Kling O3 / V3 reference models split subjects from scenery, so the app sends
two arrays and the prompt addresses each by its own tag:

```json
{
  "model": "kling-o3-pro-reference-to-video",
  "prompt": "@Element1 hands a lantern to @Element2 in the alley of @Image1",
  "elements": [
    { "frontal_image_url": "https://example.com/char-a.jpg" },
    { "frontal_image_url": "https://example.com/char-b.jpg" }
  ],
  "scene_image_urls": ["https://example.com/alley.jpg"],
  "duration": "8s",
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

1. **Install Dependencies** (locally, optional):
   ```bash
   npm install
   ```

2. **Set Environment Variable on Railway**:
   - Go to your Railway project dashboard
   - Navigate to the "Variables" tab
   - Add a new environment variable:
     - **Name**: `VENICE_API_TOKEN`
     - **Value**: Your Venice AI API token (get it from venice.ai)
   - Save the variable

3. **Deploy to Railway**:
   - Connect your GitHub repository to Railway
   - Railway will automatically detect the `package.json` and `server.js`
   - The server will start automatically with the correct CSP headers
   - Railway will use the PORT environment variable automatically

4. **Verify Deployment**:
   - Check the Railway logs to ensure the server started successfully
   - You should see: "Server is running on port XXXX" and "Venice API token is configured"
   - If you see a warning about the token, check your environment variable

The server includes:
- **Content Security Policy headers** to allow blob URLs for video playback
- **Server-side API proxy** that keeps your API token secure
- **Automatic model loading** on page load (no user input needed)

**Important**: The API token is now stored securely on the server and never exposed to the client. Users don't need to enter it.

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
- `js/api.js`: Venice API integration class, per-model capability derivation and the self-healing request builder
- `js/reftags.js`: the `@Image1` / `@Element1` prompt-tag engine (normalise, renumber, retarget, audit)
- `js/app.js`: Main application logic
- `js/components.js`: UI component functions
- `js/utils.js`: Utility functions
- `js/main.js`: Application initialization
- `js/state.js`: Global state management