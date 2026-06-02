import { contentProcessorService } from '~/server/extensions/wechat-collector/services/content-processor.service';
import { recoverCollectorState } from '~/server/extensions/wechat-collector/services/database.service';
import { schedulerService } from '~/server/extensions/wechat-collector/services/scheduler.service';
import { wechatApiClient } from '~/server/extensions/wechat-collector/utils/wechat-api-client';

export default defineNitroPlugin(async () => {
  await recoverCollectorState();
  wechatApiClient.initAuth();
  await contentProcessorService.initialize();
  schedulerService.start();
});
