"use client";

import { useEffect, useRef } from "react";
import type { createLandscape } from "./ambient/landscape";
import { useAmbientScene } from "./ambient/AmbientSceneProvider";

type AmbientArtProps = { variant?: "side" | "bottom" };

const AmbientArt = ({ variant = "side" }: AmbientArtProps) => {
  const figureRef = useRef<HTMLDivElement>(null);
  const landscapeRef = useRef<ReturnType<typeof createLandscape> | null>(null);
  const scene = useAmbientScene();
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const desktop = window.matchMedia("(min-width: 1280px)");
    let generation = 0;
    let disposed = false;
    const initialize = async () => {
      const request = ++generation;
      landscapeRef.current?.destroy();
      landscapeRef.current = null;
      figure.classList.remove("ambient-art-frame--ready");
      if (desktop.matches !== (variant === "side")) return;
      try {
        const { createLandscape } = await import("./ambient/landscape");
        if (disposed || request !== generation) return;
        landscapeRef.current = createLandscape(
          figure,
          variant,
          sceneRef.current,
        );
      } catch {
        // The static mountain remains visible if a rebuild invalidates the chunk.
        if (!disposed && request === generation)
          figure.classList.remove("ambient-art-frame--ready");
      }
    };
    const update = () => {
      void initialize();
    };
    update();
    desktop.addEventListener("change", update);
    return () => {
      disposed = true;
      generation++;
      desktop.removeEventListener("change", update);
      landscapeRef.current?.destroy();
      landscapeRef.current = null;
    };
  }, [variant]);

  useEffect(() => {
    landscapeRef.current?.setScene(scene);
  }, [scene]);

  return (
    <figure
      className={
        variant === "bottom" ? "ambient-art ambient-art--bottom" : "ambient-art"
      }
    >
      <div className="ambient-art-frame" ref={figureRef} aria-hidden="true" />
      <figcaption className="ambient-art-signature">beauty in chaos</figcaption>
    </figure>
  );
};

export default AmbientArt;
