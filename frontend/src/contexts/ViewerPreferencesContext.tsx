import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Define the background types
export type BackgroundType = 'solid' | 'gradient';
export type GradientDirection = 'to-bottom' | 'to-right' | 'diagonal';

export interface BackgroundOption {
  id: string;
  name: string;
  type: BackgroundType;
  value: string;
  isDark: boolean;
  gradientDirection?: GradientDirection;
  gradientColors?: string[];
}

// Define the context interface
interface ViewerPreferencesContextType {
  currentBackground: BackgroundOption;
  setBackground: (background: BackgroundOption) => void;
  backgroundOptions: BackgroundOption[];
  getBackgroundStyle: () => React.CSSProperties;
}

// Define preset background options
const BACKGROUND_OPTIONS: BackgroundOption[] = [
  // Solid Colors
  { id: 'dark-black', name: 'Dark', type: 'solid', value: '#121212', isDark: true },
  { id: 'light-white', name: 'Light', type: 'solid', value: '#FFFFFF', isDark: false },
  { id: 'blue-gray', name: 'Blue Gray', type: 'solid', value: '#1E293B', isDark: true },
  { id: 'navy', name: 'Navy', type: 'solid', value: '#0A192F', isDark: true },
  { id: 'warm-gray', name: 'Warm Gray', type: 'solid', value: '#F5F5F4', isDark: false },

  // Dark Gradients
  {
    id: 'dark-gradient-1',
    name: 'Midnight',
    type: 'gradient',
    value: 'linear-gradient(to bottom, #0F2027, #203A43, #2C5364)',
    isDark: true,
    gradientDirection: 'to-bottom',
    gradientColors: ['#0F2027', '#203A43', '#2C5364']
  },
  {
    id: 'dark-gradient-2',
    name: 'Gotham Night',
    type: 'gradient',
    value: 'linear-gradient(135deg, #121212, #1A222C)',
    isDark: true,
    gradientDirection: 'diagonal',
    gradientColors: ['#121212', '#1A222C']
  },

  // Light Gradients
  {
    id: 'light-gradient-1',
    name: 'Soft Morning',
    type: 'gradient',
    value: 'linear-gradient(to right, #F8F9FA, #E9ECEF)',
    isDark: false,
    gradientDirection: 'to-right',
    gradientColors: ['#F8F9FA', '#E9ECEF']
  },
  {
    id: 'light-gradient-2',
    name: 'Cream Paper',
    type: 'gradient',
    value: 'linear-gradient(135deg, #FFF9E8, #F7F3E3)',
    isDark: false,
    gradientDirection: 'diagonal',
    gradientColors: ['#FFF9E8', '#F7F3E3']
  }
];

// Find the first dark gradient to use as default
const DEFAULT_BACKGROUND = BACKGROUND_OPTIONS.find(bg => bg.type === 'gradient' && bg.isDark) || BACKGROUND_OPTIONS[0];

// Create the context
const ViewerPreferencesContext = createContext<ViewerPreferencesContextType | undefined>(undefined);

// Local storage key for persisting preferences
const LOCAL_STORAGE_KEY = 'viewer_preferences';

// Provider component
export const ViewerPreferencesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize state with the first dark gradient as default, but try to load from localStorage
  const [currentBackground, setCurrentBackground] = useState<BackgroundOption>(DEFAULT_BACKGROUND);

  // Load preferences from localStorage on initial mount
  useEffect(() => {
    try {
      const savedPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedPreferences) {
        const parsedPreferences = JSON.parse(savedPreferences);
        if (parsedPreferences.backgroundId) {
          const savedBackground = BACKGROUND_OPTIONS.find(bg => bg.id === parsedPreferences.backgroundId);
          if (savedBackground) {
            setCurrentBackground(savedBackground);
          }
        }
      }
    } catch (error) {
      console.error('Error loading viewer preferences:', error);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        backgroundId: currentBackground.id
      }));
    } catch (error) {
      console.error('Error saving viewer preferences:', error);
    }
  }, [currentBackground]);

  // Set background by option
  const setBackground = (background: BackgroundOption) => {
    setCurrentBackground(background);
  };

  // Helper function to get the background style object
  const getBackgroundStyle = (): React.CSSProperties => {
    if (currentBackground.type === 'solid') {
      return { backgroundColor: currentBackground.value };
    } else {
      return { background: currentBackground.value };
    }
  };

  // Provide context values
  const contextValue: ViewerPreferencesContextType = {
    currentBackground,
    setBackground,
    backgroundOptions: BACKGROUND_OPTIONS,
    getBackgroundStyle,
  };

  return (
    <ViewerPreferencesContext.Provider value={contextValue}>
      {children}
    </ViewerPreferencesContext.Provider>
  );
};

// Hook for using the context
export const useViewerPreferences = (): ViewerPreferencesContextType => {
  const context = useContext(ViewerPreferencesContext);
  if (context === undefined) {
    throw new Error('useViewerPreferences must be used within a ViewerPreferencesProvider');
  }
  return context;
};
