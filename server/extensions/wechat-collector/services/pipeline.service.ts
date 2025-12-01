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
  /**
   * 启动采集任务
   * 创建任务并异步执行完整流水线
   */
  async startCollection(subjectName: string, options?: CollectionOptions): Promise<string> {
    console.log(`[Pipeline] 启动采集任务，主体: ${subjectName}`);
    
    try {
      // 创建任务记录
      const taskId = await taskManagerService.createTask(subjectName, options);
      
      // 异步执行采集流水线（不阻塞API响应）
      this.executePipeline(taskId, subjectName, options).catch(error => {
        console.error(`[Pipeline] 采集任务失败: ${taskId}`, error);
        taskManagerService.updateTaskStatus(taskId, 'failed', error.message);
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
  private async executePipeline(taskId: string, subjectName: string, options?: CollectionOptions): Promise<void> {
    console.log(`[Pipeline] 开始执行流水线: ${taskId}`);
    
    try {
      // 阶段一：账号发现
      console.log(`[Pipeline] 阶段一：账号发现`);
      const accounts = await this.executeAccountDiscovery(taskId, subjectName);
      
      if (accounts.length === 0) {
        throw new Error(`未找到与"${subjectName}"相关的公众号`);
      }
      
      // 阶段二：链接采集
      console.log(`[Pipeline] 阶段二：链接采集`);
      const articles = await this.executeArticleCollection(taskId, accounts, options);
      
      if (articles.length === 0) {
        throw new Error(`未采集到新的文章`);
      }
      
      // 阶段三：内容处理
      console.log(`[Pipeline] 阶段三：内容处理`);
      await this.executeContentProcessing(taskId, articles, options);
      
      // 任务完成
      console.log(`[Pipeline] 采集任务完成: ${taskId}`);
      await taskManagerService.updateTaskStatus(taskId, 'completed');
      
    } catch (error) {
      console.error(`[Pipeline] 流水线执行失败: ${taskId}`, error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      await taskManagerService.updateTaskStatus(taskId, 'failed', errorMessage);
    }
  }
  
  /**
   * 执行账号发现阶段
   */
  private async executeAccountDiscovery(taskId: string, subjectName: string): Promise<any[]> {
    console.log(`[Pipeline] 执行账号发现: ${taskId}`);
    
    try {
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
      console.error(`[Pipeline] 账号发现失败:`, error);
      throw new Error(`账号发现失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  /**
   * 执行文章采集阶段
   */
  private async executeArticleCollection(taskId: string, accounts: any[], options?: CollectionOptions): Promise<any[]> {
    console.log(`[Pipeline] 执行文章采集: ${taskId}, 账号数量: ${accounts.length}`);
    
    try {
      // 更新任务进度
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'collecting',
        percentage: 0.33,
        message: '正在采集文章链接...'
      });
      
      // 执行文章采集
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
      console.error(`[Pipeline] 文章采集失败:`, error);
      throw new Error(`文章采集失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  /**
   * 执行内容处理阶段
   */
  private async executeContentProcessing(taskId: string, articles: any[], options?: CollectionOptions): Promise<void> {
    console.log(`[Pipeline] 执行内容处理: ${taskId}, 文章数量: ${articles.length}`);
    
    try {
      // 更新任务进度
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'processing',
        percentage: 0.8,
        message: '文章已入队，正在后台处理...'
      });
      
      // 注意：ArticleCollector 已经将文章加入队列
      // 这里只需要等待队列处理完毕
      
      // 设置并发度 (可选)
      if (options?.concurrency) {
         // contentProcessorService.setConcurrency(options.concurrency); // 需实现
      }

      console.log(`[Pipeline] 等待队列处理完成...`);
      await contentProcessorService.waitForIdle();
      
      // 更新任务进度 - 任务级别完成
      // 具体的成功/失败数量需查询数据库统计，此处简单更新为完成
      await taskManagerService.updateTaskProgress(taskId, {
        step: 'completed',
        percentage: 1.0,
        message: `采集流水线完成`
      });
      
      console.log(`[Pipeline] 内容处理阶段完成`);
      
    } catch (error) {
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
    const task = taskManagerService.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    
    // 可以在这里添加更多任务详情信息
    return {
      task,
      // 可以添加账号信息、文章统计等
    };
  }
  
  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = taskManagerService.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    
    if (task.status === 'running') {
      // 更新任务状态为失败（取消）
      await taskManagerService.updateTaskStatus(taskId, 'failed', '任务被取消');
      console.log(`[Pipeline] 任务已取消: ${taskId}`);
    } else {
      throw new Error(`无法取消非运行中的任务: ${task.status}`);
    }
  }
}

// 创建单例实例
export const pipelineService = new PipelineService();
