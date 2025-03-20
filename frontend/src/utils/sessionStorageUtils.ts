/**
 * Utility functions for working with sessionStorage
 */

/**
 * Keys used in session storage
 */
export const SESSION_STORAGE_KEYS = {
  PENDING_ANIMATION_ID: 'pending_animation_id',
  PENDING_ANIMATION_NAME: 'pending_animation_name',
  CURRENT_ANIMATION_STATE: 'current_animation_state',
  PAGE_JUST_LOADED: 'page_just_loaded',
  FORCE_SERVER_REFRESH: 'force_server_refresh',
  PENDING_CLIP_NAME: 'pending_clip_name'
};

/**
 * Clears cache keys to force server refresh
 */
export function clearCacheForServerRefresh(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.CURRENT_ANIMATION_STATE);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.PAGE_JUST_LOADED);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.FORCE_SERVER_REFRESH, 'true');
}

/**
 * Gets pending animation data from session storage
 * @returns Object containing id and name if available, null otherwise
 */
export function getPendingAnimation(): { id: string; name: string } | null {
  const id = sessionStorage.getItem(SESSION_STORAGE_KEYS.PENDING_ANIMATION_ID);
  const name = sessionStorage.getItem(SESSION_STORAGE_KEYS.PENDING_ANIMATION_NAME);

  if (id && name) {
    return { id, name };
  }

  return null;
}

/**
 * Clears pending animation data from session storage
 */
export function clearPendingAnimation(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.PENDING_ANIMATION_ID);
  sessionStorage.removeItem(SESSION_STORAGE_KEYS.PENDING_ANIMATION_NAME);
}

/**
 * Sets pending animation data in session storage
 * @param id Animation ID
 * @param name Animation name
 */
export function setPendingAnimation(id: string, name: string): void {
  sessionStorage.setItem(SESSION_STORAGE_KEYS.PENDING_ANIMATION_ID, id);
  sessionStorage.setItem(SESSION_STORAGE_KEYS.PENDING_ANIMATION_NAME, name);
}

/**
 * Sets pending clip name in local storage
 * @param name Clip name
 */
export function setPendingClipName(name: string): void {
  localStorage.setItem(SESSION_STORAGE_KEYS.PENDING_CLIP_NAME, name);
}
