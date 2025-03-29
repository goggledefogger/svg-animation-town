import React, { ReactNode } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  showSpinner?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  showSpinner = false
}) => {
  if (!isOpen) return null;

  // Determine if we should show the cancel button
  const showCancelButton = cancelText !== undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 w-11/12 max-w-md shadow-xl overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium text-white">{title}</h2>
        </div>
        <div className="mb-4">
          {typeof message === 'string' ? <p className="text-gray-300">{message}</p> : message}
        </div>
        <div className="flex justify-end space-x-3">
          {showCancelButton && (
            <button
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button
            className="px-4 py-2 bg-bat-yellow hover:bg-bat-yellow/90 disabled:bg-gray-700 disabled:text-gray-400 text-black rounded"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {showSpinner ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-transparent border-t-current border-l-current rounded-full animate-spin mr-2"></div>
                {confirmText}
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
