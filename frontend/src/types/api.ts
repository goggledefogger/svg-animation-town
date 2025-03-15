/**
 * API response interface
 */
export interface ApiResponse {
  success: boolean;
  message: string;
  svg?: string;
  elements?: any[];
}

/**
 * API error interface
 */
export interface ApiError {
  success: false;
  message: string;
  error?: string;
  status?: number;
}
