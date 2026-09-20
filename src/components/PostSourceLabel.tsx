import type { PostSource } from "@/types";

export default function PostSourceLabel({ source }: { source: PostSource }) {
  if (source !== "medium") return null;

  return (
    <span className="post-source" title="Originally published on Medium">
      medium
    </span>
  );
}
