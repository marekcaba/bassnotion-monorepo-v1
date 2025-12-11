import { apiClient } from '@/lib/api-client';

export interface Pattern {
  id: string;
  type: 'drums' | 'harmony';
  name: string;
  slug: string;
  genre?: string;
  timeSignature: string;
  bars: number;
  midiFileUrl: string;
  midiFilePath: string;
  fileSizeBytes?: number;
  durationMs?: number;
  previewUrl?: string;
  description?: string;
  tags: string[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

export interface TutorialPatternResponse {
  config: {
    tutorialId: string;
    defaultDrumPattern: Pattern | null;
    defaultHarmonyPattern: Pattern | null;
    allowPatternSwitching: boolean;
  };
  userSelection: {
    drumPattern: Pattern | null;
    harmonyPattern: Pattern | null;
  } | null;
  availablePatterns: {
    drums: Pattern[];
    harmony: Pattern[];
  };
}

class PatternRepository {
  private baseUrl = '/api/v1/patterns';

  async getAllPatterns(type?: 'drums' | 'harmony'): Promise<Pattern[]> {
    const params = type ? `?type=${type}` : '';
    const response = await apiClient.get<Pattern[]>(`${this.baseUrl}${params}`);
    return response.data;
  }

  async getPopularPatterns(type?: 'drums' | 'harmony'): Promise<Pattern[]> {
    const params = type ? `?type=${type}` : '';
    const response = await apiClient.get<Pattern[]>(
      `${this.baseUrl}/popular${params}`,
    );
    return response.data;
  }

  async getPatternsByGenre(
    genre: string,
    type?: 'drums' | 'harmony',
  ): Promise<Pattern[]> {
    const params = type ? `?type=${type}` : '';
    const response = await apiClient.get<Pattern[]>(
      `${this.baseUrl}/genre/${genre}${params}`,
    );
    return response.data;
  }

  async getPatternById(id: string): Promise<Pattern> {
    const response = await apiClient.get<Pattern>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async getPatternBySlug(slug: string): Promise<Pattern> {
    const response = await apiClient.get<Pattern>(
      `${this.baseUrl}/slug/${slug}`,
    );
    return response.data;
  }

  async getTutorialPatterns(
    tutorialId: string,
  ): Promise<TutorialPatternResponse> {
    // Return empty mock data since pattern backend module is not available
    return {
      config: {
        tutorialId,
        defaultDrumPattern: null,
        defaultHarmonyPattern: null,
        allowPatternSwitching: false,
      },
      userSelection: null,
      availablePatterns: {
        drums: [],
        harmony: [],
      },
    };
  }

  async saveUserSelection(
    tutorialId: string,
    selection: {
      drumPatternId?: string;
      harmonyPatternId?: string;
    },
  ): Promise<void> {
    // Mock implementation - do nothing since backend module is not available
    console.log('Pattern selection saved locally:', { tutorialId, selection });
    return Promise.resolve();
  }

  async getCompatiblePatterns(
    patternId: string,
    type: 'drums' | 'harmony',
  ): Promise<Pattern[]> {
    const response = await apiClient.get<Pattern[]>(
      `${this.baseUrl}/compatible/${patternId}?type=${type}`,
    );
    return response.data;
  }
}

export const patternApi = new PatternRepository();
