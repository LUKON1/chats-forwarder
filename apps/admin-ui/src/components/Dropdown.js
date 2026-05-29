"use client";

import { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";

/**
 * Custom Dropdown component built in neo-brutalist style
 * 
 * @param {object} props
 * @param {string|number} props.value - Current selected value
 * @param {function} props.onChange - Callback triggered on selection
 * @param {Array<{value: string|number, label: string}>} props.options - List of options
 * @param {string} [props.placeholder] - Text shown when no option is selected
 * @param {string} [props.className] - Extra wrapping CSS classes
 */
export default function Dropdown({ value, onChange, options, placeholder = "Select option", className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const listRef = useRef(null);

  /* Find active option label */
  const selectedOption = options.find((opt) => opt.value === value);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Animating options list height/fade with GSAP
  useEffect(() => {
    if (!listRef.current) return;

    if (isOpen) {
      gsap.killTweensOf(listRef.current);
      gsap.to(listRef.current, {
        autoAlpha: 1,
        height: "auto",
        duration: 0.25,
        ease: "power2.out"
      });
    } else {
      gsap.killTweensOf(listRef.current);
      gsap.to(listRef.current, {
        autoAlpha: 0,
        height: 0,
        duration: 0.2,
        ease: "power2.in"
      });
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Active Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-yale-blue-950 border-2 border-black text-lime-cream-50 font-mono text-sm focus:outline-none focus:border-lime-cream-400 select-none cursor-pointer hover:bg-yale-blue-900 active:translate-y-0.5 transition-all duration-75 text-left"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`text-[10px] font-bold text-lime-cream-400 ml-2 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* Dropdown Options List */}
      <div 
        ref={listRef}
        className="absolute left-0 right-0 mt-1.5 bg-yale-blue-900 border-2 border-black shadow-[4px_4px_0px_#000000] z-50 font-mono text-sm max-h-60 overflow-y-auto invisible opacity-0"
        style={{ height: 0 }}
      >
        {options.length === 0 ? (
          <div className="px-4 py-2.5 text-zinc-500 text-xs italic">
            No options available
          </div>
        ) : (
          options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 transition-colors cursor-pointer block truncate ${
                  isSelected
                    ? "bg-lime-cream-400 text-black font-bold"
                    : "text-lime-cream-200 hover:bg-lime-cream-400 hover:text-black"
                }`}
              >
                {option.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
