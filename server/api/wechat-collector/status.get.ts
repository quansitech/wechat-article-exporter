import { pipelineService } from '~/server/extensions/wechat-collector/services/pipeline.service';
import type { CollectionStatusResponse, StatusQuery } from '~/types/collection.types';

export default defineEventHandler(async (event): Promise<CollectionStatusResponse> => {
  try {
    const query = getQuery<StatusQuery>(event);

    const taskId = query.taskId as string | undefined;
    const subjectName = query.subjectName as string | undefined;

    console.log(`[API] 查询任务状态，任务ID: ${taskId || '全部'}, 主体: ${subjectName || '全部'}`);

    const status = await pipelineService.getStatus(taskId, subjectName);

    console.log(`[API] 返回状态信息，任务数量: ${status.tasks.length}`);

    return status;
  } catch (error) {
    console.error('[API] 查询任务状态失败:', error);

    return {
      tasks: [],
      summary: {
        totalTasks: 0,
        runningTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
      },
    };
  }
});
