import { timingSafeEqual } from 'crypto';

/**
 * Collector API 认证中间件
 * 所有 /api/collector/* 端点需要 COLLECTOR_API_KEY 或 DEBUG_KEY 认证
 */
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/collector/')) return;

  // 优先检查 header，其次 query parameter
  const headerKey = getHeader(event, 'x-collector-key');
  const queryKey = getQuery(event).key as string | undefined;
  const providedKey = headerKey || queryKey;

  const validKey = process.env.COLLECTOR_API_KEY || process.env.DEBUG_KEY;

  if (!validKey) {
    // 未配置密钥时拒绝所有请求（防止无密钥部署时的裸奔）
    throw createError({
      statusCode: 503,
      message: 'Service unavailable: no API key configured (set COLLECTOR_API_KEY or DEBUG_KEY)',
    });
  }

  if (!providedKey || !timingSafeEqual(Buffer.from(providedKey), Buffer.from(validKey))) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    });
  }
});
