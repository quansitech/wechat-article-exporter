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
  async collect(accounts: CollectionAccount[], options?: CollectionOptions): Promise<CollectionArticle[]> {
    console.log(`[ArticleCollector] 开始采集文章，账号数量: ${accounts.length}`);

    const allArticles: CollectionArticle[] = [];
    const maxArticles = options?.maxArticles || 100;

    for (const account of accounts) {
      try {
        console.log(`[ArticleCollector] 采集公众号: ${account.nickname}`);

        // 增量检查
        const shouldCollect = await this.checkIncremental(account);
        if (!shouldCollect && !options?.forceRefresh) {
          console.log(`[ArticleCollector] 跳过采集: ${account.nickname} (无新文章)`);
          continue;
        }

        // API 获取文章
        const articles = await this.fetchArticles(account, maxArticles);
        if (articles.length === 0) continue;

        // 入库 + 去重 + 推送到队列 (流式处理)
        const newArticles = await this.processArticles(articles, account.id);
        allArticles.push(...newArticles);

        // 更新 DB 中的 lastCrawlTime
        await prisma.account.update({
          where: { id: account.id },
          data: { lastCrawlTime: new Date() }
        });

      } catch (error) {
        console.error(`[ArticleCollector] 采集公众号失败: ${account.nickname}`, error);
      }
    }

    console.log(`[ArticleCollector] 采集阶段完成，共新增 ${allArticles.length} 篇文章`);
    return allArticles;
  }

  /**
   * 检查是否需要增量采集
   */
  async checkIncremental(account: CollectionAccount): Promise<boolean> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastTime = account.lastCrawlTime || new Date(0);
    return lastTime.getTime() === 0 || lastTime < twentyFourHoursAgo;
  }

  /**
   * 获取文章列表 API Wrapper
   */
  private async fetchArticles(account: CollectionAccount, maxArticles: number): Promise<any[]> {
    const allArticles: any[] = [];
    let begin = 0;
    let hasMore = true;

    while (hasMore && allArticles.length < maxArticles) {
      try {
        // 使用 WeChatApiClient 获取文章（新API返回对象）
        const { articles, isCompleted } = await wechatApiClient.getArticleList(account.id, begin);

        if (articles && articles.length > 0) {
          allArticles.push(...articles);
          begin += articles.length;
          console.log(`[ArticleCollector] ${account.nickname} 分页: ${Math.ceil(begin / 10)}, 总数: ${allArticles.length}`);
        } else {
          hasMore = false;
        }

        if (isCompleted || allArticles.length >= maxArticles) hasMore = false;

        await this.delay(1000 + Math.random() * 1000); // 随机延迟

      } catch (error) {
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

        // 利用 Prisma create (如果冲突会抛错) 或 findUnique 预检查
        // 推荐 upset 或 先查后插，这里简单起见先查后插
        const existing = await prisma.article.findUnique({ where: { id: urlHash } });

        if (existing) {
          // 已存在，跳过
          continue;
        }

        // 入库
        const created = await prisma.article.create({
          data: {
            id: urlHash,
            url: article.link,
            title: article.title || '无标题',
            accountId,
            publishTime: BigInt(article.create_time || 0),
            status: 0, // Pending
          }
        });

        const collectionArticle: CollectionArticle = {
          id: created.id,
          accountId,
          url: created.url,
          urlHash: created.id,
          title: created.title,
          status: 'pending',
          createdAt: created.createdAt
        };

        newCollectionArticles.push(collectionArticle);

        // **关键步骤**: 将新任务立即推送到 ContentProcessor 队列
        // 这样就实现了生产者产生的瞬间，消费者就开始工作
        await contentProcessorService.addTask(collectionArticle);

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
