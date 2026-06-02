import { authProvider } from '~/server/extensions/wechat-collector/services/auth-provider.service';
import { contentProcessorService } from '~/server/extensions/wechat-collector/services/content-processor.service';
import { checkDatabase } from '~/server/extensions/wechat-collector/services/database.service';
import { schedulerService } from '~/server/extensions/wechat-collector/services/scheduler.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

const startedAt = Date.now();

export default defineEventHandler(async () => {
  try {
    await authProvider.isValid();
    return ok({
      database: await checkDatabase(),
      auth: authProvider.getStatus(),
      queue: contentProcessorService.getQueueStats(),
      scheduler: await schedulerService.getStatus(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    });
  } catch (error) {
    return fail('HEALTH_CHECK_FAILED', errorMessage(error));
  }
});
