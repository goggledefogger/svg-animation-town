import React, { useState, useEffect, useCallback } from 'react';
import { useMovie } from '../contexts/MovieContext';
import { useNavigate } from 'react-router-dom';
import { addDurationGuidance } from '../utils/animationUtils';

interface ClipEditorProps {
  onClipUpdate: () => void;
}

const ClipEditor: React.FC<ClipEditorProps> = ({ onClipUpdate }) => {
  const { activeClipId, getActiveClip, updateClip } = useMovie();
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(5);
  const [order, setOrder] = useState(0);
  const [prompt, setPrompt] = useState('');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load clip data when active clip changes
  useEffect(() => {
    if (activeClipId) {
      const clip = getActiveClip();
      if (clip) {
        setName(clip.name);
        setDuration(clip.duration || 5);
        setOrder(clip.order);
        setPrompt(clip.prompt || '');
        setSaveStatus('idle'); // Reset status on clip switch
      }
    }
  }, [activeClipId, getActiveClip]);

  // Check if form is dirty
  const isDirty = (() => {
    if (!activeClipId) return false;
    const clip = getActiveClip();
    if (!clip) return false;

    return (
      name !== clip.name ||
      duration !== (clip.duration || 5) ||
      order !== clip.order
    );
  })();

  // Save changes to the active clip (now private for auto-save)
  const performSave = useCallback(() => {
    if (!activeClipId || !isDirty) return;

    updateClip(activeClipId, {
      name,
      duration,
      order,
      prompt
    });

    onClipUpdate();
  }, [activeClipId, isDirty, name, duration, order, prompt, updateClip, onClipUpdate]);

  // Auto-save effect
  useEffect(() => {
    if (!isDirty) return;

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      performSave();
      setSaveStatus('saved');
    }, 1000);

    return () => clearTimeout(timer);
  }, [isDirty, performSave]);

  // Navigate to animation editor with stored prompt
  const navigateToAnimationEditor = () => {
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
  };

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
