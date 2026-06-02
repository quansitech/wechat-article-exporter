export interface AuthStatus {
  valid: boolean;
  lastCheckedAt: Date | null;
  expiredAt: Date | null;
  message?: string;
}

export interface IAuthProvider {
  getToken(): Promise<string | null>;
  getCookies(): Promise<string | null>;
  isValid(): Promise<boolean>;
  update(token: string, cookies: string): Promise<void>;
  getStatus(): AuthStatus;
}
