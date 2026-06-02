import { mockUtils } from '~/config/mock';
import { ok } from '~/server/extensions/wechat-collector/utils/api-response';

export default defineEventHandler((event) => {
  // 安全守卫：生产环境禁止执行
  if (process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 403,
      message: 'Test endpoints are not available in production',
    });
  }

  const query = getQuery(event);
  const key = query.key as string | undefined;
  if (!key || key !== process.env.DEBUG_KEY) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: valid DEBUG_KEY required via ?key= parameter',
    });
  }
  const accounts = mockUtils.getAccounts();
  const articles = mockUtils.getArticles();
  return ok({
    test1: {
      name: 'mock accounts',
      expected: 2,
      actual: accounts.length,
      passed: accounts.length === 2,
    },
    test2: {
      name: 'mock articles',
      expected: 11,
      actual: articles.length,
      passed: articles.length === 11,
    },
  });
});
