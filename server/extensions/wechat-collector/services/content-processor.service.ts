import type {
  CollectionArticle,
  CollectionOptions,
  IContentProcessorService,
  ArticleProcessResult
} from '~/types/collection.types';
import { promises as fs } from 'fs';
import { join } from 'path';
import PQueue from 'p-queue';
import { prisma } from './database.service';
import { wechatApiClient } from '../utils/wechat-api-client';
import TurndownService from 'turndown';
import { normalizeHtml } from '~/server/utils';
import { randomBytes } from 'crypto';

/**
 * 内容处理服务
 * 负责消费文章处理任务，由 p-queue 调度
 */
export class ContentProcessorService implements IContentProcessorService {
  private baseStoragePath = './storage/collected-articles';
  // 核心：异步队列，控制并发
  private queue = new PQueue({ concurrency: 5 });

  constructor() {
    this.queue.on('idle', () => {
      console.log(`[ContentProcessor] 队列已空闲`);
    });


    this.restorePendingTasks().catch(err => {
      console.error('[ContentProcessor] 恢复任务失败:', err);
    });
  }

  /**
   * 设置并发度
   */
  setConcurrency(concurrency: number): void {
    if (concurrency > 0) {
      this.queue.concurrency = concurrency;
      console.log(`[ContentProcessor] 并发度已设置为: ${concurrency}`);
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      concurrency: this.queue.concurrency
    };
  }

  /**
   * 等待所有任务完成
   */
  async waitForIdle(): Promise<void> {
    await this.queue.onIdle();
  }

  /**
   * 添加任务到队列 (Producer调用)
   */
  async addTask(article: CollectionArticle): Promise<void> {
    console.log(`[ContentProcessor] 添加任务: ${article.title}`);

    this.queue.add(async () => {
      await this.processSingleArticle(article);
    });
  }

  /**
   * 恢复未完成的任务 (Pending -> Queue)
   */
  async restorePendingTasks(): Promise<void> {
    try {
      const pendings = await prisma.article.findMany({
        where: { status: 0 } // Pending
      });

      if (pendings.length === 0) return;

      console.log(`[ContentProcessor] 恢复 ${pendings.length} 个挂起任务`);

      for (const p of pendings) {
        // 转换为 CollectionArticle 结构
        const task: CollectionArticle = {
          id: p.id,
          accountId: p.accountId,
          url: p.url,
          urlHash: p.id,
          title: p.title,
          status: 'pending',
          createdAt: p.createdAt
        };
        await this.addTask(task);
      }
    } catch (error) {
      console.error('[ContentProcessor] 恢复任务查询失败:', error);
    }
  }

  /**
   * 手动处理一批 (保留兼容性，但内部转为队列)
   */
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
      // 1. Update Status -> Processing
      await prisma.article.update({
        where: { id: article.urlHash },
        data: { status: 1 } // Processing
      });

      // 2. Download & Convert
      const markdownContent = await this.downloadAndConvert(article.url);

      // 3. Save to File
      const filePath = await this.saveToFile(markdownContent, {
        title: article.title,
        author: '微信公众号',
        date: new Date(article.createdAt)
      });

      // 4. Update Status -> Done
      await prisma.article.update({
        where: { id: article.urlHash },
        data: {
          status: 2, // Done
          localPath: filePath,
          content: markdownContent
        }
      });

      console.log(`[ContentProcessor] 处理成功: ${article.title}`);

    } catch (error) {
      console.error(`[ContentProcessor] 处理失败: ${article.title}`, error);

      // 5. Update Status -> Failed
      await prisma.article.update({
        where: { id: article.urlHash },
        data: { status: 3 } // Failed
      }).catch((e: Error) => console.error('DB Update Failed', e));
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

  async saveToFile(content: string, metadata: { title: string; author: string; date: Date }): Promise<string> {
    await this.ensureStorageDirectory();
    const sanitizedTitle = this.sanitizeFileName(metadata.title);

    // 使用 时间戳 + 随机串 确保唯一性
    const randomSuffix = randomBytes(4).toString('hex');
    const fileName = `${sanitizedTitle}_${Date.now()}_${randomSuffix}.md`;
    const filePath = join(this.baseStoragePath, fileName);

    const fullContent = this.buildMarkdownFile(content, metadata);
    await fs.writeFile(filePath, fullContent, 'utf-8');
    return filePath;
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.access(this.baseStoragePath);
    } catch {
      await fs.mkdir(this.baseStoragePath, { recursive: true });
    }
  }

  private buildMarkdownFile(content: string, metadata: { title: string; author: string; date: Date }): string {
    return `---
title: "${metadata.title}"
author: "${metadata.author}"
date: "${metadata.date.toISOString()}"
source: "微信公众号"
---

${content}`;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  setStoragePath(path: string): void {
    this.baseStoragePath = path;
  }
}

export const contentProcessorService = new ContentProcessorService();
