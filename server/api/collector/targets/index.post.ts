import { monitorTargetService } from '~/server/extensions/wechat-collector/services/monitor-target.service';
import { validateWebhookUrl } from '~/server/extensions/wechat-collector/utils/webhook-url-validator';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

export default defineEventHandler(async event => {
  try {
    const body = await readBody<{
      subjectName?: string;
      checkIntervalMinutes?: number;
      webhookUrl?: string;
    }>(event);

    // 验证 webhookUrl 安全性（SSRF 防护）
    if (body.webhookUrl) {
      try {
        validateWebhookUrl(body.webhookUrl);
      } catch (error) {
        return fail('INVALID_WEBHOOK_URL', error instanceof Error ? error.message : 'Invalid webhook URL');
      }
    }

    const target = await monitorTargetService.create({
      subjectName: body.subjectName || '',
      checkIntervalMinutes: body.checkIntervalMinutes,
      webhookUrl: body.webhookUrl,
    });
    return ok(target);
  } catch (error) {
    return fail('CREATE_TARGET_FAILED', errorMessage(error));
  }
});
