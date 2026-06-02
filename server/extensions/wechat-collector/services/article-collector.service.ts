import { createHash } from 'crypto';
import type {
  CollectionAccount,
  CollectionArticle,
  CollectionOptions,
  IArticleCollectorService,
} from '~/types/collection.types';
import { collectorConfig, randomDelay } from '../config';
import { wechatApiClient } from '../utils/wechat-api-client';
import { contentProcessorService } from './content-processor.service';
import { prisma } from './database.service';

/**
 * 文章采集服务
 * 负责增量获取文章链接并进行去重，并将新任务推送到处理队列
 */
export class ArticleCollectorService implements IArticleCollectorService {
  async collect(
    accounts: CollectionAccount[],
    options?: CollectionOptions,
    signal?: AbortSignal
  ): Promise<CollectionArticle[]> {
    console.log(`[ArticleCollector] 开始采集文章，账号数量: ${accounts.length}`);

    const allArticles: CollectionArticle[] = [];
    const maxArticles = options?.maxArticles ?? Infinity;

    for (const account of accounts) {
      if (signal?.aborted) {
        console.log('[ArticleCollector] 任务已取消，停止采集');
        throw new Error('任务已取消');
      }

      try {
        console.log(`[ArticleCollector] 采集公众号: ${account.nickname}`);

        const shouldCollect = await this.checkIncremental(account, options?.forceRefresh);
        if (!shouldCollect) {
          console.log(`[ArticleCollector] 跳过采集: ${account.nickname} (增量检查未通过)`);
          continue;
        }

        const articles = await this.fetchArticles(account, maxArticles, signal);
        if (articles.length === 0) continue;

        const newArticles = await this.processArticles(articles, account.id);
        allArticles.push(...newArticles);

        if (newArticles.length > 0) {
          await prisma.account.update({
            where: { id: account.id },
            data: { lastCrawlTime: new Date() },
          });
        }

        await this.delay(randomDelay(collectorConfig.accountDelayMs));
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.message === '任务已取消')) throw error;
        if (error instanceof Error && error.message.includes('session expired')) throw error;
        console.error(`[ArticleCollector] 采集公众号失败: ${account.nickname}`, error);
      }
    }

    console.log(`[ArticleCollector] 采集阶段完成，共新增 ${allArticles.length} 篇文章`);
    return allArticles;
  }

  async checkIncremental(account: CollectionAccount, forceRefresh?: boolean): Promise<boolean> {
    if (forceRefresh) return true;
    if (!account.lastCrawlTime) return true;
    const elapsed = Date.now() - account.lastCrawlTime.getTime();
    if (elapsed < 12 * 60 * 60 * 1000) {
      console.log(
        `[ArticleCollector] 增量检查未通过: ${account.nickname}，距上次采集仅 ${Math.round(elapsed / 60000)} 分钟`
      );
      return false;
    }
    return true;
  }

  private async fetchArticles(account: CollectionAccount, maxArticles: number, signal?: AbortSignal): Promise<any[]> {
    const allArticles: any[] = [];
    let begin = 0;
    let hasMore = true;
    let shouldStop = false;
    const lastCrawlTime = account.lastCrawlTime;

    while (hasMore && !shouldStop && allArticles.length < maxArticles) {
      if (signal?.aborted) throw new Error('任务已取消');

      try {
        const { articles, isCompleted } = await wechatApiClient.getArticleList(account.id, begin);

        if (articles && articles.length > 0) {
          // 批量查询本页所有文章的存在状态
          const pageHashes = articles.map((a: any) => this.generateUrlHash(a.link));
          const existingMap = await this.batchGetExisting(pageHashes);

          for (const article of articles) {
            const publishTime = this.toPublishDate(article.create_time);
            const urlHash = this.generateUrlHash(article.link);
            const existing = existingMap.get(urlHash);
            const hitTimeBoundary = !!lastCrawlTime && publishTime <= lastCrawlTime;

            if (existing?.status === 'DONE' || hitTimeBoundary) {
              shouldStop = true;
              break;
            }

            allArticles.push(article);

            if (allArticles.length >= maxArticles) {
              shouldStop = true;
              break;
            }
          }
          begin += articles.length;
          console.log(
            `[ArticleCollector] ${account.nickname} 分页: ${Math.ceil(begin / 10)}, 总数: ${allArticles.length}`
          );
        } else {
          hasMore = false;
        }

        if (isCompleted || allArticles.length >= maxArticles) hasMore = false;

        // 分页间随机延迟（防限流第二层）
        await this.delay(randomDelay(collectorConfig.pageDelayMs));
      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.message === '任务已取消')) throw error;
        if (error instanceof Error && error.message.includes('session expired')) throw error;
        console.error(`[ArticleCollector] fetchArticles error:`, error);
        hasMore = false;
      }
    }
    return allArticles.slice(0, maxArticles);
  }

  private async processArticles(articles: any[], accountId: string): Promise<CollectionArticle[]> {
    const newCollectionArticles: CollectionArticle[] = [];

    // 批量查询所有文章的存在状态
    const hashes = articles.map(a => this.generateUrlHash(a.link));
    const existingMap = await this.batchGetExisting(hashes);

    for (const article of articles) {
      try {
        const urlHash = this.generateUrlHash(article.link);
        const existing = existingMap.get(urlHash);

        if (existing?.status === 'FAILED' && existing.retryCount < collectorConfig.maxRetries) {
          await prisma.article.update({
            where: { id: urlHash },
            data: {
              status: 'PENDING',
              lastError: null,
              failedAt: null,
            },
          });
        }

        if (existing && existing.status !== 'FAILED') {
          continue;
        }

        const savedArticle = await prisma.article.upsert({
          where: { id: urlHash },
          update: {
            status: 'PENDING',
            lastError: null,
            failedAt: null,
          },
          create: {
            id: urlHash,
            url: article.link,
            title: article.title || '无标题',
            digest: article.digest || null,
            accountId,
            publishTime: this.toPublishTimestamp(article.create_time),
            status: 'PENDING',
          },
        });

        if (savedArticle.status === 'PENDING') {
          const collectionArticle: CollectionArticle = {
            id: savedArticle.id,
            accountId,
            url: savedArticle.url,
            urlHash: savedArticle.id,
            title: savedArticle.title,
            status: 'pending',
            createdAt: savedArticle.createdAt,
          };

          newCollectionArticles.push(collectionArticle);
          await contentProcessorService.addTask(collectionArticle);
        }
      } catch (error) {
        console.error(`[ArticleCollector] processArticles error:`, error);
      }
    }

    return newCollectionArticles;
  }

  /**
   * 批量查询文章存在状态，返回 Map<urlHash, { status, retryCount }>
   */
  private async batchGetExisting(urlHashes: string[]): Promise<Map<string, { status: string; retryCount: number }>> {
    if (urlHashes.length === 0) return new Map();
    const rows = await prisma.article.findMany({
      where: { id: { in: urlHashes } },
      select: { id: true, status: true, retryCount: true },
    });
    const map = new Map<string, { status: string; retryCount: number }>();
    for (const row of rows) {
      map.set(row.id, { status: row.status, retryCount: row.retryCount });
    }
    return map;
  }

  private generateUrlHash(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  private toPublishTimestamp(timestamp: number | undefined): bigint {
    return BigInt(timestamp || Math.floor(Date.now() / 1000));
  }

  private toPublishDate(timestamp: number | undefined): Date {
    return new Date((timestamp || Math.floor(Date.now() / 1000)) * 1000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const articleCollectorService = new ArticleCollectorService();
