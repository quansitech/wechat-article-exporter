import type {
  AccountInfo,
  AppMsgEx,
  AppMsgPublishResponse,
  PublishInfo,
  PublishPage,
  SearchBizResponse,
} from '~/types/types';

/**
 * API调用服务 - 专注于微信API调用
 * 基于现有 apis/index.ts 逻辑，但移除UI相关依赖
 */
export class APICallService {
  /**
   * 获取公众号列表
   * 基于现有 getAccountList 逻辑，但移除UI依赖
   */
  async getAccountList(begin = 0, keyword = ''): Promise<[AccountInfo[], boolean]> {
    console.log(`[APICallService] 搜索公众号: ${keyword}, begin: ${begin}`);
    
    try {
      const resp = await $fetch<SearchBizResponse>('/api/web/mp/searchbiz', {
        method: 'GET',
        query: {
          begin: begin,
          size: 10, // 采集服务可以使用更大的分页
          keyword: keyword,
        },
        retry: 0,
      });

      if (resp.base_resp.ret === 0) {
        // 公众号判断是否结束的逻辑与文章不太一样
        // 当第一页的结果就少于10个则结束，否则只有当搜索结果为空才表示结束
        const isCompleted = begin === 0 ? resp.total < 10 : resp.total === 0;

        console.log(`[APICallService] 搜索成功，找到 ${resp.list?.length || 0} 个公众号`);
        return [resp.list, isCompleted];
      } else if (resp.base_resp.ret === 200003) {
        throw new Error('session expired');
      } else {
        throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
      }
      
    } catch (error) {
      console.error('[APICallService] 搜索公众号失败:', error);
      throw new Error(`搜索公众号失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  /**
   * 获取文章列表
   * 基于现有 getArticleList 逻辑，但移除UI依赖和缓存逻辑
   * 移除maxArticles限制，实现全量采集
   */
  async getArticleList(account: any, begin = 0, keyword = ''): Promise<[AppMsgEx[], boolean, number]> {
    console.log(`[APICallService] 获取文章: ${account.fakeid}, begin: ${begin}, keyword: ${keyword}`);
    
    try {
      const resp = await $fetch<AppMsgPublishResponse>('/api/web/mp/appmsgpublish', {
        method: 'GET',
        query: {
          id: account.fakeid,
          begin: begin,
          size: 10, // 采集服务可以使用更大的分页
          keyword: keyword,
        },
        retry: 0,
      });

      if (resp.base_resp.ret === 0) {
        const publish_page: PublishPage = JSON.parse(resp.publish_page);
        const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);

        // 返回的文章数量为0就表示已加载完毕
        const isCompleted = publish_list.length === 0;

        const articles = publish_list.flatMap(item => {
          const publish_info: PublishInfo = JSON.parse(item.publish_info);
          return publish_info.appmsgex;
        });
        
        console.log(`[APICallService] 获取文章成功，数量: ${articles.length}, 是否完成: ${isCompleted}`);
        return [articles, isCompleted, publish_page.total_count];
      } else if (resp.base_resp.ret === 200003) {
        throw new Error('session expired');
      } else {
        throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
      }
      
    } catch (error) {
      console.error('[APICallService] 获取文章失败:', error);
      throw new Error(`获取文章失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}

// 创建单例实例
export const apiCallService = new APICallService();
