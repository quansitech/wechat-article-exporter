import { MOCK_MODE, getMockAuthorInfo } from '../index';

export default defineEventHandler(async (event) => {
  if (!MOCK_MODE) {
    // 如果不是Mock模式，转发到真实API
    return await $fetch<{ base_resp: { ret: number; err_msg: string } }>('/api/public/beta/authorinfo', {
      method: 'GET',
      query: getQuery(event)
    });
  }

  const query = getQuery(event);
  const biz = query.biz as string;
  
  if (!biz) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'biz参数不能为空'
      }
    };
  }

  return getMockAuthorInfo(biz);
});