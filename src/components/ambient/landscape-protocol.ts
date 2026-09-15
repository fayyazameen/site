import type { SceneId } from "./scenes";

export type LandscapeViewport = {
  width: number;
  height: number;
  pixelRatio: number;
};

export type LandscapeInput = {
  scroll: number;
  pointerX: number;
  pointerY: number;
  interact: boolean;
};

export type LandscapeCommand =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      variant: "side" | "bottom";
      scene: SceneId;
    }
  | { type: "resize"; viewport: LandscapeViewport }
  | { type: "visibility"; active: boolean; reducedMotion: boolean }
  | { type: "input"; input: LandscapeInput }
  | { type: "scene"; scene: SceneId };

export type LandscapeReply = { type: "ready" } | { type: "error" };
