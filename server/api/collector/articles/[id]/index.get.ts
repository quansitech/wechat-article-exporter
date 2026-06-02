import { prisma } from '~/server/extensions/wechat-collector/services/database.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

function serializeArticle(row: Record<string, unknown>) {
  return {
    ...row,
    publishTime: row.publishTime != null ? String(row.publishTime) : null,
  };
}

export default defineEventHandler(async event => {
  try {
    const id = getRouterParam(event, 'id');
    if (!id) {
      throw new Error('文章 ID 不能为空');
    }
    const article = await prisma.article.findUnique({
      where: { id },
      include: { account: true },
    });
    if (!article) {
      throw new Error('文章不存在');
    }
    return ok(serializeArticle(article as unknown as Record<string, unknown>));
  } catch (error) {
    return fail('GET_ARTICLE_FAILED', errorMessage(error));
  }
});
