import type {
  CollectionOptions,
  CollectionStatusResponse,
  CollectionTask,
  ITaskManagerService,
} from '~/types/collection.types';
import { prisma } from './database.service';

/**
 * 任务管理服务
 * 负责管理采集任务的状态和进度
 * 使用数据库存储，支持持久化
 */
export class TaskManagerService implements ITaskManagerService {
  /**
   * 创建新的采集任务
   */
  async createTask(subjectName: string, options?: CollectionOptions): Promise<string> {
    const taskId = this.generateTaskId();

    const initialProgress = {
      step: 'discovering',
      percentage: 0,
      accountsDiscovered: 0,
      articlesCollected: 0,
      articlesProcessed: 0,
      message: '任务初始化...',
    };

    await prisma.collectionTask.create({
      data: {
        id: taskId,
        subjectName,
        status: 'running',
        progress: JSON.stringify(initialProgress),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`[TaskManager] 创建任务: ${taskId}, 主体: ${subjectName}`);
    return taskId;
  }

  /**
   * 获取特定任务
   */
  async getTask(taskId: string): Promise<CollectionTask | null> {
    const task = await prisma.collectionTask.findUnique({
      where: { id: taskId },
    });

    if (!task) return null;

    return this.mapPrismaTaskToCollectionTask(task);
  }

  /**
   * 获取所有任务（可过滤）
   */
  async getAllTasks(subjectName?: string): Promise<CollectionTask[]> {
    const where: any = {};
    if (subjectName) {
      where.subjectName = { contains: subjectName };
    }

    const tasks = await prisma.collectionTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(t => this.mapPrismaTaskToCollectionTask(t));
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId: string, progress: Partial<CollectionTask['progress']>): Promise<void> {
    try {
      const task = await prisma.collectionTask.findUnique({ where: { id: taskId } });
      if (!task) return;

      const currentProgress = JSON.parse(task.progress);
      const newProgress = { ...currentProgress, ...progress };

      await prisma.collectionTask.update({
        where: { id: taskId },
        data: {
          progress: JSON.stringify(newProgress),
          updatedAt: new Date(),
        },
      });

      console.log(`[TaskManager] 更新任务进度: ${taskId}, 步骤: ${newProgress.step}, 进度: ${newProgress.percentage}`);
    } catch (error) {
      console.error(`[TaskManager] 更新进度失败: ${taskId}`, error);
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId: string, status: CollectionTask['status'], error?: string): Promise<void> {
    try {
      await prisma.collectionTask.update({
        where: { id: taskId },
        data: {
          status,
          error: error || null,
          updatedAt: new Date(),
        },
      });

      console.log(`[TaskManager] 更新任务状态: ${taskId}, 状态: ${status}${error ? `, 错误: ${error}` : ''}`);
    } catch (error) {
      console.error(`[TaskManager] 更新状态失败: ${taskId}`, error);
    }
  }

  /**
   * 获取状态汇总
   */
  async getStatus(taskId?: string, subjectName?: string): Promise<CollectionStatusResponse> {
    let tasks: CollectionTask[] = [];

    if (taskId) {
      const task = await this.getTask(taskId);
      if (task) tasks.push(task);
    } else {
      tasks = await this.getAllTasks(subjectName);
    }

    const summary = {
      totalTasks: tasks.length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
    };

    return { tasks, summary };
  }

  /**
   * 清理过期任务（保留最近24小时）
   */
  async cleanupExpiredTasks(): Promise<void> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.collectionTask.deleteMany({
        where: {
          updatedAt: { lt: twentyFourHoursAgo },
          status: { in: ['completed', 'failed'] }, // 只清理非运行状态的任务
        },
      });

      if (result.count > 0) {
        console.log(`[TaskManager] 清理了 ${result.count} 个过期任务`);
      }
    } catch (error) {
      console.error(`[TaskManager] 清理过期任务失败:`, error);
    }
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `collect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 映射数据库模型到类型
   */
  private mapPrismaTaskToCollectionTask(prismaTask: any): CollectionTask {
    return {
      id: prismaTask.id,
      subjectName: prismaTask.subjectName,
      status: prismaTask.status as any,
      progress: JSON.parse(prismaTask.progress),
      error: prismaTask.error || undefined,
      createdAt: prismaTask.createdAt,
      updatedAt: prismaTask.updatedAt,
    };
  }
}

// 创建单例实例
export const taskManagerService = new TaskManagerService();
