import { monitorTargetService } from '~/server/extensions/wechat-collector/services/monitor-target.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

export default defineEventHandler(async () => {
  try {
    return ok(await monitorTargetService.list());
  } catch (error) {
    return fail('LIST_TARGETS_FAILED', errorMessage(error));
  }
});
