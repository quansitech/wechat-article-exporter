import { mockConfig } from '~/config/mock';
import { getAuthFromFile, saveAuthToFile } from '~/server/utils/auth-file';
import type { AuthStatus, IAuthProvider } from '../types/auth';

const EXPIRED_MESSAGE = '认证已过期';

export class FileAuthProvider implements IAuthProvider {
  private status: AuthStatus = {
    valid: false,
    lastCheckedAt: null,
    expiredAt: null,
  };

  async getToken(): Promise<string | null> {
    return getAuthFromFile().token;
  }

  async getCookies(): Promise<string | null> {
    return getAuthFromFile().cookies;
  }

  async isValid(): Promise<boolean> {
    if (mockConfig.enabled) {
      this.status = {
        valid: true,
        lastCheckedAt: new Date(),
        expiredAt: null,
      };
      return true;
    }

    const auth = getAuthFromFile();
    const valid = !!(auth.token && auth.cookies);
    this.status = {
      valid,
      lastCheckedAt: new Date(),
      expiredAt: valid ? null : new Date(),
      message: valid ? undefined : EXPIRED_MESSAGE,
    };
    return valid;
  }

  async update(token: string, cookies: string): Promise<void> {
    const saved = saveAuthToFile(token, cookies);
    if (!saved) {
      throw new Error('认证信息写入失败');
    }

    this.status = {
      valid: true,
      lastCheckedAt: new Date(),
      expiredAt: null,
    };
  }

  getStatus(): AuthStatus {
    return { ...this.status };
  }
}

export const authProvider = new FileAuthProvider();
