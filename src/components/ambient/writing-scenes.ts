import { SCENES, type SceneId } from "./scenes";

export const WRITING_SCENES = (Object.keys(SCENES) as SceneId[]).filter(
  (scene) => scene !== "night",
);

export const isWritingPage = (pathname: string) =>
  pathname === "/blog" || pathname.startsWith("/blog/");

const assignedScenes = new Map<string, SceneId>();
let remaining: SceneId[] = [];
let previous: SceneId | undefined;

// A shuffled bag gives different articles variety. Assignments stay fixed
// during the visit, including back navigation and responsive layout changes.
export function getWritingScene(pathname: string): SceneId {
  if (!isWritingPage(pathname)) return "night";
  const assigned = assignedScenes.get(pathname);
  if (assigned) return assigned;
  if (!remaining.length) {
    remaining = [...WRITING_SCENES];
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const last = remaining.length - 1;
    if (remaining[last] === previous) {
      [remaining[0], remaining[last]] = [remaining[last], remaining[0]];
    }
  }
  const scene = remaining.pop()!;
  assignedScenes.set(pathname, scene);
  previous = scene;
  return scene;
}
