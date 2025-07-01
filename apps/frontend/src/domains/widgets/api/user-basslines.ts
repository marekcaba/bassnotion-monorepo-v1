import { apiClient } from '@/lib/api-client';
import type {
  SavedBassline,
  SaveBasslineRequest,
  SaveBasslineResponse,
  AutoSaveRequest,
  AutoSaveResponse,
  RenameBasslineRequest,
  DuplicateBasslineRequest,
  BasslineListFilters,
  SavedBasslinesResponse,
} from '@bassnotion/contracts';

/**
 * API client for user bassline persistence (Story 3.8)
 */
export class UserBasslinesAPI {
  private static baseUrl = '/api/user-basslines';

  /**
   * Get user's saved basslines with optional filtering
   */
  static async getUserBasslines(
    filters?: Partial<BasslineListFilters>,
  ): Promise<SavedBasslinesResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const url = params.toString()
      ? `${this.baseUrl}?${params.toString()}`
      : this.baseUrl;

    return await apiClient.get<SavedBasslinesResponse>(url);
  }

  /**
   * Get a specific bassline by ID
   */
  static async getBasslineById(basslineId: string): Promise<SavedBassline> {
    return await apiClient.get<SavedBassline>(`${this.baseUrl}/${basslineId}`);
  }

  /**
   * Save a bassline
   */
  static async saveBassline(
    request: SaveBasslineRequest,
  ): Promise<SaveBasslineResponse> {
    return await apiClient.post<SaveBasslineResponse>(this.baseUrl, request);
  }

  /**
   * Auto-save a bassline
   */
  static async autoSave(request: AutoSaveRequest): Promise<AutoSaveResponse> {
    return await apiClient.post<AutoSaveResponse>(
      `${this.baseUrl}/auto-save`,
      request,
    );
  }

  /**
   * Rename a bassline
   */
  static async renameBassline(
    basslineId: string,
    request: RenameBasslineRequest,
  ): Promise<SavedBassline> {
    return await apiClient.put<SavedBassline>(
      `${this.baseUrl}/${basslineId}/rename`,
      request,
    );
  }

  /**
   * Duplicate a bassline
   */
  static async duplicateBassline(
    basslineId: string,
    request: DuplicateBasslineRequest,
  ): Promise<SavedBassline> {
    return await apiClient.post<SavedBassline>(
      `${this.baseUrl}/${basslineId}/duplicate`,
      request,
    );
  }

  /**
   * Delete a bassline
   */
  static async deleteBassline(basslineId: string): Promise<void> {
    await apiClient.delete<void>(`${this.baseUrl}/${basslineId}`);
  }
}
