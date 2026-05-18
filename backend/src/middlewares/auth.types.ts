export interface UserJWTPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
  currentOrgId?: number;
  orgRole?: string;
  exp: number;
  isApiKey?: false;
}

export interface ApiKeyContext {
  userId: number;
  username: string;
  isAdmin: false;
  currentOrgId: number;
  orgRole: string;
  exp: number;
  isApiKey: true;
  permissions: string[];
}

export type AuthContext = UserJWTPayload | ApiKeyContext;
