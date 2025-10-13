// TypeScript types for Scavenger Hunt Map App

export interface Hotspot {
  id: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  prize: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
  imageUrl: string | null;
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

