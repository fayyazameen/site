"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  from?: "bottom" | "right";
};

let observer: IntersectionObserver | null = null;
const pending = new Set<Element>();

const Reveal = ({ children, delay = 0, from = "bottom" }: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Above-the-fold content uses the shared page fade and is readable at once.
    if (element.getBoundingClientRect().top < window.innerHeight - 40) return;
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.remove("reveal-pending");
            observer?.unobserve(entry.target);
            pending.delete(entry.target);
          }
          if (!pending.size) {
            observer?.disconnect();
            observer = null;
          }
        },
        { rootMargin: "0px 0px -40px" },
      );
    }
    pending.add(element);
    element.classList.add("reveal-pending");
    observer.observe(element);
    return () => {
      observer?.unobserve(element);
      pending.delete(element);
      if (!pending.size) {
        observer?.disconnect();
        observer = null;
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className="reveal"
      style={
        {
          "--reveal-x": from === "right" ? "28px" : "0px",
          "--reveal-y": from === "right" ? "0px" : "10px",
          "--reveal-delay": delay + "s",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
};

export default Reveal;
