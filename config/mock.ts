/**
 * Mock配置管理器
 * 统一管理Mock模式的开关和配置
 */

export interface MockConfig {
  enabled: boolean;
  apiPrefix: string;
  data: {
    accounts: any[];
    articles: any[];
    authorinfo: object;
  };
}

// Mock配置
export const mockConfig: MockConfig = {
  enabled: process.env.MOCK_MODE === 'true',
  apiPrefix: '/api/subject-collection/mock',
  data: {
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
    ],
    authorinfo:{
      base_resp: {
        exportkey_token: '',
        ret: 0,
      },
      identity_name: '专心保险经纪有限公司',
      is_verify: 2,
      original_article_count: 3585,
    }
  }
};

// 获取Mock API URL
export function getMockApiUrl(path: string): string {
  return `${mockConfig.apiPrefix}${path}`;
}

// 获取真实API URL
export function getRealApiUrl(path: string): string {
  return `/api/public${path}`;
}

// 根据Mock模式获取API URL
export function getApiUrl(path: string): string {
  return mockConfig.enabled ? getMockApiUrl(path) : getRealApiUrl(path);
}

// Mock工具函数
export const mockUtils = {
  // 获取Mock账户数据
  getAccounts() {
    return mockConfig.data.accounts;
  },
  
  // 获取Mock文章数据
  getArticles() {
    return mockConfig.data.articles;
  },
  
  // 获取Mock作者信息
  getAuthorInfo(biz: string) {
    const account = mockConfig.data.accounts.find(acc => acc.fakeid === biz);
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
  },
  
  // 生成Mock Markdown内容
  generateMarkdown(url: string): string {
    const articleId = url.split('/').pop() || 'unknown';
    
    return `# 测试文章标题

> 本文来自Mock数据，用于调试目的
> 文章ID: ${articleId}
> 生成时间: ${new Date().toISOString()}

## 文章摘要

这是通过Mock数据生成的测试文章内容。您可以使用这个接口来测试爬取流程，而无需依赖真实的微信公众号API。

## 主要内容

### 章节一：介绍

这是第一个章节的内容。在真实环境中，这里会包含微信公众号文章的正文内容。

- 列表项一
- 列表项二  
- 列表项三

### 章节二：详细说明

这是第二个章节的内容，包含更多的详细信息。

1. 有序列表第一项
2. 有序列表第二项
3. 有序列表第三项

### 代码示例

\`\`\`javascript
// 这是一个JavaScript代码示例
function helloWorld() {
  console.log('Hello, Mock World!');
  return 'Mock数据测试成功';
}
\`\`\`

## 总结

这是一个完整的Mock Markdown文档，包含了标题、段落、列表、代码块等常见元素。您可以根据需要修改这些内容来测试不同的场景。

---

*本文为Mock数据，仅用于开发和测试目的*`;
  },

  // 生成Mock HTML内容
  generateHtml(url: string): string {
    const articleId = url.split('/').pop() || 'unknown';
    
    return `<h1>测试文章标题</h1>
<p><em>本文来自Mock数据，用于调试目的</em></p>
<p>文章ID: ${articleId}</p>
<p>生成时间: ${new Date().toISOString()}</p>

<h2>文章摘要</h2>
<p>这是通过Mock数据生成的测试文章内容。您可以使用这个接口来测试爬取流程，而无需依赖真实的微信公众号API。</p>

<h2>主要内容</h2>

<h3>章节一：介绍</h3>
<p>这是第一个章节的内容。在真实环境中，这里会包含微信公众号文章的正文内容。</p>
<ul>
<li>列表项一</li>
<li>列表项二</li>
<li>列表项三</li>
</ul>

<h3>章节二：详细说明</h3>
<p>这是第二个章节的内容，包含更多的详细信息。</p>
<ol>
<li>有序列表第一项</li>
<li>有序列表第二项</li>
<li>有序列表第三项</li>
</ol>

<h3>代码示例</h3>
<pre><code class="language-javascript">// 这是一个JavaScript代码示例
function helloWorld() {
  console.log('Hello, Mock World!');
  return 'Mock数据测试成功';
}
</code></pre>

<h2>总结</h2>
<p>这是一个完整的Mock HTML文档，包含了标题、段落、列表、代码块等常见元素。您可以根据需要修改这些内容来测试不同的场景。</p>

<hr>
<p><em>本文为Mock数据，仅用于开发和测试目的</em></p>`;
  },

  // 生成Mock文本内容
  generateText(url: string): string {
    const articleId = url.split('/').pop() || 'unknown';
    
    return `测试文章标题

本文来自Mock数据，用于调试目的
文章ID: ${articleId}
生成时间: ${new Date().toISOString()}

文章摘要

这是通过Mock数据生成的测试文章内容。您可以使用这个接口来测试爬取流程，而无需依赖真实的微信公众号API。

主要内容

章节一：介绍

这是第一个章节的内容。在真实环境中，这里会包含微信公众号文章的正文内容。

- 列表项一
- 列表项二
- 列表项三

章节二：详细说明

这是第二个章节的内容，包含更多的详细信息。

1. 有序列表第一项
2. 有序列表第二项
3. 有序列表第三项

代码示例

// 这是一个JavaScript代码示例
function helloWorld() {
  console.log('Hello, Mock World!');
  return 'Mock数据测试成功';
}

总结

这是一个完整的Mock文本文档，包含了标题、段落、列表、代码块等常见元素。您可以根据需要修改这些内容来测试不同的场景。

---
本文为Mock数据，仅用于开发和测试目的`;
  }
};
