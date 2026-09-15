# Mountain artwork

Asset: `public/art/moonlit-mountains.png` (1536 × 1024 RGBA PNG).
Created with the built-in image-generation tool. The transparent mountain asset is composited with the animated canvas sky in `src/components/AmbientArt.tsx`.

Runtime assets are `public/art/moonlit-mountains.webp` and `public/art/cloud-bank.webp`, lossless copies with identical decoded RGBA pixels. Together they use 2,279,466 bytes instead of 3,469,612 bytes (34.3% less). The PNG originals remain available for future edits. Re-encode the WebP copies when changing an original.

Only the active responsive artwork starts a renderer. `landscape.ts` owns the DOM lifecycle and sends input/visibility messages to `landscape.worker.ts`; the worker runs the DOM-independent `landscape-renderer.ts` using OffscreenCanvas and decoded ImageBitmaps. All per-frame scene drawing, mountain/cloud compositing, and particle animation happen off the page's main thread. The host has no continuous animation loop. See [MDN's OffscreenCanvas documentation](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).

The renderer caches gradients and appropriately sized terrain/cloud buffers, skips unchanged resize notifications, and releases buffers/decoded images on cleanup. Canvas resolution is capped at 1.5× device density and about 750,000 pixels (previously 2× and 1,200,000). Animation retains a stable 30 fps timeline and pauses offscreen, in hidden documents, and for reduced motion. Scroll events batch into one input message per display frame and use a cached document position; they trigger no layout reads or drawing on the main thread. Resize/content observers refresh the cached position when layout changes. Cloud tiles outside the card are skipped.

If workers or OffscreenCanvas are unavailable, or a worker fails to start, the same renderer runs on a fresh local canvas. This compatibility path pauses all drawing during scrolling and resumes 160 ms after the last scroll event, including a weather interaction. A new owned canvas is created for every renderer lifetime, since transferred canvases cannot be transferred again after hot reload or responsive changes. The artwork has its own contained paint area, and writing pages use one entrance fade that releases its animation state when finished; the article body keeps no blur or transform layer while reading.

The frame is borderless, with rounded corners and an external floating shadow shared by home and writing pages. There is no inset shadow over the lighter weather scenes. A static mountain background is visible until the renderer has drawn the terrain; this also covers an unavailable animation chunk after a rebuild. A failed WebP image load falls back once to the original PNG. The static background is removed after the first complete frame and restored when the renderer is destroyed.

Run `node --test tests/landscape.test.cjs` for DOM-independent rendering of all scenes, cadence, worker input batching, zero main-thread painting during scroll bursts, pixel limits, compatibility scroll suspension, image/worker failure recovery, visibility, reduced motion, and cleanup. These simulate animation scheduling and DOM events; they do not measure browser GPU performance or replace checking the feel on a physical device.

All eight scenes reuse this exact mountain file. Lighting is applied at runtime without modifying its image or silhouette. The writing index and article routes receive a random selection from snow, sunset, cloudy, sunrise, rain, blue sky with clouds, and clear blue sky. A shuffled bag distributes scenes; assignments stay stable for each route during the visit. Home retains starry night. The desktop card and mobile footer share the route's selection.

Snow and rain animate in front of and behind the peaks. Cloud layers drift, and hover/scroll adds a gust. Sunrise, sunset, and clear skies respond with a soft sweep of sunlight. Night retains shooting stars. All animation stops for reduced motion, hidden tabs, and offscreen artwork.

Cloud asset: `public/art/cloud-bank.png` (1536 × 1024 RGBA PNG), generated with the built-in image-generation tool and composited as a separate tinted layer.

## Cloud generation prompt

```text
Use case: photorealistic-natural
Asset type: original transparent PNG cloud layer for canvas compositing over a mountain sky, reused in blue sky, grey overcast, rain, snow, warm sunset and sunrise.
Primary request: Generate exactly one standalone photorealistic broad horizontal bank of wispy and soft cumulus clouds on a genuinely transparent background, at 1536 x 1024 pixels.
Subject: airy delicate upper wisps and denser rolling middle cloud clusters; nuanced natural translucent edges and highly detailed soft vapour.
Style/medium: natural fine-art atmospheric photography, physically convincing cloud textures.
Composition/framing: clouds occupy the central horizontal band from approximately y=25% to y=65%; broad horizontal spread with generous actual transparent space at the top and bottom. Every outer edge must dissolve cleanly into full transparency, including left and right. Keep all clouds comfortably inside the canvas so there are no hard cropped edges.
Lighting/mood: soft neutral natural daylight with subtle volume.
Color palette: white and silver with neutral grey shading; neutral enough to tint for warm and cool weather.
Constraints: deliver PNG with real alpha transparency; preserve fine translucent vapour and soft feathered edges.
Avoid: blue or black sky, any opaque background, mountains, land, sun, rain, snow, stars, text, watermark, baked checkerboard, fake circles, flat cartoon shapes.
```

## Generation prompt

```text
Use case: photorealistic-natural
Asset type: One original decorative mountain PNG cutout for a website nightscape, designed to composite above a #05070b black canvas within a slate-grey site.
Primary request: Generate exactly one panoramic 1536 x 1024 pixel (3:2) image of a photorealistic fine-art monochrome moonlit alpine mountain range with a genuinely transparent background above the mountain ridge.
Scene/backdrop: Actual transparent alpha everywhere above the mountain ridge. This is a mountain cutout only, with NO sky pixels of any color. The visible mountains themselves must be opaque.
Subject: A natural, jagged alpine mountain range, realistic craggy rock strata, delicate snow tucked into crevices, steep silver-lit edges and deeply shadowed charcoal faces.
Composition/framing: A tall dominant central peak near x=52%, its summit at y=32% of the image. Surrounding peaks extend across the full width with summits mainly y=40-60%. Dense overlapping mountains fill the entire lower portion continuously to the bottom and left/right edges. The lower 15% is nearly black foreground mountain. Keep the dominant peak effective in a central portrait crop while the complete image reads as a broad panorama.
Style/medium: Detailed natural fine-art landscape photography, physically convincing sharp rock textures and irregular alpine geology.
Lighting/mood: Restrained moonlight from outside the frame picks out the mountain edges and fine texture. Quiet, dark nightscape.
Color palette: Near-black, charcoal, graphite, and restrained muted steel-silver highlights. Predominantly dark mountains; sparse delicate snow, never a white snow-covered landscape and never saturated blue.
Constraints: Output PNG with a real alpha channel and genuinely transparent upper background. Preserve clean intricate rocky ridgeline edge detail with appropriate edge antialiasing. No solid black background and no checkerboard baked into the pixels. No sky, stars, sun, moon, clouds, fog, text, borders, watermark, trees, buildings, or water. No low-poly geometry, line art, flat silhouettes, or repeated procedural mountain patterns.
```
