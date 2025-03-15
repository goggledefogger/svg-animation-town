/**
 * SVG animation presets for fallback in case the backend is unavailable
 */

/**
 * Bat signal animation preset
 */
export const batSignalPresetSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect id="background" width="100%" height="100%" fill="#121212" />
  <defs>
    <radialGradient id="lightGradient" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
      <stop offset="0%" stop-color="#ffdf00" stop-opacity="0.8" />
      <stop offset="70%" stop-color="#ffdf00" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#ffdf00" stop-opacity="0" />
    </radialGradient>
  </defs>
  <circle id="lightBeam" cx="400" cy="300" r="180" fill="url(#lightGradient)" opacity="0">
    <animate attributeName="r" values="0;180" dur="2s" begin="0s" fill="freeze" />
    <animate attributeName="opacity" values="0;0.9" dur="2s" begin="0s" fill="freeze" />
  </circle>
  <path id="batSymbol" d="M400,270 L430,320 C450,310 470,310 485,320 C485,280 450,260 400,230 C350,260 315,280 315,320 C330,310 350,310 370,320 Z" fill="#000000" opacity="0">
    <animate attributeName="opacity" values="0;1" dur="1s" begin="1.5s" fill="freeze" />
  </path>
  <style>
    @keyframes pulse {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }
    #lightBeam {
      animation: pulse 2s ease-in-out infinite;
      animation-delay: 2s;
    }
  </style>
</svg>`;

// Other presets can be added here
export const citySkylinePreset: SVGElement[] = [];
export const lightningPreset: SVGElement[] = [];
