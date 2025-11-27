import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// 认证文件路径
const AUTH_FILE_PATH = join(process.cwd(), '.wechat-auth.json');

export interface AuthFileData {
  token?: string;
  cookies?: string;
  updatedAt?: string;
}

/**
 * 读取认证文件
 */
export function readAuthFile(): AuthFileData | null {
  try {
    if (existsSync(AUTH_FILE_PATH)) {
      const content = readFileSync(AUTH_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('读取认证文件失败:', error);
  }
  return null;
}

/**
 * 写入认证文件
 */
export function writeAuthFile(authData: AuthFileData): boolean {
  try {
    const dataWithTimestamp = {
      ...authData,
      updatedAt: new Date().toISOString()
    };
    writeFileSync(AUTH_FILE_PATH, JSON.stringify(dataWithTimestamp, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('写入认证文件失败:', error);
    return false;
  }
}

/**
 * 从文件获取认证信息
 */
export function getAuthFromFile(): { token: string | null; cookies: string | null } {
  const authData = readAuthFile();
  return {
    token: authData?.token || null,
    cookies: authData?.cookies || null
  };
}

/**
 * 保存认证信息到文件
 */
export function saveAuthToFile(token: string, cookies: string): boolean {
  return writeAuthFile({ token, cookies });
}

/**
 * 清除认证文件
 */
export function clearAuthFile(): boolean {
  try {
    if (existsSync(AUTH_FILE_PATH)) {
      writeFileSync(AUTH_FILE_PATH, JSON.stringify({}, null, 2), 'utf-8');
    }
    return true;
  } catch (error) {
    console.error('清除认证文件失败:', error);
    return false;
  }
}

/**
 * 检查认证文件是否存在
 */
export function hasAuthFile(): boolean {
  return existsSync(AUTH_FILE_PATH);
}

/**
 * 获取认证文件路径
 */
export function getAuthFilePath(): string {
  return AUTH_FILE_PATH;
}

/**
 * 自动保存认证信息（在登录成功后调用）
 */
export function autoSaveAuthInfo(token: string, cookies: string): boolean {
  console.log('自动保存认证信息到文件:', AUTH_FILE_PATH);
  return saveAuthToFile(token, cookies);
}

/**
 * 检查认证文件是否有效
 */
export function isAuthFileValid(): boolean {
  const authData = readAuthFile();
  return !!(authData?.token && authData?.cookies);
}
