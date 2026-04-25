import React, { useCallback, useMemo } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

const Beam = ({ width, x, delay, duration }) => {
  const hue = Math.floor(Math.random() * 360);
  const ar = Math.floor(Math.random() * 10) + 1;

  return (
    <motion.div
      style={{
        top: 0,
        left: x,
        width,
        aspectRatio: `1 / ${ar}`,
        background: `linear-gradient(hsl(${hue} 80% 60%), transparent)`
      }}
      className="absolute"
      initial={{ y: "100cqmax", x: "-50%" }}
      animate={{ y: "-100%", x: "-50%" }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );
};

export const WarpBackground = ({
  children,
  perspective = 100,
  className,
  beamsPerSide = 3,
  beamSize = 5,
  beamDelayMax = 3,
  beamDelayMin = 0,
  beamDuration = 3,
  gridColor = "hsl(var(--border))",
  ...props
}) => {
  const generateBeams = useCallback(() => {
    const beams = [];
    const cellsPerSide = Math.floor(100 / beamSize);
    const step = cellsPerSide / beamsPerSide;
    for (let i = 0; i < beamsPerSide; i++) {
      const x = Math.floor(i * step);
      const delay = Math.random() * (beamDelayMax - beamDelayMin) + beamDelayMin;
      beams.push({ x, delay });
    }
    return beams;
  }, [beamsPerSide, beamSize, beamDelayMax, beamDelayMin]);

  const topBeams = useMemo(() => generateBeams(), [generateBeams]);
  const rightBeams = useMemo(() => generateBeams(), [generateBeams]);
  const bottomBeams = useMemo(() => generateBeams(), [generateBeams]);
  const leftBeams = useMemo(() => generateBeams(), [generateBeams]);

  const beamSizePct = `${beamSize}%`;
  const gridBackground = `linear-gradient(${gridColor} 0 1px, transparent 1px ${beamSizePct}) 50% -0.5px / ${beamSizePct} ${beamSizePct}, linear-gradient(90deg, ${gridColor} 0 1px, transparent 1px ${beamSizePct}) 50% 50% / ${beamSizePct} ${beamSizePct}`;

  const sideBaseStyle = {
    backgroundImage: gridBackground,
    backgroundSize: `${beamSizePct} ${beamSizePct}`,
    transformStyle: "preserve-3d",
    containerType: "size"
  };

  return (
    <div className={cn("relative rounded border p-20", className)} {...props}>
      <div
        style={{
          perspective: `${perspective}px`,
          transformStyle: "preserve-3d",
          containerType: "size",
          clipPath: "inset(0)"
        }}
        className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
      >
        {/* top side */}
        <div
          style={{
            ...sideBaseStyle,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100cqi",
            height: "100cqmax",
            transformOrigin: "50% 0%",
            transform: "rotateX(-90deg)",
            zIndex: 20
          }}
        >
          {topBeams.map((beam, index) => (
            <Beam
              key={`top-${index}`}
              width={beamSizePct}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>

        {/* bottom side */}
        <div
          style={{
            ...sideBaseStyle,
            position: "absolute",
            top: "100%",
            left: 0,
            width: "100cqi",
            height: "100cqmax",
            transformOrigin: "50% 0%",
            transform: "rotateX(-90deg)"
          }}
        >
          {bottomBeams.map((beam, index) => (
            <Beam
              key={`bottom-${index}`}
              width={beamSizePct}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>

        {/* left side */}
        <div
          style={{
            ...sideBaseStyle,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100cqh",
            height: "100cqmax",
            transformOrigin: "0% 0%",
            transform: "rotate(90deg) rotateX(-90deg)"
          }}
        >
          {leftBeams.map((beam, index) => (
            <Beam
              key={`left-${index}`}
              width={beamSizePct}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>

        {/* right side */}
        <div
          style={{
            ...sideBaseStyle,
            position: "absolute",
            top: 0,
            right: 0,
            width: "100cqh",
            height: "100cqmax",
            transformOrigin: "100% 0%",
            transform: "rotate(-90deg) rotateX(-90deg)"
          }}
        >
          {rightBeams.map((beam, index) => (
            <Beam
              key={`right-${index}`}
              width={beamSizePct}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default WarpBackground;
