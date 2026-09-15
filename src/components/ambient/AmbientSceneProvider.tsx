"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { type SceneId } from "./scenes";
import { getWritingScene, isWritingPage } from "./writing-scenes";

const SceneContext = createContext<SceneId>("night");

export const useAmbientScene = () => useContext(SceneContext);

export default function AmbientSceneProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const [selection, setSelection] = useState<{
    pathname: string;
    scene: SceneId;
  } | null>(null);

  useEffect(() => {
    setSelection({ pathname, scene: getWritingScene(pathname) });
  }, [pathname]);

  // Use a weather scene until the client-side random assignment is ready.
  const scene =
    selection?.pathname === pathname
      ? selection.scene
      : isWritingPage(pathname)
        ? "snow"
        : "night";

  return (
    <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
  );
}
