import { pipelineService } from '~/server/extensions/wechat-collector/services/pipeline.service';
import type { StartCollectionRequest, StartCollectionResponse } from '~/types/collection.types';

export default defineEventHandler(async (event): Promise<StartCollectionResponse> => {
  try {
    const body = await readBody<StartCollectionRequest>(event);

    if (!body.subjectName || body.subjectName.trim() === '') {
      throw new Error('主体名称不能为空');
    }

    const subjectName = body.subjectName.trim();
    const options = body.options;

    console.log(`[API] 收到采集请求，主体: ${subjectName}`, options);

    const taskId = await pipelineService.startCollection(subjectName, options);

    return {
      taskId,
      status: 'started',
      message: `采集任务已启动: ${taskId}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[API] 启动采集任务失败:', error);

    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return {
      taskId: '',
      status: 'error',
      message: `启动采集任务失败: ${errorMessage}`,
      timestamp: new Date().toISOString(),
    };
  }
});
