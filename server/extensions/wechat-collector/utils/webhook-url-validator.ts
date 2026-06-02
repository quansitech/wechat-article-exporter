/**
 * URL 安全验证工具
 * 防止 SSRF 攻击：仅允许 HTTPS 协议，拒绝私有/内部 IP 段
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
]);

const BLOCKED_SUFFIXES = ['.internal', '.local', '.localhost'];

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

export function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UrlValidationError(`无效的 URL: ${url}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new UrlValidationError('webhookUrl 必须使用 HTTPS 协议');
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UrlValidationError(`webhookUrl 不允许指向内部地址: ${hostname}`);
  }

  for (const suffix of BLOCKED_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      throw new UrlValidationError(`webhookUrl 不允许指向内部地址: ${hostname}`);
    }
  }

  // IPv4 私有段检查
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const octets = hostname.split('.').map(Number);
    const isPrivate =
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] === 127 ||
      octets[0] === 0;
    if (isPrivate) {
      throw new UrlValidationError(`webhookUrl 不允许指向私有 IP: ${hostname}`);
    }
  }
}
