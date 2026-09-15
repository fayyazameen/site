import { SCENES, type SceneId } from "./scenes";
import type { LandscapeViewport, LandscapeInput } from "./landscape-protocol";

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type LandscapeImage = HTMLImageElement | ImageBitmap;
export type LandscapeRuntime = {
  makeCanvas: () => Surface;
  loadImage: (url: string) => Promise<LandscapeImage>;
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  onReady: () => void;
};
const getContext = (surface: Surface, opaque = false) =>
  surface.getContext("2d", { alpha: !opaque }) as Context | null;
const releaseImage = (image: LandscapeImage | null) => {
  if (image && "close" in image) image.close();
};

const MOUNTAINS_SRC = "/art/moonlit-mountains.webp";
const MOUNTAINS_FALLBACK_SRC = "/art/moonlit-mountains.png";
const METEOR_INTERVAL = 1400;
const FRAME_INTERVAL = 1000 / 30;
const CLOUDS_SRC = "/art/cloud-bank.webp";
const wrap = (value: number, size: number) => ((value % size) + size) % size;

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Meteor = {
  x: number;
  y: number;
  distance: number;
  angle: number;
  age: number;
  duration: number;
};

export function createLandscapeRenderer(
  canvas: Surface,
  variant: "side" | "bottom",
  initialScene: SceneId,
  runtime: LandscapeRuntime,
) {
  const ctx = getContext(canvas, true);
  if (!ctx) throw new Error("Canvas rendering unavailable");
  const rand = mulberry32(3172026);
  const stars = Array.from({ length: 480 }, () => {
    const brightness = rand();
    return {
      x: rand(),
      y: rand(),
      radius: brightness > 0.975 ? 1.05 : 0.25 + rand() * 0.5,
      opacity: 0.2 + brightness * brightness * 0.74,
      phase: rand() * Math.PI * 2,
      speed: 0.3 + rand() * 0.55,
      bright: brightness > 0.975,
      warm: rand() > 0.88,
    };
  });
  const meteors: Meteor[] = [];
  let mountains: LandscapeImage | null = null;
  let clouds: LandscapeImage | null = null;
  let mountainRequested = false;
  let cloudsRequested = false;
  const terrain = runtime.makeCanvas();
  const cloudLayer = runtime.makeCanvas();
  const transition = runtime.makeCanvas();
  let scene = initialScene;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let terrainKey = "";
  let ready = false;
  let cloudKey = "";
  let skyGradient: CanvasGradient | null = null;
  let foregroundGradient: CanvasGradient | null = null;
  let transitionProgress = 1;
  let gust = 0;
  let weatherTime = 0;
  let cloudTime = 0;
  const particles = Array.from({ length: 150 }, () => ({
    x: rand(),
    y: rand(),
    depth: 0.25 + rand() * 0.75,
    phase: rand() * Math.PI * 2,
    speed: 0.6 + rand() * 0.65,
  }));

  // Relight the original cutout once per scene, preserving every ridge and detail.
  const prepareTerrain = () => {
    if (!mountains) return;
    const textureWidth = Math.min(
      mountains.width,
      Math.ceil(
        Math.max(width + 80, height * (variant === "side" ? 1.14 : 1.5)) *
          pixelRatio,
      ),
    );
    const key = scene + ":" + textureWidth;
    if (terrainKey === key) return;
    terrain.width = textureWidth;
    terrain.height = Math.round(
      (textureWidth * mountains.height) / mountains.width,
    );
    const context = getContext(terrain);
    if (!context) return;
    terrainKey = key;
    context.filter = "brightness(" + SCENES[scene].brightness + ")";
    context.drawImage(mountains, 0, 0, terrain.width, terrain.height);
    context.filter = "none";
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = SCENES[scene].tint;
    context.fillRect(0, 0, terrain.width, terrain.height);
  };

  const prepareClouds = () => {
    if (!clouds || !SCENES[scene].cloudOpacity) return;
    const textureWidth = Math.max(
      1,
      Math.min(
        clouds.width,
        Math.ceil(Math.max(width * 1.5, height * 0.85) * 1.18 * pixelRatio),
      ),
    );
    const key = scene + ":" + textureWidth;
    if (cloudKey === key) return;
    cloudLayer.width = textureWidth;
    cloudLayer.height = Math.max(
      1,
      Math.round((textureWidth * clouds.height) / clouds.width),
    );
    const context = getContext(cloudLayer);
    if (!context) return;
    cloudKey = key;
    context.drawImage(clouds, 0, 0, cloudLayer.width, cloudLayer.height);
    context.globalCompositeOperation = "source-atop";
    context.globalAlpha = scene === "rain" || scene === "cloudy" ? 0.6 : 0.22;
    context.fillStyle = scene === "rain" ? "#455969" : SCENES[scene].light;
    context.fillRect(0, 0, cloudLayer.width, cloudLayer.height);
  };

  let frame = 0;
  let previousTime = 0;
  let nextPaintAt = 0;
  let elapsed = 0;
  let active = false;
  let reducedMotion = false;
  let disposed = false;
  let lastSpawnAt = -METEOR_INTERVAL;
  let scrollTarget = 0;
  let scrollPosition = 0;
  let pointerX = 0;
  let pointerY = 0;
  let cameraX = 0;
  let cameraY = 0;

  const paintClouds = (drift: number) => {
    if (!clouds || !SCENES[scene].cloudOpacity) return;
    const heavy = scene === "cloudy" || scene === "rain" || scene === "snow";
    const layers = heavy ? 2 : 1;
    ctx.save();
    for (let layer = 0; layer < layers; layer++) {
      const cloudWidth =
        Math.max(width * 1.5, height * 0.85) * (1 + layer * 0.18);
      const cloudHeight = Math.min((cloudWidth * 2) / 3, height * 1.05);
      const span = cloudWidth * 0.92;
      const offset = wrap(cloudTime * (5 + layer * 4) + layer * 163, span);
      const top = height * (0.22 + layer * 0.18) - cloudHeight * 0.44;
      ctx.globalAlpha = SCENES[scene].cloudOpacity * (layer ? 0.62 : 1);
      for (let tile = -1; tile <= 1; tile++) {
        const left = offset + span * tile + drift * 0.35;
        if (left >= width || left + cloudWidth <= 0) continue;
        ctx.drawImage(cloudLayer, left, top, cloudWidth, cloudHeight);
      }
    }
    ctx.restore();
  };

  const paintSun = (time: number) => {
    if (
      scene !== "sunset" &&
      scene !== "sunrise" &&
      scene !== "clear" &&
      scene !== "blueClouds"
    )
      return;
    const low = scene === "sunset" || scene === "sunrise";
    const sunX = width * (scene === "sunset" ? 0.24 : 0.76);
    const sunY =
      height * (low ? 0.47 : 0.18) + Math.sin(time * 0.035) * height * 0.018;
    const radius = Math.max(
      7,
      Math.min(17, Math.min(width, height) * (low ? 0.035 : 0.021)),
    );
    const glowRadius = Math.min(width, height) * (low ? 0.95 : 0.58);
    const halo = ctx.createRadialGradient(
      sunX,
      sunY,
      radius,
      sunX,
      sunY,
      glowRadius,
    );
    halo.addColorStop(0, SCENES[scene].light);
    halo.addColorStop(1, "transparent");
    ctx.save();
    ctx.globalAlpha = (low ? 0.48 : 0.3) + gust * 0.16;
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = SCENES[scene].light;
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.fill();

    // A brief sweep of sunlight answers hover and scroll in the clear scenes.
    if (gust > 0.01) {
      const beamX = sunX + (1 - gust) * width * 0.5;
      const beam = ctx.createLinearGradient(
        beamX - width * 0.45,
        0,
        beamX + width * 0.25,
        height,
      );
      beam.addColorStop(0, "transparent");
      beam.addColorStop(0.48, SCENES[scene].light);
      beam.addColorStop(1, "transparent");
      ctx.globalAlpha = gust * 0.13;
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  };

  const paintPrecipitation = (front: boolean, time: number) => {
    if (scene !== "snow" && scene !== "rain") return;
    const snowy = scene === "snow";
    const count = Math.min(
      particles.length,
      Math.max(55, Math.round((width * height) / 1800)),
    );
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      if (p.depth > 0.56 !== front) continue;
      const fall = time * (snowy ? 25 : 390) * p.depth * p.speed;
      const breeze = Math.sin(time * 0.45 + p.phase) * (snowy ? 17 : 2);
      const x =
        wrap(
          p.x * (width + 90) + time * (snowy ? 9 : 85) * p.depth + breeze,
          width + 90,
        ) - 45;
      const y = wrap(p.y * (height + 40) + fall, height + 40) - 20;
      ctx.globalAlpha = (front ? 0.38 : 0.18) + p.depth * (snowy ? 0.4 : 0.12);
      if (snowy) {
        ctx.fillStyle = "#eff7ff";
        ctx.beginPath();
        ctx.arc(x, y, 0.55 + p.depth * 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const length = 8 + p.depth * 18;
        ctx.strokeStyle = "#c9e0ee";
        ctx.lineWidth = 0.45 + p.depth * 0.65;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + length * 0.22, y + length);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const paint = () => {
    if (!width || !height) return;
    prepareTerrain();
    prepareClouds();
    const still = reducedMotion;
    const time = still ? 0 : elapsed;
    const driftX = still ? 0 : cameraX + scrollPosition * 18;
    const driftY = still ? 0 : cameraY + scrollPosition * 7;
    if (!skyGradient) {
      skyGradient = ctx.createLinearGradient(0, 0, width * 0.4, height);
      skyGradient.addColorStop(0, SCENES[scene].sky[0]);
      skyGradient.addColorStop(0.55, SCENES[scene].sky[1]);
      skyGradient.addColorStop(1, SCENES[scene].sky[2]);
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);

    paintSun(time);
    paintClouds(driftX);
    paintPrecipitation(false, still ? 0 : weatherTime);

    // Tiny stars at device resolution; only a few get a restrained halo.
    const count =
      scene === "night"
        ? Math.min(stars.length, Math.round((width * height) / 1200))
        : 0;
    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const x = star.x * (width + 16) - 8 + driftX * 0.18;
      const y = star.y * height * 0.86 + driftY * 0.12;
      const alpha =
        star.opacity * (0.85 + 0.15 * Math.sin(time * star.speed + star.phase));
      const color = star.warm ? "231, 218, 195" : "210, 223, 240";
      if (star.bright) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 4);
        glow.addColorStop(0, `rgba(${color}, ${alpha * 0.3})`);
        glow.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(x - 4, y - 4, 8, 8);
      }
      ctx.fillStyle = `rgba(${color}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // The mountain cutout is drawn afterwards to occlude meteor trails.
    for (const meteor of meteors) {
      const progress = meteor.age / meteor.duration;
      const fade = Math.sin(Math.PI * progress) ** 1.2;
      const dx = Math.cos(meteor.angle);
      const dy = Math.sin(meteor.angle);
      const x = meteor.x + dx * meteor.distance * progress;
      const y = meteor.y + dy * meteor.distance * progress;
      const tail =
        Math.min(110, meteor.distance * 0.46) * Math.min(1, progress * 5);
      const tailX = x - dx * tail;
      const tailY = y - dy * tail;
      const trail = ctx.createLinearGradient(tailX, tailY, x, y);
      trail.addColorStop(0, "rgba(166, 194, 225, 0)");
      trail.addColorStop(0.75, `rgba(210, 228, 250, ${fade * 0.48})`);
      trail.addColorStop(1, `rgba(246, 248, 255, ${fade})`);
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.35;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(x, y);
      ctx.stroke();
      const headGlow = ctx.createRadialGradient(x, y, 0, x, y, 5);
      headGlow.addColorStop(0, `rgba(220, 235, 255, ${fade * 0.3})`);
      headGlow.addColorStop(1, "rgba(220, 235, 255, 0)");
      ctx.fillStyle = headGlow;
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = `rgba(248, 250, 255, ${fade})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (terrainKey && mountains) {
      const drawWidth = Math.max(
        width + 80,
        height * (variant === "side" ? 1.14 : 1.5),
      );
      const drawHeight = (drawWidth * mountains.height) / mountains.width;
      const x = (width - drawWidth) / 2 + driftX;
      // Keep the central summit visible in the tall panel and the panorama.
      const y =
        variant === "side"
          ? height - drawHeight + 24 + driftY
          : height * 0.4 - drawHeight * 0.35 + driftY;
      ctx.drawImage(terrain, x, y, drawWidth, drawHeight);
      if (!ready) {
        ready = true;
        transitionProgress = 1;
        runtime.onReady();
      }
    }

    if (!foregroundGradient) {
      foregroundGradient = ctx.createLinearGradient(
        0,
        height * 0.72,
        0,
        height,
      );
      foregroundGradient.addColorStop(0, "transparent");
      foregroundGradient.addColorStop(1, SCENES[scene].foreground);
    }
    ctx.save();
    ctx.globalAlpha = SCENES[scene].shade;
    ctx.fillStyle = foregroundGradient;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.restore();
    paintPrecipitation(true, still ? 0 : weatherTime);

    if (transitionProgress < 1 && !still) {
      ctx.save();
      const eased =
        transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
      ctx.globalAlpha = 1 - eased;
      ctx.drawImage(transition, 0, 0, width, height);
      ctx.restore();
    }
  };

  const loop = (now: number) => {
    frame = 0;
    if (!active || reducedMotion || disposed) return;
    // Keep deadlines on a fixed timeline. Resetting the deadline to `now`
    // discards fractional frames and produces an uneven 20–30 fps cadence.
    const overdue = now - nextPaintAt;
    if (overdue >= -0.5) {
      const dt = Math.min((now - previousTime) / 1000, 0.06);
      previousTime = now;
      nextPaintAt +=
        (Math.floor(Math.max(0, overdue) / FRAME_INTERVAL) + 1) *
        FRAME_INTERVAL;
      elapsed += dt;
      gust *= Math.exp(-dt * 0.95);
      weatherTime += dt * (1 + gust * 1.7);
      cloudTime += dt * (1 + gust * 3.5);
      transitionProgress = Math.min(1, transitionProgress + dt / 0.85);
      const ease = 1 - Math.exp(-dt * 4);
      cameraX += (pointerX - cameraX) * ease;
      cameraY += (pointerY - cameraY) * ease;
      scrollPosition += (scrollTarget - scrollPosition) * ease;
      for (let i = meteors.length - 1; i >= 0; i--) {
        meteors[i].age += dt;
        if (meteors[i].age >= meteors[i].duration) meteors.splice(i, 1);
      }
      paint();
    }
    frame = runtime.requestFrame(loop);
  };

  const loadAssets = () => {
    if (!mountainRequested) {
      mountainRequested = true;
      void runtime
        .loadImage(MOUNTAINS_SRC)
        .catch(() =>
          disposed ? null : runtime.loadImage(MOUNTAINS_FALLBACK_SRC),
        )
        .then((image) => {
          if (disposed) {
            releaseImage(image);
            return;
          }
          mountains = image;
          if (active) paint();
        })
        .catch(() => {
          /* Keep the CSS mountain if both requests fail. */
        });
    }
    if (SCENES[scene].cloudOpacity && !cloudsRequested) {
      cloudsRequested = true;
      void runtime
        .loadImage(CLOUDS_SRC)
        .then((image) => {
          if (disposed) {
            releaseImage(image);
            return;
          }
          clouds = image;
          if (active) paint();
        })
        .catch(() => {
          /* The scene can render without clouds. */
        });
    }
  };

  const syncAnimation = () => {
    runtime.cancelFrame(frame);
    frame = 0;
    if (!active || !width || !height || disposed) {
      meteors.length = 0;
      return;
    }
    loadAssets();
    if (reducedMotion) {
      meteors.length = 0;
      gust = 0;
      transitionProgress = 1;
      cloudTime = 0;
    }
    paint();
    if (!reducedMotion) {
      previousTime = runtime.now();
      nextPaintAt = previousTime + FRAME_INTERVAL;
      frame = runtime.requestFrame(loop);
    }
  };

  const resize = (viewport: LandscapeViewport) => {
    if (
      width === viewport.width &&
      height === viewport.height &&
      pixelRatio === viewport.pixelRatio
    )
      return;
    width = viewport.width;
    height = viewport.height;
    pixelRatio = viewport.pixelRatio;
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    skyGradient = null;
    foregroundGradient = null;
    transitionProgress = 1;
    scrollPosition = scrollTarget;
    syncAnimation();
  };

  const respondToInteraction = () => {
    const now = runtime.now();
    if (
      !active ||
      reducedMotion ||
      meteors.length >= 2 ||
      now - lastSpawnAt < (scene === "night" ? METEOR_INTERVAL : 700)
    )
      return;
    lastSpawnAt = now;
    gust = 1;
    if (scene !== "night") return;
    meteors.push({
      x: width * (0.08 + rand() * 0.42),
      y: height * (0.06 + rand() * 0.16),
      distance: Math.min(width * 0.65, 280),
      angle: ((24 + rand() * 12) * Math.PI) / 180,
      age: 0,
      duration: 1.2 + rand() * 0.4,
    });
  };

  const setScene = (nextScene: SceneId) => {
    if (scene === nextScene) return;
    if (ready && active && !reducedMotion && scene !== "night") {
      transition.width = canvas.width;
      transition.height = canvas.height;
      getContext(transition)?.drawImage(canvas, 0, 0);
      transitionProgress = 0;
    } else {
      transitionProgress = 1;
    }
    scene = nextScene;
    skyGradient = null;
    foregroundGradient = null;
    meteors.length = 0;
    gust = 0;
    lastSpawnAt = -METEOR_INTERVAL;
    syncAnimation();
  };

  return {
    resize,
    setScene,
    setVisibility(nextActive: boolean, nextReducedMotion: boolean) {
      if (active === nextActive && reducedMotion === nextReducedMotion) return;
      active = nextActive;
      reducedMotion = nextReducedMotion;
      syncAnimation();
    },
    setInput(input: LandscapeInput) {
      scrollTarget = input.scroll;
      pointerX = input.pointerX;
      pointerY = input.pointerY;
      if (input.interact) respondToInteraction();
    },
    destroy() {
      disposed = true;
      active = false;
      runtime.cancelFrame(frame);
      releaseImage(mountains);
      releaseImage(clouds);
      terrain.width = terrain.height = 1;
      cloudLayer.width = cloudLayer.height = 1;
      transition.width = transition.height = 1;
      canvas.width = canvas.height = 1;
    },
  };
}
