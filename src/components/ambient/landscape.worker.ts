import { createLandscapeRenderer } from "./landscape-renderer";
import type { LandscapeCommand, LandscapeReply } from "./landscape-protocol";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<LandscapeCommand>) => void) | null;
  postMessage: (reply: LandscapeReply) => void;
};
let renderer: ReturnType<typeof createLandscapeRenderer> | null = null;

scope.onmessage = ({ data }) => {
  try {
    switch (data.type) {
      case "init":
        renderer?.destroy();
        renderer = createLandscapeRenderer(
          data.canvas,
          data.variant,
          data.scene,
          {
            makeCanvas: () => new OffscreenCanvas(1, 1),
            async loadImage(url) {
              const response = await fetch(url);
              if (!response.ok) throw new Error("Artwork unavailable");
              return createImageBitmap(await response.blob());
            },
            now: () => performance.now(),
            requestFrame: (callback) =>
              typeof requestAnimationFrame === "function"
                ? requestAnimationFrame(callback)
                : (setTimeout(
                    () => callback(performance.now()),
                    16,
                  ) as unknown as number),
            cancelFrame: (id) =>
              typeof cancelAnimationFrame === "function"
                ? cancelAnimationFrame(id)
                : clearTimeout(id),
            onReady: () => scope.postMessage({ type: "ready" }),
          },
        );
        break;
      case "resize":
        renderer?.resize(data.viewport);
        break;
      case "visibility":
        renderer?.setVisibility(data.active, data.reducedMotion);
        break;
      case "input":
        renderer?.setInput(data.input);
        break;
      case "scene":
        renderer?.setScene(data.scene);
        break;
    }
  } catch {
    renderer?.destroy();
    renderer = null;
    scope.postMessage({ type: "error" });
  }
};
