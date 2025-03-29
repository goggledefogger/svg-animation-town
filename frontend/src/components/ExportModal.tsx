import React, { useState, KeyboardEvent, useEffect } from 'react';
import { canExportAsSvg } from '../utils/exportUtils';
import { useViewerPreferences } from '../contexts/ViewerPreferencesContext';

interface ExportModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onExport: (filename: string, format: 'svg' | 'json', includeBackground?: boolean) => void;
  svgContent: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onCancel,
  onExport,
  svgContent
}) => {
  const [filename, setFilename] = useState('animation');
  const [format, setFormat] = useState<'svg' | 'json'>('svg');
  const [includeBackground, setIncludeBackground] = useState(true);
  const { currentBackground } = useViewerPreferences();

  // Check if SVG can be exported with animations
  const canExportSvg = canExportAsSvg(svgContent);

  // If we can't export as SVG, default to JSON
  useEffect(() => {
    if (!canExportSvg) {
      setFormat('json');
    }
  }, [canExportSvg]);

  const handleExport = () => {
    if (filename.trim()) {
      onExport(filename.trim(), format, format === 'svg' ? includeBackground : undefined);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filename.trim()) {
      handleExport();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/50">
      <div className="bg-gray-800 rounded-lg p-4 sm:p-5 w-full max-w-sm sm:max-w-md mx-auto my-auto">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-white">Export Animation</h2>

        <div className="mb-3 sm:mb-4">
          <label htmlFor="filename" className="block text-gray-300 mb-1 text-sm sm:text-base">
            Filename
          </label>
          <input
            type="text"
            id="filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-bat-yellow text-sm sm:text-base"
            autoFocus
          />
        </div>

        <div className="mb-3 sm:mb-4">
          <label className="block text-gray-300 mb-1 text-sm sm:text-base">
            Format
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="svg"
                checked={format === 'svg'}
                onChange={() => setFormat('svg')}
                disabled={!canExportSvg}
                className="form-radio text-bat-yellow focus:ring-bat-yellow h-4 w-4"
              />
              <span className={`ml-2 text-sm sm:text-base ${!canExportSvg ? 'text-gray-500' : 'text-white'}`}>SVG</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="json"
                checked={format === 'json'}
                onChange={() => setFormat('json')}
                className="form-radio text-bat-yellow focus:ring-bat-yellow h-4 w-4"
              />
              <span className="ml-2 text-sm sm:text-base text-white">JSON</span>
            </label>
          </div>
          {!canExportSvg && format === 'svg' && (
            <p className="text-yellow-400 text-xs mt-1">
              This animation may not support direct SVG export with animations.
            </p>
          )}
        </div>

        {format === 'svg' && (
          <div className="mb-3 sm:mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeBackground}
                onChange={() => setIncludeBackground(!includeBackground)}
                className="form-checkbox text-bat-yellow focus:ring-bat-yellow h-4 w-4"
              />
              <span className="ml-2 text-sm sm:text-base text-white">Include {currentBackground.isDark ? 'dark' : 'light'} background</span>
            </label>
            <p className="text-gray-400 text-xs mt-1">
              This will embed the current background color in the SVG file.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 sm:gap-3 mt-4 sm:mt-5">
          <button
            onClick={onCancel}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base bg-bat-yellow hover:bg-bat-yellow/90 text-black rounded"
            disabled={!filename.trim()}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
