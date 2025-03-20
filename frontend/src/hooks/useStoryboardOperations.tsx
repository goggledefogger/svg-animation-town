import { useState, useCallback } from 'react';
import { useMovie } from '../contexts/MovieContext';
import { MovieStorageApi } from '../services/api';

/**
 * Hook for managing storyboard operations like saving, renaming, and exporting
 */
export function useStoryboardOperations(showToastNotification: (message: string, type?: 'success' | 'error' | 'info') => void) {
  const {
    currentStoryboard,
    saveStoryboard,
    exportStoryboard,
    setCurrentStoryboard,
    renameStoryboard
  } = useMovie();

  const [storyboardName, setStoryboardName] = useState(currentStoryboard.name);
  const [loadModalRefreshTrigger, setLoadModalRefreshTrigger] = useState(0);

  // Keep storyboardName in sync with currentStoryboard.name
  useState(() => {
    setStoryboardName(currentStoryboard.name);
  });

  /**
   * Handles renaming the storyboard and saving to server
   */
  const handleRename = async () => {
    try {
      // Create an updated storyboard object with the new name
      const updatedStoryboard = {
        ...currentStoryboard,
        name: storyboardName,
        updatedAt: new Date()
      };

      // Save directly to API to ensure consistent server state
      try {
        const result = await MovieStorageApi.saveMovie(updatedStoryboard);

        // Update the state after the save completes successfully
        setCurrentStoryboard(updatedStoryboard);

        // Also update the context
        renameStoryboard(storyboardName);
      } catch (serverError) {
        console.error('Error saving renamed storyboard to server:', serverError);
        throw serverError; // Rethrow to be caught by outer catch
      }

      // Increment refresh trigger to reload storyboards in load modal
      setLoadModalRefreshTrigger(prev => prev + 1);

      // Show success toast
      showToastNotification('Storyboard renamed successfully!');

      return true;
    } catch (error) {
      console.error('Error renaming storyboard:', error);
      showToastNotification('Failed to rename storyboard', 'error');
      return false;
    }
  };

  /**
   * Save a storyboard with the provided name
   */
  const handleSaveWithName = async () => {
    try {
      // Create an updated storyboard object with the new name
      const updatedStoryboard = {
        ...currentStoryboard,
        name: storyboardName,
        updatedAt: new Date()
      };

      // Save directly to API to ensure consistent server state
      try {
        const result = await MovieStorageApi.saveMovie(updatedStoryboard);

        // Update the state after the save completes successfully
        setCurrentStoryboard(updatedStoryboard);

        // Also update the context
        renameStoryboard(storyboardName);
      } catch (serverError) {
        console.error('Error saving storyboard to server:', serverError);
        throw serverError; // Rethrow to be caught by outer catch
      }

      // Increment refresh trigger to reload storyboards in load modal
      setLoadModalRefreshTrigger(prev => prev + 1);

      // Show success toast
      showToastNotification('Storyboard saved successfully!');

      return true;
    } catch (error) {
      console.error('Error saving storyboard:', error);
      showToastNotification('Failed to save storyboard', 'error');
      return false;
    }
  };

  /**
   * Save the current storyboard
   */
  const handleSave = async () => {
    try {
      // If this is a new storyboard with default name, use the named save flow
      if (currentStoryboard.name === 'New Movie' || !currentStoryboard.name) {
        return null; // Signal that we should show the save modal
      }

      await saveStoryboard();

      // Increment refresh trigger to reload storyboards in load modal
      setLoadModalRefreshTrigger(prev => prev + 1);

      // Show success toast
      showToastNotification('Storyboard saved successfully!');

      return true;
    } catch (error) {
      console.error('Error saving storyboard:', error);
      showToastNotification('Failed to save storyboard', 'error');
      return false;
    }
  };

  /**
   * Export the storyboard in the specified format
   */
  const handleExport = (format: 'json' | 'svg') => {
    try {
      exportStoryboard(format);
      showToastNotification(`Storyboard exported as ${format.toUpperCase()} successfully!`);
      return true;
    } catch (error) {
      console.error('Error exporting storyboard:', error);
      showToastNotification('Failed to export storyboard', 'error');
      return false;
    }
  };

  /**
   * Reset the application state
   */
  const resetApplication = useCallback(() => {
    // Function defined but left for implementation in MovieEditorPage
    // as it requires createNewStoryboard from useMovie context
  }, []);

  return {
    storyboardName,
    setStoryboardName,
    loadModalRefreshTrigger,
    setLoadModalRefreshTrigger,
    handleRename,
    handleSaveWithName,
    handleSave,
    handleExport,
    resetApplication
  };
}
