import type { StartCollectionRequest, StartCollectionResponse } from '~/types/collection.types';
import { pipelineService } from '../services/pipeline.service';

/**
 * POST /api/extensions/wechat-collector/start
 * 启动微信公众号采集任务
 */
export default defineEventHandler(async (event): Promise<StartCollectionResponse> => {
  try {
    // 读取请求体
    const body = await readBody<StartCollectionRequest>(event);
    
    // 验证请求参数
    if (!body.subjectName || body.subjectName.trim() === '') {
      throw new Error('主体名称不能为空');
    }
    
    const subjectName = body.subjectName.trim();
    const options = body.options;
    
    console.log(`[API] 收到采集请求，主体: ${subjectName}`, options);
    
    // 启动采集任务
    const taskId = await pipelineService.startCollection(subjectName, options);
    
    // 返回成功响应
    return {
      taskId,
      status: 'started',
      message: `采集任务已启动: ${taskId}`
    };
    
  } catch (error) {
    console.error('[API] 启动采集任务失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    // 返回错误响应
    return {
      taskId: '',
      status: 'error',
      message: `启动采集任务失败: ${errorMessage}`
    };
  }
});
