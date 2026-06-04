"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import dogGif from "@/assets/dog.gif";
import birdGif from "@/assets/bird.gif";

export default function MessageFlowAnimation({
  direction = "left-to-right",
  sourcePlatform = "vk",
  isMoving = true,
  padding = 16,
  iconSize = 32,
  bgClass = "bg-yale-blue-950",
}) {
  const containerRef = useRef(null);
  const animalRefs = useRef([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [plateHeight, setPlateHeight] = useState(padding * 2 + iconSize);

  // ResizeObserver to track container width dynamically
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ResizeObserver to track plate height dynamically
  useEffect(() => {
    if (!containerRef.current) return;
    const plateElement = containerRef.current.previousElementSibling;
    if (!plateElement) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPlateHeight(entry.contentRect.height);
      }
    });

    observer.observe(plateElement);
    return () => observer.disconnect();
  }, []);

  // Geometry calculations matching outer dimensions of the plate
  const D = padding * 2 + iconSize; // Pipe diameter matches plate height
  const gap = padding * 2;          // Distance between plate and pipe
  
  const y_bottom = plateHeight + gap + D / 2; // Center of horizontal pipe
  const x_left = D / 2;
  const x_right = containerWidth - D / 2;
  const y_start = plateHeight / 2;            // Dynamic center of VK/TG icons

  // GSAP animation loop for carrier conveyor chain
  useEffect(() => {
    if (!isMoving || containerWidth === 0 || animalRefs.current.length === 0) return;

    const L_vertical = y_bottom - y_start;
    const L_horizontal = x_right - x_left;
    const L_total = L_vertical * 2 + L_horizontal;

    // Linear duration mapping based on total path length
    const totalDuration = 7;
    const duration_down = totalDuration * (L_vertical / L_total);
    const duration_horizontal = totalDuration * (L_horizontal / L_total);
    const duration_up = totalDuration * (L_vertical / L_total);

    const timelines = [];
    const totalAnimals = animalRefs.current.length;

    animalRefs.current.forEach((el, index) => {
      if (!el) return;

      gsap.killTweensOf(el);
      
      // Hide initially and place at the starting node
      gsap.set(el, {
        xPercent: -50,
        yPercent: -50,
        x: direction === "left-to-right" ? x_left : x_right,
        y: y_start,
        opacity: 0,
      });

      const tl = gsap.timeline({
        repeat: -1,
        delay: (index * totalDuration) / totalAnimals,
        defaults: { ease: "none" },
      });

      if (direction === "left-to-right") {
        tl.set(el, { opacity: 1 })
          .to(el, { y: y_bottom, duration: duration_down })
          .to(el, { x: x_right, duration: duration_horizontal })
          .to(el, { y: y_start, duration: duration_up });
      } else {
        tl.set(el, { opacity: 1 })
          .to(el, { y: y_bottom, duration: duration_down })
          .to(el, { x: x_left, duration: duration_horizontal })
          .to(el, { y: y_start, duration: duration_up });
      }

      timelines.push(tl);
    });

    return () => {
      timelines.forEach((tl) => tl.kill());
    };
  }, [direction, isMoving, containerWidth, padding, iconSize, y_bottom, x_left, x_right, y_start]);

  const isVk = sourcePlatform === "vk";
  const isLtr = direction === "left-to-right";
  // VK: Dog runs right (normal = ltr, flipped = rtl)
  // TG: Bird flies left (normal = rtl, flipped = ltr)
  const scaleX = isVk ? (isLtr ? 1 : -1) : (isLtr ? -1 : 1);
  const gifSrc = isVk ? (dogGif.src || dogGif) : (birdGif.src || birdGif);

  // Scaled dimensions of animals fitting the pipe diameter
  const animalWidth = D * 0.9;
  const animalHeight = D * 0.9;

  // Segment heights
  const verticalPipeHeight = y_bottom + D / 2 - plateHeight + 2;
  const innerVerticalHeight = y_bottom - D / 2 - plateHeight + 2;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-10 overflow-hidden"
    >
      {/* Pipe background fill shapes */}
      <div
        style={{
          left: 0,
          width: D,
          top: plateHeight - 2,
          height: verticalPipeHeight,
        }}
        className={`absolute ${bgClass}`}
      />
      <div
        style={{
          left: containerWidth - D,
          width: D,
          top: plateHeight - 2,
          height: verticalPipeHeight,
        }}
        className={`absolute ${bgClass}`}
      />
      <div
        style={{
          left: 0,
          width: containerWidth,
          top: y_bottom - D / 2,
          height: D,
        }}
        className={`absolute ${bgClass}`}
      />

      {/* External borders */}
      <div
        style={{
          left: 0,
          top: plateHeight - 2,
          height: verticalPipeHeight,
        }}
        className="absolute border-l-2 border-black"
      />
      <div
        style={{
          right: 0,
          top: plateHeight - 2,
          height: verticalPipeHeight,
        }}
        className="absolute border-r-2 border-black"
      />
      <div
        style={{
          left: 0,
          width: containerWidth,
          top: y_bottom + D / 2,
        }}
        className="absolute border-b-2 border-black"
      />

      {/* Internal borders */}
      <div
        style={{
          left: D,
          top: plateHeight - 2,
          height: innerVerticalHeight,
        }}
        className="absolute border-l-2 border-black"
      />
      <div
        style={{
          left: containerWidth - D,
          top: plateHeight - 2,
          height: innerVerticalHeight,
        }}
        className="absolute border-l-2 border-black"
      />
      <div
        style={{
          left: D - 2,
          width: containerWidth - D * 2 + 4,
          top: y_bottom - D / 2,
        }}
        className="absolute border-t-2 border-black"
      />

      {/* Conveyor Animals Chain */}
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          ref={(el) => {
            if (el) animalRefs.current[index] = el;
          }}
          className={`absolute pointer-events-none ${
            scaleX === -1 ? "-scale-x-100" : ""
          }`}
          style={{
            width: animalWidth,
            height: animalHeight,
            left: 0,
            top: 0,
            zIndex: 12,
          }}
        >
          <Image
            src={gifSrc}
            alt={sourcePlatform}
            className="object-contain"
            fill
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}
