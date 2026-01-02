import React, { createContext, useContext, ReactNode } from 'react';
import { useAnimationLogic } from './animation/useAnimationLogic';
import { AnimationContextType, Message, ChatData } from '../types/animation';

// Re-export types for backward compatibility
export type { AnimationContextType, Message, ChatData };

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

export const AnimationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const contextValue = useAnimationLogic();

  return (
    <AnimationContext.Provider value={contextValue}>
      {children}
    </AnimationContext.Provider>
  );
};

export const useAnimation = (): AnimationContextType => {
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
};

// Export a hook to get the setSvgRef function (Legacy support)
export const useSvgRef = () => {
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error('useSvgRef must be used within an AnimationProvider');
  }
  return context.setSvgRef;
};
