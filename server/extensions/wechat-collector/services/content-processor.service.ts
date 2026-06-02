import PQueue from 'p-queue';
import TurndownService from 'turndown';
import { normalizeHtml } from '~/shared/utils/html';
import type {
  ArticleProcessResult,
  CollectionArticle,
  CollectionOptions,
  IContentProcessorService,
} from '~/types/collection.types';
import { collectorConfig, randomDelay } from '../config';
import { wechatApiClient } from '../utils/wechat-api-client';
import { prisma } from './database.service';

export class ContentProcessorService implements IContentProcessorService {
  private queue = new PQueue({ concurrency: collectorConfig.concurrency });
  private initialized = false;

  constructor() {
    this.queue.on('idle', () => {
      console.log(`[ContentProcessor] 队列已空闲`);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.restorePendingTasks();
  }

  setConcurrency(concurrency: number): void {
    if (concurrency > 0) {
      this.queue.concurrency = concurrency;
      console.log(`[ContentProcessor] 并发度已设置为: ${concurrency}`);
    }
  }

  getQueueStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      concurrency: this.queue.concurrency,
    };
  }

  async waitForIdle(): Promise<void> {
    await this.queue.onIdle();
  }

  async addTask(article: CollectionArticle): Promise<void> {
    console.log(`[ContentProcessor] 添加任务: ${article.title}`);

    this.queue.add(async () => {
      await this.processSingleArticle(article);
    });
  }

  async restorePendingTasks(): Promise<void> {
    try {
      const pendings = await prisma.article.findMany({
        where: {
          OR: [{ status: 'PENDING' }, { status: 'FAILED', retryCount: { lt: collectorConfig.maxRetries } }],
        },
      });

      if (pendings.length === 0) return;

      console.log(`[ContentProcessor] 恢复 ${pendings.length} 个挂起任务`);

      for (const p of pendings) {
        const task: CollectionArticle = {
          id: p.id,
          accountId: p.accountId,
          url: p.url,
          urlHash: p.id,
          title: p.title,
          status: 'pending',
          createdAt: p.createdAt,
        };
        await this.addTask(task);
      }
    } catch (error) {
      console.error('[ContentProcessor] 恢复任务查询失败:', error);
    }
  }

  async process(articles: CollectionArticle[], options?: CollectionOptions): Promise<ArticleProcessResult[]> {
    if (options?.concurrency) {
      this.setConcurrency(options.concurrency);
    }

    for (const article of articles) {
      this.addTask(article);
    }

    return [];
  }

  /**
   * 处理单篇文章 (Queue Worker)
   */
  private async processSingleArticle(article: CollectionArticle): Promise<void> {
    console.log(`[ContentProcessor] 正在处理: ${article.title}`);

    try {
      await prisma.article.update({
        where: { id: article.urlHash },
        data: { status: 'PROCESSING' },
      });

      const markdownContent = await this.downloadAndConvert(article.url);

      // 下载间随机延迟（防限流第三层）
      const dlDelay = randomDelay(collectorConfig.downloadDelayMs);
      await new Promise(resolve => setTimeout(resolve, dlDelay));

      await prisma.article.update({
        where: { id: article.urlHash },
        data: {
          status: 'DONE',
          content: markdownContent,
          lastError: null,
          failedAt: null,
        },
      });

      console.log(`[ContentProcessor] 处理成功: ${article.title}`);
    } catch (error) {
      console.error(`[ContentProcessor] 处理失败: ${article.title}`, error);

      await prisma.article
        .update({
          where: { id: article.urlHash },
          data: {
            status: 'FAILED',
            retryCount: { increment: 1 },
            lastError: error instanceof Error ? error.message : '未知错误',
            failedAt: new Date(),
          },
        })
        .catch((e: Error) => console.error('DB Update Failed', e));
    }
  }

  async downloadAndConvert(url: string): Promise<string> {
    console.log(`[ContentProcessor] 下载文章: ${url}`);

    try {
      // 使用统一客户端下载页面内容 (Mock/Real 自动切换)
      const rawHtml = await wechatApiClient.downloadPage(url);

      const turndownService = new TurndownService();
      return turndownService.turndown(normalizeHtml(rawHtml, 'html'));
    } catch (error) {
      console.error(`[ContentProcessor] 下载转换失败:`, error);
      throw error;
    }
  }
}

export const contentProcessorService = new ContentProcessorService();
