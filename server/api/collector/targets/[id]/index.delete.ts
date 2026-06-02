import { monitorTargetService } from '~/server/extensions/wechat-collector/services/monitor-target.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

export default defineEventHandler(async event => {
  try {
    const id = getRouterParam(event, 'id');
    if (!id) {
      throw new Error('监控目标 ID 不能为空');
    }
    return ok(await monitorTargetService.disable(id));
  } catch (error) {
    return fail('DELETE_TARGET_FAILED', errorMessage(error));
  }
});
