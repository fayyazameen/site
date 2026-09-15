"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { type PointerEvent, type ReactNode, useRef } from "react";

type MagneticProps = {
  children: ReactNode;
};

const Magnetic = ({ children }: MagneticProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 260, damping: 20, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 260, damping: 20, mass: 0.5 });

  const pull = (event: PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || event.pointerType === "touch" || !ref.current) {
      return;
    }

    const bounds = ref.current.getBoundingClientRect();
    rawX.set((event.clientX - bounds.left - bounds.width / 2) * 0.35);
    rawY.set((event.clientY - bounds.top - bounds.height / 2) * 0.35);
  };

  const release = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <motion.div
      className="magnetic"
      ref={ref}
      style={{ x, y }}
      onPointerMove={pull}
      onPointerLeave={release}
    >
      {children}
    </motion.div>
  );
};

export default Magnetic;
