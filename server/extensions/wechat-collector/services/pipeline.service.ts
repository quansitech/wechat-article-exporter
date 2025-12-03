import type {
  CollectionOptions,
  IPipelineService,
  CollectionStatusResponse
} from '~/types/collection.types';
import { taskManagerService } from './task-manager.service';
import { accountDiscoveryService } from './account-discovery.service';
import { articleCollectorService } from './article-collector.service';
import { contentProcessorService } from './content-processor.service';

/**
 * 流水线协调服务
 * 负责协调三个阶段的工作流：账号发现 → 链接采集 → 内容处理
 */
export class PipelineService implements IPipelineService {
  // 存储任务的取消控制器
  private cancelTokens = new Map<string, AbortController>();

  /**
   * 启动采集任务
   * 创建任务并异步执行完整流水线
   */
  async startCollection(subjectName: string, options?: CollectionOptions): Promise<string> {
    console.log(`[Pipeline] 启动采集任务，主体: ${subjectName}`);

    try {
      // 创建任务记录
      const taskId = await taskManagerService.createTask(subjectName, options);

      // 创建取消控制器
      const controller = new AbortController();
      this.cancelTokens.set(taskId, controller);

      // 异步执行采集流水线（不阻塞API响应）
      this.executePipeline(taskId, subjectName, options, controller.signal).catch(error => {
        console.error(`[Pipeline] 采集任务失败: ${taskId}`, error);
        taskManagerService.updateTaskStatus(taskId, 'failed', error.message);
        this.cancelTokens.delete(taskId);
      });

      console.log(`[Pipeline] 采集任务已启动: ${taskId}`);
      return taskId;

    } catch (error) {
      console.error(`[Pipeline] 启动采集任务失败:`, error);
      throw new Error(`启动采集任务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行完整采集流水线
   */
  private async executePipeline(taskId: string, subjectName: string, options?: CollectionOptions, signal?: AbortSignal): Promise<void> {
    console.log(`[Pipeline] 开始执行流水线: ${taskId}`);

    try {
      if (signal?.aborted) throw new Error('任务已取消');

      // 阶段一：账号发现
      console.log(`[Pipeline] 阶段一：账号发现`);
      const accounts = await this.executeAccountDiscovery(taskId, subjectName, signal);

      if (accounts.length === 0) {
        throw new Error(`未找到与"${subjectName}"相关的公众号`);
      }

      if (signal?.aborted) throw new Error('任务已取消');

      // 阶段二：链接采集
      console.log(`[Pipeline] 阶段二：链接采集`);
      const articles = await this.executeArticleCollection(taskId, accounts, options, signal);

      if (articles.length === 0) {
        // 可能是增量更新没有新文章，不应视为错误，但流水线可以提前结束
        console.log(`[Pipeline] 未采集到新文章，任务完成`);
        await taskManagerService.updateTaskStatus(taskId, 'completed');
        return;
      }

      if (signal?.aborted) throw new Error('任务已取消');

      // 阶段三：内容处理
      console.log(`[Pipeline] 阶段三：内容处理`);
      await this.executeContentProcessing(taskId, articles, options, signal);

      // 任务完成
      console.log(`[Pipeline] 采集任务完成: ${taskId}`);
      await taskManagerService.updateTaskStatus(taskId, 'completed');

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      if (errorMessage === '任务已取消') {
        console.log(`[Pipeline] 任务已中止: ${taskId}`);
        await taskManagerService.updateTaskStatus(taskId, 'failed', '任务被手动取消');
      } else {
        console.error(`[Pipeline] 流水线执行失败: ${taskId}`, error);
        await taskManagerService.updateTaskStatus(taskId, 'failed', errorMessage);
      }
    } finally {
      this.cancelTokens.delete(taskId);
    }
  }

  /**
   * 执行账号发现阶段
   */
  private async executeAccountDiscovery(taskId: string, subjectName: string, signal?: AbortSignal): Promise<any[]> {
    console.log(`[Pipeline] 执行账号发现: ${taskId}`);

    try {
      if (signal?.aborted) throw new Error('任务已取消');

      // 更新任务进度
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'discovering',
        percentage: 0.1,
        message: '正在搜索公众号...'
      });

      // 执行账号发现
      const accounts = await accountDiscoveryService.discover(subjectName);

      // 更新任务进度
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'discovering',
        percentage: 0.33,
        accountsDiscovered: accounts.length,
        message: `发现 ${accounts.length} 个公众号`
      });

      console.log(`[Pipeline] 账号发现完成: 找到 ${accounts.length} 个公众号`);
      return accounts;

    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === '任务已取消')) throw error;
      console.error(`[Pipeline] 账号发现失败:`, error);
      throw new Error(`账号发现失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行文章采集阶段
   */
  private async executeArticleCollection(taskId: string, accounts: any[], options?: CollectionOptions, signal?: AbortSignal): Promise<any[]> {
    console.log(`[Pipeline] 执行文章采集: ${taskId}, 账号数量: ${accounts.length}`);

    try {
      if (signal?.aborted) throw new Error('任务已取消');

      // 更新任务进度
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'collecting',
        percentage: 0.33,
        message: '正在采集文章链接...'
      });

      // 执行文章采集 (传递 signal 以支持中断)
      // 注意：articleCollectorService.collect 需要更新以支持 signal，这里暂时只在循环间隙检查
      const articles = await articleCollectorService.collect(accounts, options);

      // 更新任务进度
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'collecting',
        percentage: 0.66,
        articlesCollected: articles.length,
        message: `采集到 ${articles.length} 篇文章`
      });

      console.log(`[Pipeline] 文章采集完成: 采集到 ${articles.length} 篇文章`);
      return articles;

    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === '任务已取消')) throw error;
      console.error(`[Pipeline] 文章采集失败:`, error);
      throw new Error(`文章采集失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 执行内容处理阶段
   */
  private async executeContentProcessing(taskId: string, articles: any[], options?: CollectionOptions, signal?: AbortSignal): Promise<void> {
    console.log(`[Pipeline] 执行内容处理: ${taskId}, 文章数量: ${articles.length}`);

    try {
      if (signal?.aborted) throw new Error('任务已取消');

      // 更新任务进度
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'processing',
        percentage: 0.8,
        message: '文章已入队，正在后台处理...'
      });

      // 设置并发度
      if (options?.concurrency) {
        contentProcessorService.setConcurrency(options.concurrency);
      }

      // 等待队列处理完成
      // 注意：这里需要一种机制来响应 signal 中断等待
      console.log(`[Pipeline] 等待队列处理完成...`);

      // 简单的轮询等待，支持取消
      const checkInterval = 1000;
      while (true) {
        if (signal?.aborted) throw new Error('任务已取消');

        const stats = contentProcessorService.getQueueStats();
        if (stats.size === 0 && stats.pending === 0) break;

        // 更新处理进度
        // 这里假设 contentProcessorService 能提供已处理数量，或者我们通过 DB 查询
        // 简化起见，这里不频繁查询 DB

        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }

      // 更新任务进度 - 任务级别完成
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'completed',
        percentage: 1.0,
        message: `采集流水线完成`
      });

      console.log(`[Pipeline] 内容处理阶段完成`);

    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.message === '任务已取消')) throw error;
      console.error(`[Pipeline] 内容处理失败:`, error);
      throw new Error(`内容处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 获取任务状态
   */
  async getStatus(taskId?: string, subjectName?: string): Promise<CollectionStatusResponse> {
    return await taskManagerService.getStatus(taskId, subjectName);
  }

  /**
   * 获取任务详情
   */
  async getTaskDetail(taskId: string): Promise<any> {
    const task = await taskManagerService.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    return {
      task,
    };
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = await taskManagerService.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status === 'running') {
      // 1. 触发 AbortController
      const controller = this.cancelTokens.get(taskId);
      if (controller) {
        controller.abort();
        console.log(`[Pipeline] 发送取消信号: ${taskId}`);
      } else {
        console.warn(`[Pipeline] 未找到任务控制器，可能已结束或服务重启: ${taskId}`);
        // 如果找不到控制器（如服务重启后），直接更新状态
        await taskManagerService.updateTaskStatus(taskId, 'failed', '任务被强制取消');
      }

      // 2. 清理队列 (可选，如果需要立即停止所有处理)
      // contentProcessorService.clearQueue(); 

    } else {
      throw new Error(`无法取消非运行中的任务: ${task.status}`);
    }
  }
}

// 创建单例实例
export const pipelineService = new PipelineService();
