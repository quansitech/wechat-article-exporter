import { mockConfig } from '~/config/mock';
import { authProvider } from '~/server/extensions/wechat-collector/services/auth-provider.service';
import { errorMessage, fail, ok } from '~/server/extensions/wechat-collector/utils/api-response';

export default defineEventHandler(async event => {
  try {
    if (mockConfig.enabled) {
      await authProvider.isValid();
      return ok({ refreshed: true });
    }

    const body = (await readBody<{ token?: string; cookies?: string }>(event)) || {};
    if (!body.token || !body.cookies) {
      throw new Error('token 和 cookies 不能为空');
    }
    await authProvider.update(body.token, body.cookies);
    return ok({ refreshed: true });
  } catch (error) {
    return fail('AUTH_REFRESH_FAILED', errorMessage(error));
  }
});
