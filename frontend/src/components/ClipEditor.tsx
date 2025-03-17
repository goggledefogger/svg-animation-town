import React, { useState, useEffect } from 'react';
import { useMovie } from '../contexts/MovieContext';

interface ClipEditorProps {
  onClipUpdate: () => void;
}

const ClipEditor: React.FC<ClipEditorProps> = ({ onClipUpdate }) => {
  const { activeClipId, getActiveClip, updateClip } = useMovie();

  // Form state
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(5);
  const [order, setOrder] = useState(0);

  // Load clip data when active clip changes
  useEffect(() => {
    if (activeClipId) {
      const clip = getActiveClip();
      if (clip) {
        setName(clip.name);
        setDuration(clip.duration || 5);
        setOrder(clip.order);
      }
    }
  }, [activeClipId, getActiveClip]);

  // Save changes to the active clip
  const handleSave = () => {
    if (!activeClipId) return;

    updateClip(activeClipId, {
      name,
      duration,
      order
    });

    onClipUpdate();
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
