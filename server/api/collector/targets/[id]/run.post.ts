import { pipelineService } from '~/server/extensions/wechat-collector/services/pipeline.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

export default defineEventHandler(async event => {
  try {
    const id = getRouterParam(event, 'id');
    if (!id) {
      throw new Error('监控目标 ID 不能为空');
    }
    const crawlRunId = await pipelineService.runTarget(id, 'manual');
    return ok({ crawlRunId });
  } catch (error) {
    return fail('RUN_TARGET_FAILED', errorMessage(error));
  }
});
