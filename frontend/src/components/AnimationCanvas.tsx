import React, { useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { useAnimationPlayback } from '../hooks/useAnimationPlayback';
import { useAnimationRenderer } from '../hooks/useAnimationRenderer';
import { debugLog } from '../utils/logging';
import EmptyState from './EmptyState';

const AnimationCanvas: React.FC = () => {
  const { elements } = useAnimation();
  const { currentTime } = useAnimationPlayback();
  const { renderElement } = useAnimationRenderer();

  // Debug logging when elements or time changes
  useEffect(() => {
    debugLog('AnimationCanvas - elements changed:', elements);
    debugLog('Current element count:', elements.length);
    if (elements.length > 0) {
      debugLog('First element details:', JSON.stringify(elements[0], null, 2));
    }
  }, [elements]);

  useEffect(() => {
    debugLog('AnimationCanvas - current time:', currentTime);
  }, [currentTime]);

  // Create a test element to verify rendering
  const testElement = {
    id: 'test-circle',
    type: 'circle' as const,
    attributes: {
      cx: 400,
      cy: 300,
      r: 50,
      fill: '#ffdf00',
      stroke: '#ffffff',
      strokeWidth: 2
    },
    animations: []
  };

  // Sort elements to ensure background elements (like sky/rect) are rendered first
  // and foreground elements (like sun/circle) are rendered on top
  const sortedElements = [...elements].sort((a, b) => {
    // Background elements should have lower z-index
    if (a.type === 'rect' && a.id.toLowerCase().includes('sky')) return -1;
    if (b.type === 'rect' && b.id.toLowerCase().includes('sky')) return 1;

    // Further sort by element type
    if (a.type === 'rect' && b.type !== 'rect') return -1;
    if (a.type !== 'rect' && b.type === 'rect') return 1;

    return 0;
  });

  return (
    <div className="flex-grow bg-black rounded-lg overflow-hidden relative" style={{ minHeight: '400px' }}>
      <svg
        className="w-full h-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background rectangle for debugging */}
        <rect x="0" y="0" width="800" height="600" fill="#1a1a2e" />

        {/* Only render test elements when there are no API elements */}
        {elements.length === 0 && (
          <>
            {/* Test element to verify rendering pipeline */}
            <circle cx="200" cy="200" r="30" fill="red" />

            {/* Render the test element using the renderer */}
            {renderElement(testElement, currentTime)}
          </>
        )}

        {/* Render actual elements in sorted order to ensure proper layering */}
        {sortedElements.map(element => {
          debugLog(`Rendering element ${element.id} of type ${element.type}`);
          return renderElement(element, currentTime);
        })}
      </svg>

      {elements.length === 0 && <EmptyState />}
    </div>
  );
};

export default AnimationCanvas;
