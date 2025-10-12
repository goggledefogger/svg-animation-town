import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import AIProviderSelector from './AIProviderSelector';
import { useAnimation } from '../contexts/AnimationContext';
import type { AIProviderId } from '@/types/ai';

interface ProviderSelection {
  provider: AIProviderId;
  model: string;
}

interface StoryboardGeneratorModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onGenerate: (prompt: string, selection: ProviderSelection, numScenes?: number) => void;
  isLoading: boolean;
}

const SCENE_OPTIONS: Array<'auto' | number> = ['auto', 3, 4, 5, 6, 7];

const StoryboardGeneratorModal: React.FC<StoryboardGeneratorModalProps> = ({
  isOpen,
  onCancel,
  onGenerate,
  isLoading
}) => {
  const { aiProvider, aiModel } = useAnimation();
  const [prompt, setPrompt] = useState('');
  const [numScenes, setNumScenes] = useState<'auto' | number>('auto');

  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      setNumScenes('auto');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) {
      return;
    }

    onGenerate(
      prompt.trim(),
      { provider: aiProvider, model: aiModel },
      numScenes === 'auto' ? undefined : numScenes
    );
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-gray-900 border border-gray-700 shadow-xl">
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Generate Storyboard</h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-200 focus:outline-none"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <label htmlFor="storyboard-prompt" className="text-sm font-medium text-gray-300">
              Describe your movie idea
            </label>
            <textarea
              id="storyboard-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-700 bg-gray-800 p-3 text-sm text-white placeholder-gray-500 focus:border-bat-yellow focus:outline-none focus:ring-1 focus:ring-bat-yellow"
              placeholder="A neon-lit cyberpunk chase through towering cityscapes..."
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-3">
            <span className="text-sm font-medium text-gray-300">AI Provider & Model</span>
            <AIProviderSelector />
          </div>

          <div className="space-y-2">
            <label htmlFor="scene-count" className="text-sm font-medium text-gray-300">
              Number of scenes
            </label>
            <select
              id="scene-count"
              value={numScenes}
              onChange={(e) => {
                const value = e.target.value;
                setNumScenes(value === 'auto' ? 'auto' : Number(value));
              }}
              className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-sm text-white focus:border-bat-yellow focus:outline-none focus:ring-1 focus:ring-bat-yellow"
              disabled={isLoading}
            >
              {SCENE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option === 'auto' ? 'Auto (3-7 scenes)' : `${option} scenes`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-gray-500"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-bat-yellow px-4 py-2 text-sm font-semibold text-black hover:bg-[#ffd42a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-bat-yellow disabled:opacity-70"
              disabled={isLoading}
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root') || document.body;
  return ReactDOM.createPortal(modalContent, modalRoot);
};

export default StoryboardGeneratorModal;
