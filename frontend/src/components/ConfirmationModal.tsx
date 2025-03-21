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
      <div className="bg-gotham-blue border border-gray-700 rounded-lg shadow-lg max-w-md w-full animate-fade-in">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-medium text-white">{title}</h2>
        </div>
        <div className="p-4">
          {typeof message === 'string' ? <p className="text-gray-300">{message}</p> : message}
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end space-x-3">
          {showCancelButton && (
            <button
              className="btn btn-outline"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button
            className="btn btn-primary"
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
