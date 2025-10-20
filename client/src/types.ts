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
  createdAt: string;
  updatedAt?: string;
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

