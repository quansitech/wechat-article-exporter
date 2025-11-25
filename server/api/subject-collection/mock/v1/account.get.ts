import { MOCK_MODE, getMockAccounts } from '../index';
import type { AccountInfo, AppMsgEx } from '~/types/types';

export default defineEventHandler(async (event) => {
  if (!MOCK_MODE) {
    // 如果不是Mock模式，转发到真实API
    return await $fetch<{ base_resp: { ret: number; err_msg: string }; list: AccountInfo[] }>('/api/public/v1/account', {
      method: 'GET',
      query: getQuery(event)
    });
  }

  const query = getQuery(event);
  const keyword = query.keyword as string;
  
  // 模拟搜索逻辑
  const accounts = getMockAccounts();
  const filteredAccounts = keyword 
    ? accounts.filter(account => 
        account.nickname.toLowerCase().includes(keyword.toLowerCase()) ||
        account.signature.toLowerCase().includes(keyword.toLowerCase())
      )
    : accounts;

  return {
    base_resp: {
      ret: 0,
      err_msg: 'ok'
    },
    list: filteredAccounts,
    total: filteredAccounts.length
  };
});
