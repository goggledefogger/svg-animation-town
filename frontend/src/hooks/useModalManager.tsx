import { useState } from 'react';

/**
 * Hook for managing the visibility of different modals in the application
 */
export function useModalManager() {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showStoryboardGeneratorModal, setShowStoryboardGeneratorModal] = useState(false);
  const [showGeneratingClipsModal, setShowGeneratingClipsModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showMobileClipEditor, setShowMobileClipEditor] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
  const [storyboardToDelete, setStoryboardToDelete] = useState<string | null>(null);

  // Toast notification management
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  // Show toast notification helper
  const showToastNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  return {
    // Modal states
    showSaveModal,
    setShowSaveModal,
    showExportModal,
    setShowExportModal,
    showRenameModal,
    setShowRenameModal,
    showStoryboardGeneratorModal,
    setShowStoryboardGeneratorModal,
    showGeneratingClipsModal,
    setShowGeneratingClipsModal,
    showErrorModal,
    setShowErrorModal,
    showLoadModal,
    setShowLoadModal,
    showMobileClipEditor,
    setShowMobileClipEditor,
    showDeleteConfirmation,
    setShowDeleteConfirmation,
    showConfirmationModal,
    setShowConfirmationModal,
    showDeleteConfirmationModal,
    setShowDeleteConfirmationModal,
    storyboardToDelete,
    setStoryboardToDelete,

    // Toast states and function
    showToast,
    setShowToast,
    toastMessage,
    toastType,
    showToastNotification
  };
}
