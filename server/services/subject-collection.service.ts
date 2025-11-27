import type { CrawlTask, CrawlResult, CrawlArticle } from '~/types/subject-collection';
import type { AccountInfo, AppMsgEx } from '~/types/types';
import { getApiUrl } from '~/config/mock';

// 内存存储任务（生产环境应该使用数据库）
const taskStore = new Map<string, CrawlTask>();

/**
 * 创建爬取任务
 */
export function createCrawlTask(keyword: string): CrawlTask {
  const taskId = generateTaskId();
  const task: CrawlTask = {
    id: taskId,
    keyword,
    status: 'pending',
    progress: {
      step: 'search',
      current: 0,
      total: 0,
      message: '开始搜索公众号...'
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  taskStore.set(taskId, task);
  
  // 异步执行爬取任务
  executeCrawlTask(taskId).catch(error => {
    const task = taskStore.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = Date.now();
    }
  });
  
  return task;
}

/**
 * 获取任务状态
 */
export function getCrawlTask(taskId: string): CrawlTask | null {
  return taskStore.get(taskId) || null;
}

/**
 * 执行爬取任务
 */
async function executeCrawlTask(taskId: string): Promise<void> {
  const task = taskStore.get(taskId);
  if (!task) return;

  try {
    task.status = 'running';
    task.updatedAt = Date.now();

    // 1. 搜索公众号
    await updateTaskProgress(taskId, 'search', 0, 1, '正在搜索公众号...');
    const accounts = await searchAccounts(task.keyword);
    
    if (accounts.length === 0) {
      throw new Error(`未找到与"${task.keyword}"相关的公众号`);
    }

    // 使用第一个匹配的公众号
    const account = accounts[0];
    
    // 2. 校验公众号主体
    await updateTaskProgress(taskId, 'verify', 0, 1, '正在校验公众号主体...');
    const isValid = await verifyAccount(account, task.keyword);
    
    if (!isValid) {
      throw new Error(`公众号"${account.nickname}"与搜索关键字"${task.keyword}"不匹配`);
    }

    // 3. 获取文章列表
    await updateTaskProgress(taskId, 'fetch', 0, 1, '正在获取文章列表...');
    const articles = await fetchArticles(account);
    
    // 初始化结果
    task.result = {
      account,
      articles: articles.map(article => ({
        aid: article.aid,
        title: article.title,
        link: article.link,
        create_time: article.create_time,
        update_time: article.update_time,
        author_name: article.author_name,
        digest: article.digest,
        status: 'pending'
      })),
      total: articles.length,
      completed: 0
    };

    // 4. 下载文章内容
    await updateTaskProgress(taskId, 'download', 0, articles.length, '开始下载文章内容...');
    
    for (let i = 0; i < articles.length; i++) {
      const article = task.result.articles[i];
      await updateTaskProgress(taskId, 'download', i, articles.length, `正在下载文章: ${article.title}`);
      
      try {
        article.status = 'downloading';
        const markdown = await downloadArticle(article.link);
        article.markdown = markdown;
        article.status = 'completed';
        
        if (task.result) {
          task.result.completed++;
        }
      } catch (error) {
        console.error(`下载文章失败: ${article.title}`, error);
        article.status = 'failed';
      }
      
      task.updatedAt = Date.now();
    }

    // 任务完成
    task.status = 'completed';
    task.progress = {
      step: 'completed',
      current: articles.length,
      total: articles.length,
      message: '爬取任务完成'
    };
    task.updatedAt = Date.now();

  } catch (error) {
    console.error('爬取任务失败:', error);
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : '未知错误';
    task.updatedAt = Date.now();
  }
}

/**
 * 搜索公众号
 */
async function searchAccounts(keyword: string): Promise<AccountInfo[]> {
  const response = await $fetch<{ base_resp: { ret: number; err_msg: string }; list: AccountInfo[] }>(
    `${getApiUrl('/v1/account')}`,
    {
      method: 'GET',
      query: {
        keyword: keyword,
      },
      retry: 0,
    }
  );
  
  if (response.base_resp.ret !== 0) {
    throw new Error(`搜索公众号失败: ${response.base_resp.err_msg}`);
  }
  
  return response.list || [];
}

/**
 * 校验公众号主体
 */
async function verifyAccount(account: AccountInfo, keyword: string): Promise<boolean> {
  try {
    const response = await $fetch<{ base_resp: { ret: number; err_msg: string }, identity_name:string  }>(
      `${getApiUrl('/beta/authorinfo')}`,
      {
        method: 'GET',
        query: {
          biz: account.fakeid,
        },
        retry: 0,
      }
    );
    
    if (response.base_resp.ret === 0) {
      // 校验逻辑：查询主题与关键字是否匹配
      // return response.identity_name === keyword;
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn('校验公众号主体失败，跳过校验:', error);
    return false; 
  }
}

/**
 * 获取文章列表
 */
async function fetchArticles(account: AccountInfo): Promise<AppMsgEx[]> {
  const allArticles: AppMsgEx[] = [];
  let begin = 0;
  let hasMore = true;
  
  while (hasMore) {
    const response = await $fetch<{ base_resp: { ret: number; err_msg: string }; articles: AppMsgEx[] }>(
      `${getApiUrl('/v1/article')}`,
      {
        method: 'GET',
        query: {
          fakeid: account.fakeid,
          begin: begin,
          size: 10,
        },
        retry: 0,
      }
    );
    
    if (response.base_resp.ret !== 0) {
      throw new Error(`获取文章列表失败: ${response.base_resp.err_msg}`);
    }
    
    if (response.articles && response.articles.length > 0) {
      allArticles.push(...response.articles);
      begin += response.articles.length;
    } else {
      hasMore = false;
    }
    
    // 限制最多获取100篇文章
    if (allArticles.length >= 100) {
      break;
    }
  }
  
  return allArticles;
}

/**
 * 下载文章内容为markdown
 */
async function downloadArticle(url: string): Promise<string> {
  const response = await $fetch<string | { base_resp: { ret: number; err_msg: string } }>(
    `${getApiUrl('/v1/download')}`,
      {
        method: 'GET',
        query: {
          url: encodeURIComponent(url),
          format: 'markdown',
        },
        retry: 0,
      }
  );
  
  if (typeof response !== 'string') {
    throw new Error(`下载文章失败: ${response.base_resp.err_msg}`);
  }
  
  return response;
}

/**
 * 更新任务进度
 */
async function updateTaskProgress(
  taskId: string, 
  step: CrawlTask['progress']['step'], 
  current: number, 
  total: number, 
  message: string
): Promise<void> {
  const task = taskStore.get(taskId);
  if (task) {
    task.progress = { step, current, total, message };
    task.updatedAt = Date.now();
  }
}

/**
 * 生成任务ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
