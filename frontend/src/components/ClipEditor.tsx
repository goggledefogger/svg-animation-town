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

  // Get initial clip data - key prop on parent forces remount on clip change
  const initialClip = getActiveClip();

  // Form state
  const [name, setName] = useState(initialClip?.name || '');
  const [duration, setDuration] = useState(initialClip?.duration || 5);
  const [order, setOrder] = useState(initialClip?.order || 0);
  const [prompt, setPrompt] = useState(initialClip?.prompt || '');
  const [isDirty, setIsDirty] = useState(false);

  // Track last synced values to detect changes
  const lastSyncedValues = useRef({
    name: initialClip?.name || '',
    duration: initialClip?.duration || 5,
    order: initialClip?.order || 0,
    prompt: initialClip?.prompt || '',
  });

  // Debounce timer for updating context
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track pending values for flush on unmount
  const pendingValuesRef = useRef<{ name: string; duration: number; order: number; prompt: string } | null>(null);
  const updateClipRef = useRef(updateClip);
  const onClipUpdateRef = useRef(onClipUpdate);
  const activeClipIdRef = useRef(activeClipId);

  // Keep refs updated
  updateClipRef.current = updateClip;
  onClipUpdateRef.current = onClipUpdate;
  activeClipIdRef.current = activeClipId;

  // Flush pending changes on unmount
  useEffect(() => {
    return () => {
      // Clear timer
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
      // Flush any pending changes immediately
      if (pendingValuesRef.current && activeClipIdRef.current) {
        const { name, duration, order, prompt } = pendingValuesRef.current;
        updateClipRef.current(activeClipIdRef.current, { name, duration, order, prompt });
        onClipUpdateRef.current();
      }
    };
  }, []);

  // Debounced sync to context when form values change
  useEffect(() => {
    if (!activeClipId) return;

    const synced = lastSyncedValues.current;
    const hasPending = (
      name !== synced.name ||
      duration !== synced.duration ||
      order !== synced.order ||
      prompt !== synced.prompt
    );

    console.log(`[ClipEditor] Effect run - hasPending: ${hasPending}, isDirty state: ${isDirty}`);

    if (!hasPending) {
      console.log(`[ClipEditor] No pending changes, clearing state`);
      pendingValuesRef.current = null;
      setIsDirty(false);
      return;
    }

    // Track pending values for flush
    pendingValuesRef.current = { name, duration, order, prompt };
    console.log(`[ClipEditor] Setting isDirty to true`);
    setIsDirty(true);

    // Clear existing timer
    if (updateTimerRef.current) {
      console.log(`[ClipEditor] Clearing existing timer`);
      clearTimeout(updateTimerRef.current);
    }

    // Debounce context update by 500ms
    console.log(`[ClipEditor] Starting 500ms timer`);
    updateTimerRef.current = setTimeout(() => {
      console.log(`[ClipEditor] Timer fired! Updating context and setting isDirty to false`);
      updateClip(activeClipId, { name, duration, order, prompt });
      lastSyncedValues.current = { name, duration, order, prompt };
      pendingValuesRef.current = null;
      setIsDirty(false);
      onClipUpdate();
    }, 500);

    return () => {
      console.log(`[ClipEditor] Effect cleanup - clearing timer`);
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [activeClipId, name, duration, order, prompt, updateClip, onClipUpdate]); // Note: isDirty NOT in deps - it would cause loop

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

      {/* Save status indicator */}
      <div className="pt-2">
        <div className="text-xs transition-opacity duration-300">
          {isDirty && (
            <span className="text-bat-yellow flex items-center">
              <svg className="animate-spin h-3 w-3 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving changes...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClipEditor;
