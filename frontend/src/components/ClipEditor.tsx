import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMovie } from '../contexts/MovieContext';
import { useNavigate } from 'react-router-dom';
import { addDurationGuidance } from '../utils/animationUtils';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';

interface ClipEditorProps {
  onClipUpdate?: () => void;
}

const ClipEditor: React.FC<ClipEditorProps> = ({ onClipUpdate = () => { } }) => {
  const { activeClipId, getActiveClip, updateClip, saveStoryboard } = useMovie();
  const navigate = useNavigate();

  // Get initial clip data - key prop on parent forces remount on clip change
  const initialClip = getActiveClip();

  // Form state
  const [name, setName] = useState(initialClip?.name || '');
  const [duration, setDuration] = useState(initialClip?.duration || 5);
  const [order, setOrder] = useState(initialClip?.order || 0);
  const [prompt, setPrompt] = useState(initialClip?.prompt || '');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Track last saved values to detect dirty state
  const lastSavedValues = useRef({
    name: initialClip?.name || '',
    duration: initialClip?.duration || 5,
    order: initialClip?.order || 0,
    prompt: initialClip?.prompt || '',
  });

  // Timer for hiding the "saved" status
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The actual save function - updates context AND persists to database
  const performSave = useCallback(async () => {
    if (!activeClipId) return;

    // Update local context first
    updateClip(activeClipId, { name, duration, order, prompt });
    lastSavedValues.current = { name, duration, order, prompt };
    onClipUpdate();

    // Persist to database
    try {
      await saveStoryboard();
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save to database:', error);
      setSaveStatus('error');
    }

    // Clear any existing hide timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // Auto-hide status after 2 seconds
    hideTimerRef.current = setTimeout(() => {
      setSaveStatus('idle');
    }, 2000);
  }, [activeClipId, name, duration, order, prompt, updateClip, onClipUpdate, saveStoryboard]);

  // Debounced save - waits 1s after last change before saving
  const debouncedSave = useDebouncedCallback(performSave, 1000);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Trigger debounced save when form values change
  useEffect(() => {
    if (!activeClipId) return;

    const saved = lastSavedValues.current;
    const isDirty = (
      name !== saved.name ||
      duration !== saved.duration ||
      order !== saved.order ||
      prompt !== saved.prompt
    );

    if (isDirty) {
      setSaveStatus('saving');
      debouncedSave();
    }
  }, [activeClipId, name, duration, order, prompt, debouncedSave]);

  // Navigate to animation editor with stored prompt
  const navigateToAnimationEditor = useCallback(() => {
    if (!activeClipId) return;

    const activeClip = getActiveClip();
    if (!activeClip) return;

    const enhancedPrompt = addDurationGuidance(activeClip.prompt || 'Create an animation', activeClip.duration || 5);

    sessionStorage.setItem('pending_prompt', enhancedPrompt);
    localStorage.setItem('editing_clip_id', activeClip.id);

    if (activeClip.animationId) {
      sessionStorage.setItem('load_animation_id', activeClip.animationId);
      sessionStorage.setItem('editing_from_movie', 'true');
      if (activeClip.provider) {
        sessionStorage.setItem('animation_provider', activeClip.provider);
      }
      if (activeClip.model) {
        sessionStorage.setItem('animation_model', activeClip.model);
      }
    } else if (activeClip.svgContent) {
      sessionStorage.setItem('clip_svg_content', activeClip.svgContent);
      sessionStorage.setItem('editing_from_movie', 'true');
      if (activeClip.provider) {
        sessionStorage.setItem('animation_provider', activeClip.provider);
      }
      if (activeClip.model) {
        sessionStorage.setItem('animation_model', activeClip.model);
      }
    }

    navigate('/animation-editor');
  }, [activeClipId, getActiveClip, navigate]);

  // No clip selected
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
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setDuration(isNaN(val) ? 0.5 : val);
          }}
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
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            setOrder(isNaN(val) ? 0 : val);
          }}
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
          {saveStatus === 'error' && (
            <span className="text-red-400 flex items-center">
              <svg className="h-3 w-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Save failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClipEditor;
