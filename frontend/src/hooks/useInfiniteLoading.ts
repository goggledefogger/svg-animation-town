import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface InfiniteLoadingOptions<T, ID> {
  // Function to fetch all available IDs
  fetchIds: () => Promise<ID[]>;
  // Function to fetch a single item by its ID
  fetchItem: (id: ID) => Promise<T | null>;
  // How many items to load per page
  pageSize?: number;
  // Whether to enable the infinite loading
  enabled?: boolean;
  // Initial search filter function
  initialFilter?: ((item: T) => boolean) | boolean;
}

interface InfiniteLoadingResult<T, ID> {
  // All loaded items
  items: T[];
  // Filtered items (if a filter is applied)
  filteredItems: T[];
  // Whether initial loading is in progress
  isLoading: boolean;
  // Whether more items are being loaded
  isLoadingMore: boolean;
  // Whether there are more items to load
  hasMore: boolean;
  // Error message if any
  error: string | null;
  // Function to manually trigger loading the next page
  loadNextPage: () => Promise<void>;
  // Function to apply a search filter
  filterItems: (filterFn: ((item: T) => boolean) | boolean) => void;
  // Function to reset the items and start fresh
  reset: () => void;
  // Ref callback for the last item (for intersection observer)
  lastItemRef: (node: HTMLElement | null) => void;
  // All IDs that haven't been loaded yet
  remainingIds: ID[];
}

export function useInfiniteLoading<T, ID>({
  fetchIds,
  fetchItem,
  pageSize = 10,
  enabled = true,
  initialFilter = () => true,
}: InfiniteLoadingOptions<T, ID>): InfiniteLoadingResult<T, ID> {
  // State for all loaded items
  const [items, setItems] = useState<T[]>([]);
  // State for loading status
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for pagination
  const [currentPage, setCurrentPage] = useState(0);
  // State for all IDs
  const [allIds, setAllIds] = useState<ID[]>([]);
  
  // Refs for tracking state
  const fetchInProgress = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef = useRef<HTMLElement | null>(null);
  
  // State for filter function - convert boolean to function if needed
  const [filterFn, setFilterFn] = useState<(item: T) => boolean>(() => {
    if (typeof initialFilter === 'function') {
      return initialFilter;
    } else {
      return () => Boolean(initialFilter);
    }
  });

  // Initialize by fetching all IDs
  useEffect(() => {
    if (!enabled) return;
    
    let isMounted = true; // For race condition prevention
    
    const initialize = async () => {
      if (fetchInProgress.current) return;
      fetchInProgress.current = true;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch all IDs first
        const ids = await fetchIds();
        
        if (!isMounted) return;
        
        setAllIds(ids);
        
        // Load first page if there are IDs
        if (ids.length > 0) {
          await loadBatch(ids.slice(0, pageSize), 0);
          setHasMore(ids.length > pageSize);
        } else {
          setItems([]);
          setHasMore(false);
        }
      } catch (err) {
        if (!isMounted) return;
        
        console.error('Error initializing infinite loading:', err);
        setError('Failed to load items');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          fetchInProgress.current = false;
        }
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
    };
  }, [enabled, pageSize]);

  // Stable reference to loadBatch function
  const loadBatch = useCallback(async (ids: ID[], page: number) => {
    if (ids.length === 0) return;
    
    try {
      // Use Promise.all for parallel loading
      const itemPromises = ids.map(id => 
        fetchItem(id)
          .catch(err => {
            console.error(`Error fetching item ${String(id)}:`, err);
            return null;
          })
      );
      
      const batchResults = await Promise.all(itemPromises);
      const validItems = batchResults.filter(Boolean) as T[];
      
      setItems(prev => {
        const newItems = [...prev];
        
        // Remove duplicates and add new items using Map for more efficient comparison
        const existingItemsMap = new Map();
        prev.forEach((item, index) => existingItemsMap.set(item, index));
        
        validItems.forEach(item => {
          if (!existingItemsMap.has(item)) {
            newItems.push(item);
          }
        });
        
        return newItems;
      });
    } catch (error) {
      console.error('Error loading batch:', error);
      throw error;
    }
  }, [fetchItem]);

  // Load the next page of items - memoized implementation
  const loadNextPage = useCallback(async () => {
    if (isLoadingMore || !hasMore || fetchInProgress.current) return;
    
    fetchInProgress.current = true;
    setIsLoadingMore(true);
    
    try {
      const nextPage = currentPage + 1;
      const start = nextPage * pageSize;
      const end = start + pageSize;
      
      if (start < allIds.length) {
        const nextBatch = allIds.slice(start, end);
        await loadBatch(nextBatch, nextPage);
        setCurrentPage(nextPage);
        setHasMore(end < allIds.length);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more items:', err);
      setError('Failed to load more items');
    } finally {
      setIsLoadingMore(false);
      fetchInProgress.current = false;
    }
  }, [isLoadingMore, hasMore, currentPage, pageSize, allIds, loadBatch]);

  // Reset all state - stable function reference
  const reset = useCallback(() => {
    setItems([]);
    setCurrentPage(0);
    setHasMore(true);
    setIsLoading(false);
    setIsLoadingMore(false);
    setError(null);
    setAllIds([]);
    fetchInProgress.current = false;
  }, []);

  // Filter items based on a filter function - stable function reference
  const filterItems = useCallback((newFilterFn: ((item: T) => boolean) | boolean) => {
    if (typeof newFilterFn === 'function') {
      setFilterFn(() => newFilterFn as (item: T) => boolean);
    } else {
      // If a boolean is passed, use a function that returns that boolean for all items
      setFilterFn(() => () => Boolean(newFilterFn));
    }
  }, []);

  // Callback ref for the last item - stable function reference
  const lastItemRefCallback = useCallback((node: HTMLElement | null) => {
    lastItemRef.current = node;
    
    if (observerRef.current) {
      observerRef.current.disconnect();
      
      if (node && hasMore) {
        observerRef.current.observe(node);
      }
    }
  }, [hasMore]);

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    if (!enabled || !hasMore) return;
    
    // Cleanup old observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadNextPage();
        }
      },
      { threshold: 0.5 }
    );
    
    // Observe the last item if it exists
    if (lastItemRef.current) {
      observerRef.current.observe(lastItemRef.current);
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [enabled, hasMore, isLoadingMore, isLoading, loadNextPage]);

  // Apply the filter function to get filtered items - memoized result
  const filteredItems = useMemo(() => {
    if (typeof filterFn !== 'function') {
      return items;
    }
    try {
      return items.filter(filterFn);
    } catch (err) {
      console.error('Error filtering items:', err);
      return items;
    }
  }, [items, filterFn]);

  // Calculate remaining IDs - memoized result
  const remainingIds = useMemo(() => {
    return allIds.slice((currentPage + 1) * pageSize);
  }, [allIds, currentPage, pageSize]);

  return {
    items,
    filteredItems,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadNextPage,
    filterItems,
    reset,
    lastItemRef: lastItemRefCallback,
    remainingIds
  };
} 