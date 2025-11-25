import { MOCK_MODE } from '../index';

export default defineEventHandler(async (event) => {
  if (!MOCK_MODE) {
    // 如果不是Mock模式，转发到真实API
    return await $fetch('/api/public/v1/download', {
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

  // 根据URL生成不同的Mock内容
  const articleId = url.split('/').pop() || 'unknown';
  
  const mockMarkdown = `# 测试文章标题

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

  const mockHtml = `<h1>测试文章标题</h1>
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

  const mockText = `测试文章标题

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

  switch (format.toLowerCase()) {
    case 'html':
      return mockHtml;
    case 'text':
      return mockText;
    case 'markdown':
      return mockMarkdown;
    default:
      return {
        base_resp: {
          ret: -1,
          err_msg: `不支持的format: ${format}`
        }
      };
  }
});
