import { MOCK_MODE } from '../index';
import { mockUtils } from '~/config/mock';

export default defineEventHandler(async (event) => {
  if (!MOCK_MODE) {
    // 如果不是Mock模式，转发到真实API
    return await $fetch<string | { base_resp: { ret: number; err_msg: string } }>('/api/public/v1/download', {
      method: 'GET',
      query: getQuery(event)
    });
  }

  const query = getQuery(event);
  const url = query.url as string;
  const format = (query.format as string) || 'markdown';

  if (!url) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'url参数不能为空'
      }
    };
  }

  // 使用统一的Mock内容生成器
  switch (format.toLowerCase()) {
    case 'html':
      return mockUtils.generateHtml(url);
    case 'text':
      return mockUtils.generateText(url);
    case 'markdown':
      return mockUtils.generateMarkdown(url);
    default:
      return {
        base_resp: {
          ret: -1,
          err_msg: `不支持的format: ${format}`
        }
      };
  }
});
