import React from 'react';

// Long arrow component for message flow (originally Line Awesome LiaLongArrowAltUpSolid, rotated)
export default function FlowArrowIcon({ reversed = false, className = '', ...props }) {
  // Rotate 90deg (pointing right/forward) or -90deg (pointing left/backward)
  const rotationClass = reversed ? "-rotate-90" : "rotate-90";
  
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={`inline-block transform ${rotationClass} ${className}`}
      {...props}
    >
      {/* Centering translate(4, 0.36) to perfectly align the arrow in 32x32 viewbox */}
      <g transform="translate(4, 0.36)">
        <path d="M13.281 3.281l-.718.688-9 9 1.437 1.438L11 8.406V28h2V8.406l6 6 1.438-1.438-9-9z" />
      </g>
    </svg>
  );
}
