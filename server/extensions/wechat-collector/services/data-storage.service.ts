/**
 * 数据存储服务 - 专注于数据持久化
 * 替代原有的 updateAPICache，记录到SQLite/PostgreSQL
 */
export class DataStorageService {
  /**
   * 记录API调用到数据库
   * 替代原有的 updateAPICache，记录到SQLite/PostgreSQL
   */
  async recordAPICall(apiName: string, payload: any, isNormal: boolean, taskId?: string, subjectName?: string): Promise<void> {
    try {
      const record = {
        api_name: apiName,
        payload: JSON.stringify(payload),
        is_normal: isNormal,
        call_time: new Date(),
        task_id: taskId,
        subject_name: subjectName,
        // 可以添加更多字段：用户ID、IP地址等
      };
      
      console.log(`[DataStorageService] 记录API调用: ${apiName}`, {
        payload,
        isNormal,
        taskId,
        subjectName,
        timestamp: record.call_time
      });
      
      // TODO: 实现数据库操作
      // 这里可以记录到SQLite或PostgreSQL
      // await db.collection('api_calls').insert(record);
      
      // 临时实现：写入日志文件
      await this.writeToLogFile('api_calls', record);
      
    } catch (error) {
      console.warn('[DataStorageService] 记录API调用失败:', error);
      // 不影响主要功能，记录失败可以忽略
    }
  }
  
  /**
   * 记录采集任务状态
   */
  async recordTaskStatus(taskId: string, status: string, progress: any, error?: string): Promise<void> {
    try {
      const record = {
        task_id: taskId,
        status,
        progress: JSON.stringify(progress),
        error,
        updated_at: new Date(),
      };
      
      console.log(`[DataStorageService] 记录任务状态: ${taskId}`, {
        status,
        progress,
        error
      });
      
      // TODO: 实现数据库操作
      // await db.collection('task_status').insert(record);
      
      // 临时实现：写入日志文件
      await this.writeToLogFile('task_status', record);
      
    } catch (error) {
      console.warn('[DataStorageService] 记录任务状态失败:', error);
    }
  }
  
  /**
   * 记录采集结果
   */
  async recordCollectionResult(
    taskId: string, 
    subjectName: string, 
    accounts: any[], 
    articles: any[], 
    successCount: number, 
    failedCount: number
  ): Promise<void> {
    try {
      const record = {
        task_id: taskId,
        subject_name: subjectName,
        accounts_count: accounts.length,
        articles_count: articles.length,
        success_count: successCount,
        failed_count: failedCount,
        completed_at: new Date(),
      };
      
      console.log(`[DataStorageService] 记录采集结果: ${taskId}`, {
        subjectName,
        accountsCount: accounts.length,
        articlesCount: articles.length,
        successCount,
        failedCount
      });
      
      // TODO: 实现数据库操作
      // await db.collection('collection_results').insert(record);
      
      // 临时实现：写入日志文件
      await this.writeToLogFile('collection_results', record);
      
    } catch (error) {
      console.warn('[DataStorageService] 记录采集结果失败:', error);
    }
  }
  
  /**
   * 查询任务历史
   */
  async getTaskHistory(subjectName?: string, limit = 10): Promise<any[]> {
    try {
      console.log(`[DataStorageService] 查询任务历史: ${subjectName || '全部'}, limit: ${limit}`);
      
      // TODO: 实现数据库查询
      // const query: any = {};
      // if (subjectName) {
      //   query.subject_name = subjectName;
      // }
      // return await db.collection('collection_results')
      //   .find(query)
      //   .sort({ completed_at: -1 })
      //   .limit(limit)
      //   .toArray();
      
      // 临时实现：返回空数组
      return [];
      
    } catch (error) {
      console.warn('[DataStorageService] 查询任务历史失败:', error);
      return [];
    }
  }
  
  /**
   * 获取API调用统计
   */
  async getAPIStats(days = 7): Promise<any> {
    try {
      console.log(`[DataStorageService] 获取API调用统计: 最近${days}天`);
      
      // TODO: 实现数据库统计查询
      // const startDate = new Date();
      // startDate.setDate(startDate.getDate() - days);
      // 
      // return await db.collection('api_calls')
      //   .aggregate([
      //     { $match: { call_time: { $gte: startDate } } },
      //     { $group: { 
      //       _id: '$api_name', 
      //       total: { $sum: 1 },
      //       success: { $sum: { $cond: ['$is_normal', 1, 0] } },
      //       failed: { $sum: { $cond: ['$is_normal', 0, 1] } }
      //     }}
      //   ])
      //   .toArray();
      
      // 临时实现：返回空统计
      return [];
      
    } catch (error) {
      console.warn('[DataStorageService] 获取API调用统计失败:', error);
      return [];
    }
  }
  
  /**
   * 写入日志文件（临时实现）
   */
  private async writeToLogFile(collection: string, data: any): Promise<void> {
    try {
      // 临时实现：在控制台输出
      console.log(`[DataStorageService-Log] ${collection}:`, JSON.stringify(data, null, 2));
      
      // 实际实现时可以写入文件系统
      // const logDir = './logs/collections';
      // await fs.mkdir(logDir, { recursive: true });
      // const logFile = path.join(logDir, `${collection}.log`);
