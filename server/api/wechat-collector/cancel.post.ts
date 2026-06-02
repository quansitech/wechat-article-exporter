import { pipelineService } from '~/server/extensions/wechat-collector/services/pipeline.service';

/**
 * POST /api/wechat-collector/cancel
 * 取消正在运行的采集任务
 */
export default defineEventHandler(async event => {
  try {
    // 读取请求体
    const body = await readBody<{ taskId: string }>(event);

    // 验证请求参数
    if (!body.taskId || body.taskId.trim() === '') {
      throw new Error('任务ID不能为空');
    }

    const taskId = body.taskId.trim();
    console.log(`[API] 收到取消任务请求: ${taskId}`);

    // 取消任务
    await pipelineService.cancelTask(taskId);

    // 返回成功响应
    return {
      status: 'success',
      message: `任务已取消: ${taskId}`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[API] 取消任务失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    // 返回错误响应
    return {
      status: 'error',
      message: `取消任务失败: ${errorMessage}`,
      timestamp: new Date().toISOString(),
    };
  }
});
