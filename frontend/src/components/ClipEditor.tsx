import React, { useState, useEffect } from 'react';
import { useMovie } from '../contexts/MovieContext';
import { useNavigate } from 'react-router-dom';

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

  // Load clip data when active clip changes
  useEffect(() => {
    if (activeClipId) {
      const clip = getActiveClip();
      if (clip) {
        setName(clip.name);
        setDuration(clip.duration || 5);
        setOrder(clip.order);
        setPrompt(clip.prompt || '');
      }
    }
  }, [activeClipId, getActiveClip]);

  // Save changes to the active clip
  const handleSave = () => {
    if (!activeClipId) return;

    updateClip(activeClipId, {
      name,
      duration,
      order,
      prompt
    });

    onClipUpdate();
  };

  // Navigate to animation editor with stored prompt
  const navigateToAnimationEditor = () => {
    if (!activeClipId) return;

    const activeClip = getActiveClip();
    if (!activeClip) return;

    // Store prompt and clip ID for animation editor to use
    sessionStorage.setItem('pending_prompt', activeClip.prompt || 'Create an animation');
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
    } else if (activeClip.svgContent) {
      // If there's no animation ID but we have SVG content, store it directly
      sessionStorage.setItem('clip_svg_content', activeClip.svgContent);
      // Important: Flag that we're editing a clip from the movie editor
      sessionStorage.setItem('editing_from_movie', 'true');

      // If the clip has a provider setting, also pass that
      if (activeClip.provider) {
        sessionStorage.setItem('animation_provider', activeClip.provider);
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
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Edit in Animation Editor
          </button>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          className="w-full bg-green-600 hover:bg-green-500 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-green-400"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default ClipEditor;
