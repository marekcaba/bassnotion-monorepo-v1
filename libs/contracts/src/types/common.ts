export interface MetronomeSettings {
  enabled: boolean;
  tempo: number;
  beatsPerMeasure: number;
  subdivision: number;
  accentFirstBeat: boolean;
  volume: number;
}

export enum TokenStatus {
  AVAILABLE = 'available',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
}

export interface TokenInfo {
  id: string;
  userId: string;
  status: TokenStatus;
  createdAt: string;
  consumedAt?: string;
}
