import { MOCK_MODE, getMockArticles } from '../index';
import type { AccountInfo, AppMsgEx } from '~/types/types';

export default defineEventHandler(async (event) => {
  if (!MOCK_MODE) {
    // 如果不是Mock模式，转发到真实API
    return await $fetch<{ base_resp: { ret: number; err_msg: string }; articles: AppMsgEx[] }>('/api/public/v1/article', {
      method: 'GET',
      query: getQuery(event)
    });
  }

  const query = getQuery(event);
  const fakeid = query.fakeid as string;
  const begin = parseInt(query.begin as string) || 0;
  const size = parseInt(query.size as string) || 10;
  const keyword = query.keyword as string;

  if (!fakeid) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'fakeid参数不能为空'
      }
    };
  }

  // 模拟文章列表
  let articles = getMockArticles();
  
  // 模拟关键词搜索
  if (keyword) {
    articles = articles.filter(article => 
      article.title.toLowerCase().includes(keyword.toLowerCase()) ||
      article.digest.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 模拟分页
  const paginatedArticles = articles.slice(begin, begin + size);

  return {
    base_resp: {
      ret: 0,
      err_msg: 'ok'
    },
    articles: paginatedArticles,
    total: articles.length
  };
});
