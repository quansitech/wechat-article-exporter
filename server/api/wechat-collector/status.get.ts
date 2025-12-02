import type { StatusQuery, CollectionStatusResponse } from '~/types/collection.types';
import { pipelineService } from '~/server/extensions/wechat-collector/services/pipeline.service';

/**
 * GET /api/wechat-collector/status
 * 获取采集任务状态
 */
export default defineEventHandler(async (event): Promise<CollectionStatusResponse> => {
  try {
    // 读取查询参数
    const query = getQuery<StatusQuery>(event);

    const taskId = query.taskId as string | undefined;
    const subjectName = query.subjectName as string | undefined;

    console.log(`[API] 查询任务状态，任务ID: ${taskId || '全部'}, 主体: ${subjectName || '全部'}`);

    // 获取任务状态
    const status = await pipelineService.getStatus(taskId, subjectName);

    console.log(`[API] 返回状态信息，任务数量: ${status.tasks.length}`);

    return status;

  } catch (error) {
    console.error('[API] 查询任务状态失败:', error);

    const errorMessage = error instanceof Error ? error.message : '未知错误';

    // 返回错误响应（空的任务列表）
    return {
      tasks: [],
      summary: {
        totalTasks: 0,
        runningTasks: 0,
        completedTasks: 0,
        failedTasks: 0
      }
    };
  }
});
