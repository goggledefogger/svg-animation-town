import React, { useState, KeyboardEvent, useEffect } from 'react';
import { canExportAsSvg } from '../utils/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onExport: (filename: string, format: 'svg' | 'json') => void;
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
      onExport(filename.trim(), format);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filename.trim()) {
      handleExport();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 w-11/12 max-w-md shadow-xl overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium text-white">Export Animation</h2>
        </div>

        <div className="mb-4">
          <div className="mt-2">
            <label htmlFor="filename" className="block text-sm font-medium text-gray-300 mb-1">
              Filename
            </label>
            <input
              type="text"
              id="filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:border-bat-yellow"
              placeholder="Enter filename without extension"
              autoFocus
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Format
            </label>
            <div className="flex gap-4">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="format-svg"
                  value="svg"
                  checked={format === 'svg'}
                  onChange={() => setFormat('svg')}
                  disabled={!canExportSvg}
                  className="mr-2"
                />
                <label htmlFor="format-svg" className={!canExportSvg ? "text-gray-500" : "text-gray-300"}>
                  SVG
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="radio"
                  id="format-json"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                  className="mr-2"
                />
                <label htmlFor="format-json" className="text-gray-300">
                  JSON
                </label>
              </div>
            </div>

            {!canExportSvg && format === 'json' && (
              <p className="mt-2 text-sm text-yellow-400 bg-yellow-900/20 p-2 rounded">
                This animation contains SMIL animations which may not work correctly when exported as SVG.
                JSON format is recommended.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-bat-yellow hover:bg-bat-yellow/90 disabled:bg-gray-700 disabled:text-gray-400 text-black rounded"
            onClick={handleExport}
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
