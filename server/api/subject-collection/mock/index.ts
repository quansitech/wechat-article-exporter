/**
 * Mock数据配置
 * 通过环境变量 MOCK_MODE=true 开启Mock模式
 */

export const MOCK_MODE = process.env.MOCK_MODE === 'true';

// Mock数据存储
export const mockData = {
  accounts: [
    {
      fakeid: "mock_biz_001",
      nickname: "测试公众号1",
      round_head_img: "https://example.com/avatar1.jpg",
      service_type: 1,
      signature: "这是一个测试公众号的描述",
      alias: "test_account_1"
    },
    {
      fakeid: "mock_biz_002", 
      nickname: "测试公众号2",
      round_head_img: "https://example.com/avatar2.jpg",
      service_type: 1,
      signature: "这是另一个测试公众号的描述",
      alias: "test_account_2"
    }
  ],
  
  articles: [
    {
      aid: "mock_article_001",
      title: "测试文章标题1",
      link: "https://mp.weixin.qq.com/s/mock1",
      create_time: 1700000000,
      update_time: 1700000000,
      author_name: "测试作者",
      digest: "这是第一篇文章的摘要内容，用于测试目的。",
      copyright_stat: 1,
      copyright_type: 1,
      cover: "https://example.com/cover1.jpg",
      item_show_type: 1,
      appmsg_album_infos: []
    },
    {
      aid: "mock_article_002",
      title: "测试文章标题2", 
      link: "https://mp.weixin.qq.com/s/mock2",
      create_time: 1700086400,
      update_time: 1700086400,
      author_name: "测试作者",
      digest: "这是第二篇文章的摘要内容，包含更多详细信息。",
      copyright_stat: 0,
      copyright_type: 0,
      cover: "https://example.com/cover2.jpg",
      item_show_type: 1,
      appmsg_album_infos: []
    },
    {
      aid: "mock_article_003",
      title: "测试文章标题3",
      link: "https://mp.weixin.qq.com/s/mock3", 
      create_time: 1700172800,
      update_time: 1700172800,
      author_name: "测试作者",
      digest: "这是第三篇文章的摘要，用于展示不同的内容类型。",
      copyright_stat: 1,
      copyright_type: 1,
      cover: "https://example.com/cover3.jpg",
      item_show_type: 2,
      appmsg_album_infos: []
    }
  ]
};

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
