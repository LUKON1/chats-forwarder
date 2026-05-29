"use client";

import Image from "next/image";
// Import static SVG asset as an ES module
import logoImg from "@/assets/logo.svg";

/**
 * Reusable Logo component with size and spin animation controls
 * 
 * @param {object} props
 * @param {string} [props.className] - Sizing styles (e.g., "w-10 h-10")
 * @param {boolean} [props.spin] - If true, applies active infinite rotation animation
 */
export default function Logo({ className = "w-10 h-10", spin = false }) {
  const animationClass = spin 
    ? "animate-spin [animation-duration:3s] [animation-direction:reverse]" 
    : "";

  return (
    <div className={`relative ${className} ${animationClass} object-contain`}>
      <Image
        src={logoImg}
        alt="Application Logo"
        fill
        priority
        sizes="(max-width: 768px) 100vw, 33vw"
      />
    </div>
  );
}
