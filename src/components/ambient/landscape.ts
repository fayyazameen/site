import type { SceneId } from "./scenes";
import type { createLandscapeRenderer } from "./landscape-renderer";
import type {
  LandscapeCommand,
  LandscapeInput,
  LandscapeReply,
  LandscapeViewport,
} from "./landscape-protocol";

const MAX_CANVAS_PIXELS = 750_000;
const SCROLL_SETTLE_MS = 160;

// Only observation and small input messages run here. The worker owns all drawing.
export function createLandscape(
  figure: HTMLElement,
  variant: "side" | "bottom",
  initialScene: SceneId,
) {
  let canvas = document.createElement("canvas");
  figure.append(canvas);
  figure.classList.remove("ambient-art-frame--ready");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let worker: Worker | null = null;
  let fallback: ReturnType<typeof createLandscapeRenderer> | null = null;
  let disposed = false;
  let fallingBack = false;
  let inView = false;
  let scene = initialScene;
  let inputFrame = 0;
  let resumeTimer = 0;
  let documentTop = 0;
  let lastScrollY = window.scrollY;
  let scrollDistance = 0;
  let pointer: { x: number; y: number } | null = null;
  let pendingInteraction = false;
  let viewport: LandscapeViewport = { width: 0, height: 0, pixelRatio: 1 };
  let input: LandscapeInput = {
    scroll: 0,
    pointerX: 0,
    pointerY: 0,
    interact: false,
  };

  const active = () =>
    inView && !document.hidden && viewport.width > 0 && viewport.height > 0;
  const send = (command: Exclude<LandscapeCommand, { type: "init" }>) => {
    if (disposed) return;
    if (worker) {
      worker.postMessage(command);
      return;
    }
    if (!fallback) return;
    switch (command.type) {
      case "resize":
        fallback.resize(command.viewport);
        break;
      case "scene":
        fallback.setScene(command.scene);
        break;
      case "input":
        fallback.setInput(command.input);
        break;
      case "visibility":
        fallback.setVisibility(
          command.active && !resumeTimer,
          command.reducedMotion,
        );
        break;
    }
  };
  const syncVisibility = () =>
    send({
      type: "visibility",
      active: active(),
      reducedMotion: motion.matches,
    });

  const flushInput = () => {
    inputFrame = 0;
    if (!active() || motion.matches) return;
    const progress =
      variant === "bottom"
        ? (window.innerHeight - (documentTop - window.scrollY)) /
          (window.innerHeight + viewport.height)
        : window.scrollY / 1400;
    input.scroll =
      variant === "bottom"
        ? (Math.max(0, Math.min(1, progress)) - 0.5) * 2
        : Math.max(0, Math.min(1, progress));
    if (pointer) {
      const rect = figure.getBoundingClientRect();
      input.pointerX = ((pointer.x - rect.left) / viewport.width - 0.5) * -10;
      input.pointerY = ((pointer.y - rect.top) / viewport.height - 0.5) * -6;
      pointer = null;
    }
    input.interact = pendingInteraction;
    pendingInteraction = false;
    send({ type: "input", input });
  };
  const queueInput = () => {
    if (!inputFrame) inputFrame = requestAnimationFrame(flushInput);
  };

  const measure = () => {
    const rect = figure.getBoundingClientRect();
    documentTop = rect.top + window.scrollY;
    const width = figure.clientWidth;
    const height = figure.clientHeight;
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      1.5,
      Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height)),
    );
    if (
      width !== viewport.width ||
      height !== viewport.height ||
      pixelRatio !== viewport.pixelRatio
    ) {
      viewport = { width, height, pixelRatio };
      send({ type: "resize", viewport });
    }
    if (active() && !motion.matches) queueInput();
  };

  const startFallback = async () => {
    if (disposed || fallingBack) return;
    fallingBack = true;
    worker?.terminate();
    worker = null;
    figure.classList.remove("ambient-art-frame--ready");
    // A transferred canvas cannot be reused. The host owns this node, including HMR cleanup.
    const replacement = document.createElement("canvas");
    canvas.replaceWith(replacement);
    canvas = replacement;
    try {
      const { createLandscapeRenderer } = await import("./landscape-renderer");
      if (disposed) return;
      fallback = createLandscapeRenderer(canvas, variant, scene, {
        makeCanvas: () => document.createElement("canvas"),
        loadImage: (url) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.decoding = "async";
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("Artwork unavailable"));
            image.src = url;
          }),
        now: () => performance.now(),
        requestFrame: (callback) => requestAnimationFrame(callback),
        cancelFrame: (id) => cancelAnimationFrame(id),
        onReady: () => {
          if (!disposed) figure.classList.add("ambient-art-frame--ready");
        },
      });
      fallback.resize(viewport);
      fallback.setInput(input);
      syncVisibility();
    } catch {
      // Keep the static mountain if this browser cannot start a renderer.
    }
  };

  if (
    typeof Worker !== "undefined" &&
    typeof canvas.transferControlToOffscreen === "function"
  ) {
    try {
      worker = new Worker(new URL("./landscape.worker.ts", import.meta.url));
      worker.onmessage = ({ data }: MessageEvent<LandscapeReply>) => {
        if (disposed || fallingBack) return;
        if (data.type === "ready")
          figure.classList.add("ambient-art-frame--ready");
        else void startFallback();
      };
      worker.onerror = (event) => {
        event.preventDefault();
        void startFallback();
      };
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage(
        {
          type: "init",
          canvas: offscreen,
          variant,
          scene,
        } satisfies LandscapeCommand,
        [offscreen],
      );
    } catch {
      void startFallback();
    }
  } else {
    void startFallback();
  }

  const onScroll = () => {
    const distance = Math.abs(window.scrollY - lastScrollY);
    lastScrollY = window.scrollY;
    if (!active() || motion.matches) return;
    scrollDistance += distance;
    if (scrollDistance >= 70) {
      scrollDistance = 0;
      pendingInteraction = true;
    }
    // Older browsers yield all painting during a scroll gesture, then resume the weather.
    if (!worker) {
      fallback?.setVisibility(false, motion.matches);
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        resumeTimer = 0;
        syncVisibility();
        pendingInteraction = true;
        queueInput();
      }, SCROLL_SETTLE_MS);
    }
    queueInput();
  };
  const onPointer = (event: PointerEvent) => {
    if (!active() || motion.matches || event.pointerType === "touch") return;
    pointer = { x: event.clientX, y: event.clientY };
    pendingInteraction = true;
    queueInput();
  };
  const onPointerLeave = () => {
    pointer = null;
    input.pointerX = input.pointerY = 0;
    queueInput();
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || !active() || motion.matches) return;
    pendingInteraction = true;
    queueInput();
  };
  const onVisibility = () => {
    syncVisibility();
    if (active() && !motion.matches) queueInput();
  };
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(figure);
  // Refresh the cached document position after route/content/font layout changes, never per scroll.
  const content = figure.parentElement?.parentElement;
  if (content) resizeObserver.observe(content);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) measure();
    onVisibility();
  });
  intersectionObserver.observe(figure);
  figure.addEventListener("pointerenter", onPointer);
  figure.addEventListener("pointermove", onPointer);
  figure.addEventListener("pointerleave", onPointerLeave);
  figure.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  motion.addEventListener("change", onVisibility);
  measure();

  return {
    setScene(nextScene: SceneId) {
      if (scene === nextScene) return;
      scene = nextScene;
      send({ type: "scene", scene });
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(inputFrame);
      window.clearTimeout(resumeTimer);
      worker?.terminate();
      fallback?.destroy();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      figure.removeEventListener("pointerenter", onPointer);
      figure.removeEventListener("pointermove", onPointer);
      figure.removeEventListener("pointerleave", onPointerLeave);
      figure.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onVisibility);
      figure.classList.remove("ambient-art-frame--ready");
      canvas.remove();
    },
  };
}
