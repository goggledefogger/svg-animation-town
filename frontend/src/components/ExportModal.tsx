import React, { useState, KeyboardEvent, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal';
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

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title="Export Animation"
      message={
        <div className="mt-2">
          <label htmlFor="filename" className="block text-sm font-medium text-gray-300">
            Filename
          </label>
          <input
            type="text"
            id="filename"
            className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter a filename (without extension)"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Export Format
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  id="format-svg"
                  name="format"
                  type="radio"
                  className="h-4 w-4 border-gray-600 text-blue-600 focus:ring-blue-500"
                  value="svg"
                  checked={format === 'svg'}
                  onChange={() => setFormat('svg')}
                  disabled={!canExportSvg}
                />
                <label
                  htmlFor="format-svg"
                  className={`ml-2 block text-sm ${!canExportSvg ? 'text-gray-500' : 'text-gray-300'}`}
                >
                  SVG (with animations)
                  {!canExportSvg && (
                    <span className="block text-xs text-yellow-500">
                      Not available for this animation
                    </span>
                  )}
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="format-json"
                  name="format"
                  type="radio"
                  className="h-4 w-4 border-gray-600 text-blue-600 focus:ring-blue-500"
                  value="json"
                  checked={format === 'json'}
                  onChange={() => setFormat('json')}
                />
                <label htmlFor="format-json" className="ml-2 block text-sm text-gray-300">
                  JSON (includes animation data and chat history)
                </label>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            {format === 'svg' ?
              'Exports the animation as an SVG file that can be opened in browsers or vector graphics applications.' :
              'Exports all animation data including chat history in JSON format. Use this to save a complete backup.'}
          </p>
        </div>
      }
      confirmText="Export"
      cancelText="Cancel"
      onConfirm={handleExport}
      onCancel={onCancel}
    />
  );
};

export default ExportModal;
