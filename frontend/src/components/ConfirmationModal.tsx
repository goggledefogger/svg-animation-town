import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gotham-blue border border-gray-700 rounded-lg shadow-lg max-w-md w-full animate-fade-in">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-medium text-white">{title}</h2>
        </div>
        <div className="p-4">
          <p className="text-gray-300">{message}</p>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            className="btn btn-outline"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
