// TypeScript types for Scavenger Hunt Map App

export interface Hotspot {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  prize: number | null; // Prize amount in SOL
  startDate: string;
  endDate: string;
  active: boolean;
  imageUrl: string | null;
  privateKey?: string | null;
  claimStatus?: string;
  claimedBy?: string | null;
  claimedAt?: string | null;
  tweetUrl?: string | null;
  queuePosition?: number;
  locationName?: string | null;
  // Hint system fields
  hint1?: string | null;
  hint2?: string | null;
  hint3?: string | null;
  hint1PriceUsd?: number | null;
  hint2PriceUsd?: number | null;
  hint3PriceUsd?: number | null;
  firstHintFree?: boolean;
  createdAt: string;
  updatedAt?: string;
  // Automated prize wallet + funding (backend fields)
  prizePublicKey?: string | null;
  fundStatus?: 'pending' | 'success' | 'failed' | 'skipped';
  fundTxSig?: string | null;
}

export interface LoginResponse {
  token: string;
  username: string;
}

export interface AdminLog {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  details: string | null;
  timestamp: string;
}

