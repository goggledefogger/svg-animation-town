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
  const [playbackSpeed, setPlaybackSpeed] = useState(initialClip?.playbackSpeed || 1.0);

  // Save status state
  const [showSaved, setShowSaved] = useState(false);

  // Track last synced values to detect changes
  const lastSyncedRef = useRef({
    name: initialClip?.name || '',
    duration: initialClip?.duration || 5,
    order: initialClip?.order || 0,
    prompt: initialClip?.prompt || '',
    playbackSpeed: initialClip?.playbackSpeed || 1.0,
  });

  // Timer refs
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs to current values for unmount flush
  const currentValuesRef = useRef({ name, duration, order, prompt, playbackSpeed });
  currentValuesRef.current = { name, duration, order, prompt, playbackSpeed };

  // Keep refs to functions for unmount flush
  const updateClipRef = useRef(updateClip);
  const onClipUpdateRef = useRef(onClipUpdate);
  const activeClipIdRef = useRef(activeClipId);
  updateClipRef.current = updateClip;
  onClipUpdateRef.current = onClipUpdate;
  activeClipIdRef.current = activeClipId;

  // Stable sync function
  const syncToContext = useCallback(() => {
    if (!activeClipId) return;

    const current = { name, duration, order, prompt, playbackSpeed };
    const last = lastSyncedRef.current;

    // Check if actually changed
    if (current.name === last.name &&
        current.duration === last.duration &&
        current.order === last.order &&
        current.prompt === last.prompt &&
        current.playbackSpeed === last.playbackSpeed) {
      return;
    }

    // Sync to context
    updateClip(activeClipId, current);
    lastSyncedRef.current = current;
    onClipUpdate();

    // Show "Saved" briefly
    setShowSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
  }, [activeClipId, name, duration, order, prompt, playbackSpeed, updateClip, onClipUpdate]);

  // Debounced sync - trigger on value changes
  useEffect(() => {
    if (!activeClipId) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce context update by 500ms
    debounceTimerRef.current = setTimeout(syncToContext, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activeClipId, name, duration, order, prompt, playbackSpeed]); // Note: syncToContext NOT in deps

  // Flush on unmount using refs (not stale closure)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);

        // Flush immediately using refs for latest values
        const clipId = activeClipIdRef.current;
        if (clipId) {
          const current = currentValuesRef.current;
          const last = lastSyncedRef.current;

          if (current.name !== last.name ||
              current.duration !== last.duration ||
              current.order !== last.order ||
              current.prompt !== last.prompt ||
              current.playbackSpeed !== last.playbackSpeed) {
            updateClipRef.current(clipId, current);
            onClipUpdateRef.current();
          }
        }
      }
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

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
        <label htmlFor="clip-speed" className="block text-sm font-medium text-gray-300 mb-1">
          Playback Speed (Multiplier)
        </label>
        <div className="flex items-center space-x-2">
          <input
            id="clip-speed"
            type="number"
            min="0.1"
            max="5.0"
            step="0.1"
            className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white"
            value={playbackSpeed}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setPlaybackSpeed(isNaN(val) ? 1.0 : val);
            }}
          />
          <span className="text-gray-400 text-sm whitespace-nowrap w-8">
            {playbackSpeed}x
          </span>
        </div>
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

      {/* Saved indicator */}
      {showSaved && (
        <div className="text-xs text-green-400 flex items-center transition-opacity">
          <svg className="h-3 w-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          Saved
        </div>
      )}
    </div>
  );
};

export default ClipEditor;
