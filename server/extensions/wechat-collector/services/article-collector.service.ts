import type {
  CollectionAccount,
  CollectionArticle,
  CollectionOptions,
  IArticleCollectorService
} from '~/types/collection.types';
import { wechatApiClient } from '../utils/wechat-api-client';
import { createHash } from 'crypto';
import { prisma } from './database.service';
import { contentProcessorService } from './content-processor.service';

/**
 * 文章采集服务
 * 负责增量获取文章链接并进行去重，并将新任务推送到处理队列
 */
export class ArticleCollectorService implements IArticleCollectorService {

  /**
   * 采集文章链接
   */
  async collect(accounts: CollectionAccount[], options?: CollectionOptions, signal?: AbortSignal): Promise<CollectionArticle[]> {
    console.log(`[ArticleCollector] 开始采集文章，账号数量: ${accounts.length}`);

    const allArticles: CollectionArticle[] = [];
    // 如果 maxArticles 未定义，则为 Infinity，表示采集所有
    const maxArticles = options?.maxArticles ?? Infinity;

    for (const account of accounts) {
      // 检查取消信号
      if (signal?.aborted) {
        console.log('[ArticleCollector] 任务已取消，停止采集');
        throw new Error('任务已取消');
      }

      try {
        console.log(`[ArticleCollector] 采集公众号: ${account.nickname}`);

        // 增量检查
        const shouldCollect = await this.checkIncremental(account, options?.forceRefresh);
        if (!shouldCollect) {
          console.log(`[ArticleCollector] 跳过采集: ${account.nickname} (增量检查未通过)`);
          continue;
        }

        // API 获取文章
        const articles = await this.fetchArticles(account, maxArticles, signal);
        if (articles.length === 0) continue;

        // 入库 + 去重 + 推送到队列 (流式处理)
        const newArticles = await this.processArticles(articles, account.id);
        allArticles.push(...newArticles);

        // 更新 DB 中的 lastCrawlTime
        await prisma.account.update({
          where: { id: account.id },
          data: { lastCrawlTime: new Date() }
        });

        // 账号间随机延迟
        await this.delay(2000 + Math.random() * 3000);

      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.message === '任务已取消')) throw error;
        console.error(`[ArticleCollector] 采集公众号失败: ${account.nickname}`, error);
      }
    }

    console.log(`[ArticleCollector] 采集阶段完成，共新增 ${allArticles.length} 篇文章`);
    return allArticles;
  }

  /**
   * 检查是否需要增量采集
   */
  async checkIncremental(account: CollectionAccount, forceRefresh?: boolean): Promise<boolean> {
    if (forceRefresh) return true;

    const now = new Date();
    // 默认间隔 12 小时，可根据账号活跃度调整
    const interval = 12 * 60 * 60 * 1000;
    const lastTime = account.lastCrawlTime || new Date(0);

    return now.getTime() - lastTime.getTime() > interval;
  }

  /**
   * 获取文章列表 API Wrapper
   */
  private async fetchArticles(account: CollectionAccount, maxArticles: number, signal?: AbortSignal): Promise<any[]> {
    const allArticles: any[] = [];
    let begin = 0;
    let hasMore = true;

    while (hasMore && allArticles.length < maxArticles) {
      // 检查取消信号
      if (signal?.aborted) throw new Error('任务已取消');

      try {
        // 使用 WeChatApiClient 获取文章
        const { articles, isCompleted } = await wechatApiClient.getArticleList(account.id, begin);

        if (articles && articles.length > 0) {
          allArticles.push(...articles);
          begin += articles.length;
          console.log(`[ArticleCollector] ${account.nickname} 分页: ${Math.ceil(begin / 10)}, 总数: ${allArticles.length}`);
        } else {
          hasMore = false;
        }

        if (isCompleted || allArticles.length >= maxArticles) hasMore = false;

        // 分页间随机延迟
        await this.delay(1500 + Math.random() * 1500);

      } catch (error) {
        if (signal?.aborted || (error instanceof Error && error.message === '任务已取消')) throw error;
        console.error(`[ArticleCollector] fetchArticles error:`, error);
        hasMore = false;
      }
    }
    return allArticles.slice(0, maxArticles);
  }

  /**
   * 处理文章: 去重 -> 入库 -> 推送队列
   */
  private async processArticles(articles: any[], accountId: string): Promise<CollectionArticle[]> {
    const newCollectionArticles: CollectionArticle[] = [];

    for (const article of articles) {
      try {
        const urlHash = this.generateUrlHash(article.link);

        // 使用 upsert 替代 findUnique + create
        // 如果已存在，则不进行任何操作 (update 空对象)
        // 如果不存在，则创建
        const savedArticle = await prisma.article.upsert({
          where: { id: urlHash },
          update: {}, // 已存在不更新，保持原有状态
          create: {
            id: urlHash,
            url: article.link,
            title: article.title || '无标题',
            accountId,
            publishTime: BigInt(article.create_time || 0),
            status: 0, // Pending
          }
        });

        // 只有当文章是新创建的（或者状态为 Pending）才加入队列
        // 这里简单判断：如果 createTime 刚刚生成，说明是新的
        // 或者我们可以检查 savedArticle.status === 0
        if (savedArticle.status === 0) {
          const collectionArticle: CollectionArticle = {
            id: savedArticle.id,
            accountId,
            url: savedArticle.url,
            urlHash: savedArticle.id,
            title: savedArticle.title,
            status: 'pending',
            createdAt: savedArticle.createdAt
          };

          // 避免重复加入队列（如果已经是 Pending 但未处理）
          // 实际生产中可能需要 Redis Set 去重，这里简化处理
          newCollectionArticles.push(collectionArticle);
          await contentProcessorService.addTask(collectionArticle);
        }

      } catch (error) {
        console.error(`[ArticleCollector] processArticles error:`, error);
      }
    }

    return newCollectionArticles;
  }

  private generateUrlHash(url: string): string {
    return createHash('sha256').update(url).digest('hex');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const articleCollectorService = new ArticleCollectorService();
