import { prisma } from '~/server/extensions/wechat-collector/services/database.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

const DEFAULT_LIMIT = 50;
const ALLOWED_SORTS = ['publishTime', 'title', 'status', 'createdAt', 'updatedAt'] as const;

function serializeArticle(row: Record<string, unknown>) {
  return {
    ...row,
    publishTime: row.publishTime != null ? String(row.publishTime) : null,
  };
}

export default defineEventHandler(async event => {
  try {
    const query = getQuery(event);
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || DEFAULT_LIMIT), 1), 100);
    const where = {
      ...(query.accountId ? { accountId: String(query.accountId) } : {}),
      ...(query.status ? { status: String(query.status) } : {}),
      ...(query.from || query.to
        ? {
            publishTime: {
              ...(query.from ? { gte: BigInt(Math.floor(new Date(String(query.from)).getTime() / 1000)) } : {}),
              ...(query.to ? { lte: BigInt(Math.floor(new Date(String(query.to)).getTime() / 1000)) } : {}),
            },
          }
        : {}),
    };
    const sort = (ALLOWED_SORTS as readonly string[]).includes(String(query.sort))
      ? String(query.sort)
      : 'publishTime';
    const order = String(query.order || 'desc') === 'asc' ? 'asc' : 'desc';
    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sort]: order },
        select: {
          id: true,
          url: true,
          title: true,
          digest: true,
          accountId: true,
          publishTime: true,
          status: true,
          retryCount: true,
          lastError: true,
          failedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.article.count({ where }),
    ]);

    return ok(data.map(serializeArticle), { total, page, limit });
  } catch (error) {
    return fail('LIST_ARTICLES_FAILED', errorMessage(error));
  }
});
