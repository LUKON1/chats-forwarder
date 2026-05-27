"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/* 
  Neo-Brutalist 2-frame animation representing message carrier animals.
  Animal 1: Running Dog (VK -> TG)
  Animal 2: Flying Bird (TG -> VK)
  Both carrying a letter.
*/

// Dog Frame 1 (legs apart)
const DogFrame1 = () => (
  <svg width="48" height="32" viewBox="0 0 48 32" className="fill-lime-cream-400 stroke-black stroke-2">
    {/* Body */}
    <rect x="12" y="10" width="22" height="12" />
    {/* Head */}
    <rect x="30" y="4" width="8" height="8" />
    {/* Ears */}
    <rect x="28" y="2" width="4" height="4" />
    {/* Legs Frame 1 */}
    <rect x="12" y="22" width="4" height="8" />
    <rect x="28" y="22" width="4" height="8" />
    {/* Tail */}
    <rect x="8" y="10" width="4" height="4" />
    {/* Letter in mouth */}
    <rect x="38" y="8" width="8" height="6" className="fill-tropical-teal-400" />
    <line x1="38" y1="8" x2="42" y2="11" className="stroke-black stroke-1" />
    <line x1="46" y1="8" x2="42" y2="11" className="stroke-black stroke-1" />
  </svg>
);

// Dog Frame 2 (legs together)
const DogFrame2 = () => (
  <svg width="48" height="32" viewBox="0 0 48 32" className="fill-lime-cream-400 stroke-black stroke-2">
    {/* Body */}
    <rect x="12" y="10" width="22" height="12" />
    {/* Head */}
    <rect x="30" y="4" width="8" height="8" />
    {/* Ears */}
    <rect x="28" y="2" width="4" height="4" />
    {/* Legs Frame 2 (bent) */}
    <rect x="16" y="22" width="4" height="6" />
    <rect x="24" y="22" width="4" height="6" />
    {/* Tail */}
    <rect x="8" y="8" width="4" height="4" />
    {/* Letter in mouth */}
    <rect x="38" y="8" width="8" height="6" className="fill-tropical-teal-400" />
    <line x1="38" y1="8" x2="42" y2="11" className="stroke-black stroke-1" />
    <line x1="46" y1="8" x2="42" y2="11" className="stroke-black stroke-1" />
  </svg>
);

// Bird Frame 1 (wings up)
const BirdFrame1 = () => (
  <svg width="48" height="32" viewBox="0 0 48 32" className="fill-tropical-teal-400 stroke-black stroke-2">
    {/* Body */}
    <rect x="14" y="12" width="20" height="10" />
    {/* Head */}
    <rect x="8" y="8" width="8" height="8" />
    {/* Beak */}
    <polygon points="8,12 2,14 8,16" className="fill-lime-cream-400" />
    {/* Wing Up */}
    <rect x="20" y="2" width="6" height="10" />
    {/* Tail */}
    <polygon points="34,14 40,10 40,20" />
    {/* Letter in beak */}
    <rect x="0" y="6" width="8" height="6" className="fill-lime-cream-50" />
    <line x1="0" y1="6" x2="4" y2="9" className="stroke-black stroke-1" />
    <line x1="8" y1="6" x2="4" y2="9" className="stroke-black stroke-1" />
  </svg>
);

// Bird Frame 2 (wings down)
const BirdFrame2 = () => (
  <svg width="48" height="32" viewBox="0 0 48 32" className="fill-tropical-teal-400 stroke-black stroke-2">
    {/* Body */}
    <rect x="14" y="12" width="20" height="10" />
    {/* Head */}
    <rect x="8" y="8" width="8" height="8" />
    {/* Beak */}
    <polygon points="8,12 2,14 8,16" className="fill-lime-cream-400" />
    {/* Wing Down */}
    <rect x="20" y="22" width="6" height="10" />
    {/* Tail */}
    <polygon points="34,14 40,12 40,18" />
    {/* Letter in beak */}
    <rect x="0" y="6" width="8" height="6" className="fill-lime-cream-50" />
    <line x1="0" y1="6" x2="4" y2="9" className="stroke-black stroke-1" />
    <line x1="8" y1="6" x2="4" y2="9" className="stroke-black stroke-1" />
  </svg>
);

const Carrier = ({ direction, sourcePlatform, frame }) => {
  if (sourcePlatform === "vk") {
    // VK: Dog running right, flip if moving left
    const scaleX = direction === "left-to-right" ? 1 : -1;
    return (
      <div style={{ transform: `scaleX(${scaleX})` }} className="inline-block">
        {frame === 1 ? <DogFrame1 /> : <DogFrame2 />}
      </div>
    );
  } else {
    // TG: Bird flying left, flip if moving right
    const scaleX = direction === "left-to-right" ? -1 : 1;
    return (
      <div style={{ transform: `scaleX(${scaleX})` }} className="inline-block">
        {frame === 1 ? <BirdFrame1 /> : <BirdFrame2 />}
      </div>
    );
  }
};

export default function MessageFlowAnimation({ direction = "left-to-right", sourcePlatform = "vk", isMoving = true }) {
  const containerRef = useRef(null);
  const carrierRef = useRef(null);
  const [frame, setFrame] = useState(1);

  // Handle 2-frame alternation loop (150ms interval)
  useEffect(() => {
    if (!isMoving) return;
    const interval = setInterval(() => {
      setFrame((f) => (f === 1 ? 2 : 1));
    }, 150);
    return () => clearInterval(interval);
  }, [isMoving]);

  // Handle GSAP slide animation
  useEffect(() => {
    if (!isMoving || !carrierRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const startX = direction === "left-to-right" ? -50 : containerWidth;
    const endX = direction === "left-to-right" ? containerWidth : -50;

    // Reset position
    gsap.set(carrierRef.current, { x: startX });

    const anim = gsap.to(carrierRef.current, {
      x: endX,
      duration: 4,
      repeat: -1,
      ease: "none",
    });

    return () => {
      anim.kill();
    };
  }, [direction, isMoving]);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full h-12 bg-yale-blue-950 border-y-2 border-black overflow-hidden flex items-center"
    >
      {/* Visual flow path indicators (dashed line) */}
      <div className="absolute inset-x-0 h-0.5 border-t-2 border-dashed border-zinc-700"></div>

      <div 
        ref={carrierRef} 
        className="absolute pointer-events-none"
        style={{ top: "8px" }}
      >
        <Carrier direction={direction} sourcePlatform={sourcePlatform} frame={frame} />
      </div>
    </div>
  );
}
