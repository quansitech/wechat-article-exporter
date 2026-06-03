import { prisma } from '~/server/extensions/wechat-collector/services/database.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

export default defineEventHandler(async () => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [crawlRunsAll, crawlRuns24h, completedRuns, articlesByStatus] = await Promise.all([
      prisma.crawlRun.groupBy({ by: ['status'], _count: true }),
      prisma.crawlRun.groupBy({ by: ['status'], _count: true, where: { startedAt: { gte: last24h } } }),
      prisma.crawlRun.findMany({
        where: { status: 'COMPLETED', completedAt: { not: null }, startedAt: { gte: last7d } },
        select: { startedAt: true, completedAt: true },
      }),
      prisma.article.groupBy({ by: ['status'], _count: true }),
    ]);

    const total = crawlRunsAll.reduce((sum, r) => sum + r._count, 0);
    const completed = crawlRunsAll.find(r => r.status === 'COMPLETED')?._count ?? 0;
    const failed = crawlRunsAll.find(r => r.status === 'FAILED')?._count ?? 0;

    const total24h = crawlRuns24h.reduce((sum, r) => sum + r._count, 0);
    const completed24h = crawlRuns24h.find(r => r.status === 'COMPLETED')?._count ?? 0;
    const failed24h = crawlRuns24h.find(r => r.status === 'FAILED')?._count ?? 0;

    const successRate = total > 0 ? completed / total : 0;

    let avgDurationMs = 0;
    if (completedRuns.length > 0) {
      const totalDuration = completedRuns.reduce((sum, run) => {
        const duration = run.completedAt!.getTime() - run.startedAt.getTime();
        return sum + duration;
      }, 0);
      avgDurationMs = Math.round(totalDuration / completedRuns.length);
    }

    const byStatus: Record<string, number> = {};
    for (const row of articlesByStatus) {
      byStatus[row.status] = row._count;
    }
    const articlesTotal = articlesByStatus.reduce((sum, r) => sum + r._count, 0);

    return ok({
      crawlRuns: {
        total,
        completed,
        failed,
        successRate: Math.round(successRate * 10000) / 10000,
        avgDurationMs,
        last24h: {
          total: total24h,
          completed: completed24h,
          failed: failed24h,
        },
      },
      articles: {
        total: articlesTotal,
        byStatus,
      },
    });
  } catch (error) {
    return fail('METRICS_QUERY_FAILED', errorMessage(error));
  }
});
