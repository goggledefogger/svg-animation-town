import React from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { useAnimationPlayback } from '../hooks/useAnimationPlayback';
import { useAnimationRenderer } from '../hooks/useAnimationRenderer';
import EmptyState from './EmptyState';

const AnimationCanvas: React.FC = () => {
  const { elements } = useAnimation();
  const { currentTime } = useAnimationPlayback();
  const { renderElement } = useAnimationRenderer();

  return (
    <div className="flex-grow bg-black rounded-lg overflow-hidden relative">
      <svg
        className="w-full h-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
      >
        {elements.map(element => renderElement(element, currentTime))}
      </svg>

      {elements.length === 0 && <EmptyState />}
    </div>
  );
};

export default AnimationCanvas;
