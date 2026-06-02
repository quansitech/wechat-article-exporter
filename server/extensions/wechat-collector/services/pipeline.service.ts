import { randomUUID } from 'crypto';
import type { CollectionOptions, CollectionStatusResponse, CollectionTask } from '~/types/collection.types';
import { accountDiscoveryService } from './account-discovery.service';
import { articleCollectorService } from './article-collector.service';
import { authProvider } from './auth-provider.service';
import { contentProcessorService } from './content-processor.service';
import { prisma } from './database.service';
import { monitorTargetService } from './monitor-target.service';
import { webhookService } from './webhook.service';

type TriggerType = 'manual' | 'scheduled';

export class PipelineService {
  private cancelTokens = new Map<string, AbortController>();

  async runTarget(targetId: string, triggerType: TriggerType = 'manual', options?: CollectionOptions): Promise<string> {
    const target = await monitorTargetService.get(targetId);
    if (!target || !target.enabled) {
      throw new Error('监控目标不存在或已禁用');
    }

    const run = await prisma.crawlRun.create({
      data: {
        id: randomUUID(),
        targetId: target.id,
        triggerType,
        status: 'RUNNING',
      },
    });

    const controller = new AbortController();
    this.cancelTokens.set(run.id, controller);

    this.executeRun(run.id, target.id, options, controller.signal).catch(error => {
      console.error(`[Pipeline] 采集任务失败: ${run.id}`, error);
      this.failRun(run.id, error instanceof Error ? error.message : '未知错误').catch(updateError => {
        console.error(`[Pipeline] 更新失败状态异常: ${run.id}`, updateError);
      });
    });

    return run.id;
  }

  async startCollection(subjectName: string, options?: CollectionOptions): Promise<string> {
    // 复用已存在的同名目标，避免重复创建
    const existing = await monitorTargetService.findBySubjectName(subjectName);
    if (existing) {
      return this.runTarget(existing.id, 'manual', options);
    }
    const target = await monitorTargetService.create({
      subjectName,
      checkIntervalMinutes: 720,
    });
    return this.runTarget(target.id, 'manual', options);
  }

  async getStatus(taskId?: string, subjectName?: string): Promise<CollectionStatusResponse> {
    const where = {
      ...(taskId ? { id: taskId } : {}),
      ...(subjectName ? { target: { subjectName: { contains: subjectName } } } : {}),
    };
    const runs = await prisma.crawlRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: { target: true },
    });
    const tasks: CollectionTask[] = runs.map(run => ({
      id: run.id,
      subjectName: run.target.subjectName,
      status: this.toLegacyStatus(run.status),
      progress: {
        step: (run.status === 'COMPLETED' ? 'completed' : 'processing') as CollectionTask['progress']['step'],
        percentage: run.status === 'COMPLETED' ? 1 : 0.5,
        accountsDiscovered: run.accountsChecked,
        articlesCollected: run.articlesNew,
        articlesProcessed: Math.max(run.articlesNew - run.articlesFailed, 0),
        message: run.error || undefined,
      },
      error: run.error || undefined,
      createdAt: run.startedAt,
      updatedAt: run.completedAt || run.startedAt,
    }));

    return {
      tasks,
      summary: {
        totalTasks: tasks.length,
        runningTasks: tasks.filter(task => task.status === 'running').length,
        completedTasks: tasks.filter(task => task.status === 'completed').length,
        failedTasks: tasks.filter(task => task.status === 'failed').length,
      },
    };
  }

  async getTaskDetail(taskId: string): Promise<any> {
    const run = await prisma.crawlRun.findUnique({
      where: { id: taskId },
      include: { target: true },
    });
    if (!run) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    return { task: run };
  }

  async cancelTask(taskId: string): Promise<void> {
    const controller = this.cancelTokens.get(taskId);
    if (controller) {
      controller.abort();
      return;
    }
    await this.failRun(taskId, '任务被强制取消');
  }

  private async executeRun(
    runId: string,
    targetId: string,
    options?: CollectionOptions,
    signal?: AbortSignal
  ): Promise<void> {
    const target = await monitorTargetService.get(targetId);
    if (!target) {
      throw new Error('监控目标不存在');
    }

    try {
      const valid = await authProvider.isValid();
      if (!valid) {
        await webhookService.notify(target.webhookUrl, {
          event: 'auth.expired',
          targetId: target.id,
          crawlRunId: runId,
          error: '认证已过期',
        });
        throw new Error('认证已过期');
      }

      if (signal?.aborted) throw new Error('任务被手动取消');
      await contentProcessorService.initialize();

      const accounts = await accountDiscoveryService.discover(target.subjectName);
      if (signal?.aborted) throw new Error('任务被手动取消');

      const articles = await articleCollectorService.collect(accounts, options, signal);
      await contentProcessorService.waitForIdle();

      const articlesFailed = await prisma.article.count({
        where: {
          id: { in: articles.map(article => article.id) },
          status: 'FAILED',
        },
      });
      const completedAt = new Date();

      await prisma.crawlRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED',
          accountsChecked: accounts.length,
          articlesNew: articles.length,
          articlesFailed,
          completedAt,
        },
      });

      await prisma.monitorTarget.update({
        where: { id: target.id },
        data: {
          lastRunAt: completedAt,
          nextRunAt: monitorTargetService.nextRunAt(target.checkIntervalMinutes, completedAt),
          lastCrawlTime: completedAt,
        },
      });
      await webhookService.notify(target.webhookUrl, {
        event: 'crawl.completed',
        targetId: target.id,
        crawlRunId: runId,
        status: 'COMPLETED',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      await this.failRun(runId, message);
      await webhookService.notify(target.webhookUrl, {
        event: 'crawl.failed',
        targetId: target.id,
        crawlRunId: runId,
        status: 'FAILED',
        error: message,
      });
      throw error;
    } finally {
      this.cancelTokens.delete(runId);
    }
  }

  private async failRun(runId: string, error: string): Promise<void> {
    await prisma.crawlRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        error,
        completedAt: new Date(),
      },
    });
  }

  private toLegacyStatus(status: string): 'pending' | 'running' | 'completed' | 'failed' {
    if (status === 'RUNNING') return 'running';
    if (status === 'COMPLETED') return 'completed';
    if (status === 'FAILED') return 'failed';
    return 'pending';
  }
}

export const pipelineService = new PipelineService();
