/**
 * Mock数据配置
 * 通过环境变量 MOCK_MODE=true 开启Mock模式
 * 使用统一的Mock数据源，避免数据重复
 */

import { mockConfig, mockUtils } from '~/config/mock';

export const MOCK_MODE = process.env.MOCK_MODE === 'true';

// 使用统一的Mock数据源
export const mockData = mockConfig.data;

// 获取Mock数据
export function getMockAccounts() {
  return mockData.accounts;
}

export function getMockArticles(fakeid?: string) {
  return mockData.articles;
}

export function getMockAuthorInfo(biz: string) {
  const account = mockData.accounts.find(acc => acc.fakeid === biz);
  if (account) {
    return {
      base_resp: { ret: 0, err_msg: 'ok' },
      nickname: account.nickname,
      fakeid: account.fakeid,
      signature: account.signature
    };
  }
  return {
    base_resp: { ret: -1, err_msg: '公众号不存在' }
  };
}
