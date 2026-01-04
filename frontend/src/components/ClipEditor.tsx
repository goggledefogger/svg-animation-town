import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMovie } from '../contexts/MovieContext';
import { useNavigate } from 'react-router-dom';
import { addDurationGuidance } from '../utils/animationUtils';

interface ClipEditorProps {
  onClipUpdate?: () => void;
}

const ClipEditor: React.FC<ClipEditorProps> = ({ onClipUpdate = () => { } }) => {
  const { activeClipId, getActiveClip, updateClip } = useMovie();
  const navigate = useNavigate();

  // Get initial clip data - since we use a 'key' in parent,
  // this component remounts on activeClipId change, so we can init state directly
  const initialClip = getActiveClip();

  // Form state
  const [name, setName] = useState(initialClip?.name || '');
  const [duration, setDuration] = useState(initialClip?.duration || 5);
  const [order, setOrder] = useState(initialClip?.order || 0);
  const [prompt, setPrompt] = useState(initialClip?.prompt || '');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Track what we last saved - this prevents isDirty from oscillating
  const lastSavedValues = useRef({
    name: initialClip?.name || '',
    duration: initialClip?.duration || 5,
    order: initialClip?.order || 0,
    prompt: initialClip?.prompt || '',
  });

  // Track timers to properly clean them up
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if form is dirty by comparing to LAST SAVED values (not context)
  const isDirty = React.useMemo(() => {
    if (!activeClipId) return false;

    const saved = lastSavedValues.current;
    return (
      name !== saved.name ||
      duration !== saved.duration ||
      order !== saved.order ||
      prompt !== saved.prompt
    );
  }, [activeClipId, name, duration, order, prompt]);

  // Use a ref to always have access to the latest values without causing effect re-runs
  const valuesRef = useRef({ name, duration, order, prompt, activeClipId, onClipUpdate, updateClip });
  valuesRef.current = { name, duration, order, prompt, activeClipId, onClipUpdate, updateClip };

  // Store the stable save function in a ref
  const performSaveRef = useRef(() => {
    const { name, duration, order, prompt, activeClipId, onClipUpdate, updateClip } = valuesRef.current;
    if (!activeClipId) return;

    updateClip(activeClipId, { name, duration, order, prompt });
    lastSavedValues.current = { name, duration, order, prompt };
    onClipUpdate();
  });

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Auto-save effect - ONLY runs when isDirty changes (not on every render)
  useEffect(() => {
    // Clear any existing timers
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!isDirty) {
      // Reset to idle if we're not dirty (e.g., after switching clips)
      setSaveStatus('idle');
      return;
    }

    // Start saving indicator
    setSaveStatus('saving');

    // Debounce the save for 1 second
    saveTimerRef.current = setTimeout(() => {
      performSaveRef.current();
      setSaveStatus('saved');

      // Auto-hide "saved" after 2 seconds
      hideTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }, 1000);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [isDirty]); // ONLY depend on isDirty - not performSave or other values

  // Navigate to animation editor with stored prompt
  const navigateToAnimationEditor = useCallback(() => {
    if (!activeClipId) return;

    const activeClip = getActiveClip();
    if (!activeClip) return;

    // Store prompt and clip ID for animation editor to use
    // Use our utility to add duration guidance if needed
    const enhancedPrompt = addDurationGuidance(activeClip.prompt || 'Create an animation', activeClip.duration || 5);

    sessionStorage.setItem('pending_prompt', enhancedPrompt);
    localStorage.setItem('editing_clip_id', activeClip.id);

    // Store the animation ID if it exists
    if (activeClip.animationId) {
      sessionStorage.setItem('load_animation_id', activeClip.animationId);
      // Important: Flag that we're editing a clip from the movie editor
      sessionStorage.setItem('editing_from_movie', 'true');

      // If the clip has a provider setting, also pass that so the animation editor uses the same AI
      if (activeClip.provider) {
        sessionStorage.setItem('animation_provider', activeClip.provider);
      }
      if (activeClip.model) {
        sessionStorage.setItem('animation_model', activeClip.model);
      }
    } else if (activeClip.svgContent) {
      // If there's no animation ID but we have SVG content, store it directly
      sessionStorage.setItem('clip_svg_content', activeClip.svgContent);
      // Important: Flag that we're editing a clip from the movie editor
      sessionStorage.setItem('editing_from_movie', 'true');

      // If the clip has a provider setting, also pass that
      if (activeClip.provider) {
        sessionStorage.setItem('animation_provider', activeClip.provider);
      }
      if (activeClip.model) {
        sessionStorage.setItem('animation_model', activeClip.model);
      }
    }

    // Navigate to animation editor
    navigate('/animation-editor');
  }, [activeClipId, getActiveClip, navigate]);

  // If no clip is selected, show a placeholder
  if (!activeClipId) {
    return (
      <div className="text-gray-400 text-center p-4">
        Select a clip to edit its properties
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="clip-name" className="block text-sm font-medium text-gray-300 mb-1">
          Clip Name
        </label>
        <input
          id="clip-name"
          type="text"
          className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="clip-duration" className="block text-sm font-medium text-gray-300 mb-1">
          Duration (seconds)
        </label>
        <input
          id="clip-duration"
          type="number"
          min="0.5"
          step="0.5"
          className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
          value={duration}
          onChange={(e) => setDuration(parseFloat(e.target.value))}
        />
        <p className="text-xs text-gray-400 mt-1">
          Animation timing will automatically adjust to match this duration when possible.
        </p>
      </div>

      <div>
        <label htmlFor="clip-order" className="block text-sm font-medium text-gray-300 mb-1">
          Order in Storyboard
        </label>
        <input
          id="clip-order"
          type="number"
          min="0"
          step="1"
          className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
          value={order}
          onChange={(e) => setOrder(parseInt(e.target.value, 10))}
        />
      </div>

      <div>
        <label htmlFor="clip-prompt" className="block text-sm font-medium text-gray-300 mb-1">
          Scene Prompt
        </label>
        <textarea
          id="clip-prompt"
          className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white min-h-24 resize-y cursor-not-allowed opacity-75"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="No prompt saved for this clip"
          readOnly
          disabled
        />
        <div className="mt-2">
          <button
            onClick={navigateToAnimationEditor}
            disabled={!prompt}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white p-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Edit in Animation Editor
          </button>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between">
        <div className="text-xs transition-opacity duration-300">
          {saveStatus === 'saving' && (
            <span className="text-bat-yellow flex items-center">
              <svg className="animate-spin h-3 w-3 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving changes...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-green-400 flex items-center">
              <svg className="h-3 w-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Changes saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClipEditor;
