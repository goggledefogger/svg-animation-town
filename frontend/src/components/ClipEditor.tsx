import React, { useState, useEffect } from 'react';
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
  const [isDirty, setIsDirty] = useState(false);

  // Load clip data when active clip changes
  useEffect(() => {
    if (activeClipId) {
      const clip = getActiveClip();
      if (clip) {
        setName(clip.name);
        setDuration(clip.duration || 5);
        setOrder(clip.order);
        setPrompt(clip.prompt || '');
        setIsDirty(false);
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

    setIsDirty(false);
    onClipUpdate();
  };

  const handleInputChange = (setter: Function, value: any) => {
    setter(value);
    setIsDirty(true);
  };

  // Navigate to animation editor with stored prompt
  const navigateToAnimationEditor = () => {
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
    } else if (activeClip.svgContent) {
      sessionStorage.setItem('clip_svg_content', activeClip.svgContent);
      sessionStorage.setItem('editing_from_movie', 'true');
      if (activeClip.provider) {
        sessionStorage.setItem('animation_provider', activeClip.provider);
      }
    }

    navigate('/animation-editor');
  };

  // If no clip is selected, show a placeholder
  if (!activeClipId) {
    return (
      <div className="flex items-center justify-center h-full p-3">
        <div className="text-gray-400 text-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <p className="text-sm font-medium">Select a clip to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex-1 overflow-y-auto px-3 pt-3 flex flex-col gap-3 min-h-0">
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-3 flex-shrink-0">
          <div>
            <label htmlFor="clip-name" className="block text-xs font-medium mb-1 text-gray-400">
              Clip Name
            </label>
            <input
              id="clip-name"
              type="text"
              className="w-full px-2.5 py-1.5 bg-gray-700 rounded border border-gray-600 text-white 
                       focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              value={name}
              onChange={(e) => handleInputChange(setName, e.target.value)}
              placeholder="Enter clip name"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label htmlFor="clip-duration" className="block text-xs font-medium mb-1 text-gray-400">
                Duration (sec)
              </label>
              <input
                id="clip-duration"
                type="number"
                min="0.5"
                step="0.5"
                className="w-full px-2.5 py-1.5 bg-gray-700 rounded border border-gray-600 text-white 
                         focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={duration}
                onChange={(e) => handleInputChange(setDuration, parseFloat(e.target.value))}
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="clip-order" className="block text-xs font-medium mb-1 text-gray-400">
                Order
              </label>
              <input
                id="clip-order"
                type="number"
                min="0"
                step="1"
                className="w-full px-2.5 py-1.5 bg-gray-700 rounded border border-gray-600 text-white 
                         focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                value={order}
                onChange={(e) => handleInputChange(setOrder, parseInt(e.target.value, 10))}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col flex-1">
          <label htmlFor="clip-prompt" className="block text-xs font-medium mb-1 text-gray-400 flex-shrink-0">
            Scene Prompt
          </label>
          <textarea
            id="clip-prompt"
            className="flex-1 w-full px-2.5 py-1.5 bg-gray-700 rounded border border-gray-600 text-gray-300 
                     resize-none cursor-not-allowed focus:outline-none text-sm min-h-[80px]"
            value={prompt}
            onChange={(e) => handleInputChange(setPrompt, e.target.value)}
            placeholder="No prompt saved for this clip"
            readOnly
            disabled
          />
          
          <button
            onClick={navigateToAnimationEditor}
            disabled={!prompt}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 
                    text-white text-sm py-1.5 rounded mt-2 focus:outline-none font-medium transition-colors flex 
                    items-center justify-center gap-1.5 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>Edit in Animation Editor</span>
          </button>
        </div>
      </div>

      <div className="border-t border-gray-700 px-3 py-2 bg-gray-900 flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 
                   text-white text-sm py-1.5 rounded focus:outline-none font-medium transition-colors flex 
                   items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{isDirty ? 'Save Changes' : 'No Changes to Save'}</span>
        </button>
      </div>
    </div>
  );
};

export default ClipEditor;
