import type { 
  CollectionTask, 
  CollectionOptions, 
  ITaskManagerService,
  CollectionStatusResponse 
} from '~/types/collection.types';

/**
 * 任务管理服务
 * 负责管理采集任务的状态和进度
 * 使用内存存储，生产环境可替换为Redis或数据库
 */
export class TaskManagerService implements ITaskManagerService {
  private tasks = new Map<string, CollectionTask>();
  
  /**
   * 创建新的采集任务
   */
  async createTask(subjectName: string, options?: CollectionOptions): Promise<string> {
    const taskId = this.generateTaskId();
    const task: CollectionTask = {
      id: taskId,
      subjectName,
      status: 'running',
      progress: {
        step: 'discovering',
        percentage: 0,
        accountsDiscovered: 0,
        articlesCollected: 0,
        articlesProcessed: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.tasks.set(taskId, task);
    console.log(`[TaskManager] 创建任务: ${taskId}, 主体: ${subjectName}`);
    return taskId;
  }
  
  /**
   * 获取特定任务
   */
  getTask(taskId: string): CollectionTask | null {
    return this.tasks.get(taskId) || null;
  }
  
  /**
   * 获取所有任务（可过滤）
   */
  getAllTasks(subjectName?: string): CollectionTask[] {
    const allTasks = Array.from(this.tasks.values());
    
    if (subjectName) {
      return allTasks.filter(task => 
        task.subjectName.toLowerCase().includes(subjectName.toLowerCase())
      );
    }
    
    return allTasks;
  }
  
  /**
   * 更新任务进度
   */
  async updateTaskProgress(taskId: string, progress: Partial<CollectionTask['progress']>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.progress = { ...task.progress, ...progress };
      task.updatedAt = new Date();
      
      console.log(`[TaskManager] 更新任务进度: ${taskId}, 步骤: ${task.progress.step}, 进度: ${task.progress.percentage}`);
    }
  }
  
  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId: string, status: CollectionTask['status'], error?: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (error) {
        task.error = error;
      }
      task.updatedAt = new Date();
      
      console.log(`[TaskManager] 更新任务状态: ${taskId}, 状态: ${status}${error ? `, 错误: ${error}` : ''}`);
    }
  }
  
  /**
   * 获取状态汇总
   */
  async getStatus(taskId?: string, subjectName?: string): Promise<CollectionStatusResponse> {
    let tasks = this.getAllTasks(subjectName);
    
    if (taskId) {
      const specificTask = this.getTask(taskId);
      tasks = specificTask ? [specificTask] : [];
    }
    
    const summary = {
      totalTasks: tasks.length,
      runningTasks: tasks.filter(t => t.status === 'running').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length
    };
    
    return { tasks, summary };
  }
  
  /**
   * 清理过期任务（保留最近24小时）
   */
  cleanupExpiredTasks(): void {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let cleanedCount = 0;
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.updatedAt < twentyFourHoursAgo && 
          (task.status === 'completed' || task.status === 'failed')) {
        this.tasks.delete(taskId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[TaskManager] 清理了 ${cleanedCount} 个过期任务`);
    }
  }
  
  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `collect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 创建单例实例
export const taskManagerService = new TaskManagerService();

// 定期清理过期任务
setInterval(() => {
  taskManagerService.cleanupExpiredTasks();
}, 60 * 60 * 1000); // 每小时清理一次
