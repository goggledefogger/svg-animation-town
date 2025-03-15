import { SVGElement } from '../contexts/AnimationContext';
import { generateId } from './helpers';

// Bat Signal Preset
export const batSignalPreset: SVGElement[] = [
  // Background
  {
    id: generateId(),
    type: 'rect',
    attributes: {
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      fill: '#121212',
    },
    animations: []
  },
  // Light beam circle
  {
    id: generateId(),
    type: 'circle',
    attributes: {
      cx: '50%',
      cy: '50%',
      r: 100,
      fill: '#666666',
      opacity: 0.6,
    },
    animations: [
      {
        id: generateId(),
        targetProperty: 'r',
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 0.5, value: 120 },
          { offset: 1, value: 100 },
        ],
        duration: 3000,
        easing: 'ease-out',
        delay: 0,
        iterationCount: 1,
      },
      {
        id: generateId(),
        targetProperty: 'opacity',
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 0.3, value: 0.7 },
          { offset: 1, value: 0.6 },
        ],
        duration: 3000,
        easing: 'ease-out',
        delay: 0,
        iterationCount: 1,
      }
    ]
  },
  // Bat symbol
  {
    id: generateId(),
    type: 'path',
    attributes: {
      d: 'M50 25 C45 35 30 45 25 55 C35 52 40 52 50 60 C60 52 65 52 75 55 C70 45 55 35 50 25',
      fill: '#ffdf00',
      transform: 'translate(150, 150) scale(2)',
      opacity: 0,
    },
    animations: [
      {
        id: generateId(),
        targetProperty: 'opacity',
        keyframes: [
          { offset: 0, value: 0 },
          { offset: 0.5, value: 0 },
          { offset: 0.8, value: 1 },
          { offset: 1, value: 1 },
        ],
        duration: 3000,
        easing: 'ease-in-out',
        delay: 0,
        iterationCount: 1,
      },
      {
        id: generateId(),
        targetProperty: 'filter',
        keyframes: [
          { offset: 0, value: 'drop-shadow(0 0 2px #ffdf00)' },
          { offset: 0.5, value: 'drop-shadow(0 0 15px #ffdf00)' },
          { offset: 1, value: 'drop-shadow(0 0 2px #ffdf00)' },
        ],
        duration: 2000,
        easing: 'ease-in-out',
        delay: 3000,
        iterationCount: 'infinite',
      }
    ]
  }
];

// Other presets can be added here
export const citySkylinePreset: SVGElement[] = [];
export const lightningPreset: SVGElement[] = [];
