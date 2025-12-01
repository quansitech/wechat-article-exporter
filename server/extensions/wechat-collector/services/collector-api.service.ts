import type {
  AccountInfo,
  AppMsgEx,
  AppMsgPublishResponse,
  PublishInfo,
  PublishPage,
  SearchBizResponse,
} from '~/types/types';
import { registerTokenHook, registerCookieHook } from '~/server/utils/CookieStore';
import { getAuthFromFile } from '~/server/utils/auth-file';

/**
 * 采集服务专用的API调用服务
 * 基于现有 apis/index.ts 逻辑，但移除UI相关依赖
 * 添加数据库记录功能，替代 updateAPICache
 */
export class CollectorAPIService {
  private mockMode = process.env.USE_MOCK === 'true';
  
  constructor() {
    // 注册文件认证钩子
    this.registerAuthHooks();
  }
  
  /**
   * 注册文件认证钩子
   */
  private registerAuthHooks(): void {
    registerTokenHook(async (event) => {
      return getAuthFromFile().token;
    });

    registerCookieHook(async (event) => {
      return getAuthFromFile().cookies;
    });
    
    console.log('[CollectorAPIService] 文件认证钩子已注册');
  }
  
  /**
   * 获取公众号列表
   * 基于现有 getAccountList 逻辑，但移除UI依赖
   */
  async getAccountList(begin = 0, keyword = ''): Promise<[AccountInfo[], boolean]> {
    if (this.mockMode) {
      console.log(`[CollectorAPIService] Mock模式搜索公众号: ${keyword}, begin: ${begin}`);
      return this.mockGetAccountList(keyword, begin);
    }
    
    console.log(`[CollectorAPIService] 搜索公众号: ${keyword}, begin: ${begin}`);
    
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

      // 记录API调用到数据库（替代 updateAPICache）
      await this.recordAPICall('searchbiz', {
        begin: begin,
        size: 10,
        keyword: keyword,
      }, resp.base_resp.ret === 0 || resp.base_resp.ret === 200003);

      if (resp.base_resp.ret === 0) {
        // 公众号判断是否结束的逻辑与文章不太一样
        // 当第一页的结果就少于10个则结束，否则只有当搜索结果为空才表示结束
        const isCompleted = begin === 0 ? resp.total < 10 : resp.total === 0;

        console.log(`[CollectorAPIService] 搜索成功，找到 ${resp.list?.length || 0} 个公众号`);
        return [resp.list, isCompleted];
      } else if (resp.base_resp.ret === 200003) {
        throw new Error('session expired');
      } else {
        throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
      }
      
    } catch (error) {
      console.error('[CollectorAPIService] 搜索公众号失败:', error);
      throw new Error(`搜索公众号失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  /**
   * 获取文章列表
   * 基于现有 getArticleList 逻辑，但移除UI依赖和缓存逻辑
   * 移除maxArticles限制，实现全量采集
   */
  async getArticleList(account: any, begin = 0, keyword = ''): Promise<[AppMsgEx[], boolean, number]> {
    if (this.mockMode) {
      console.log(`[CollectorAPIService] Mock模式获取文章: ${account.fakeid}, begin: ${begin}`);
      return this.mockGetArticleList(account.fakeid, begin);
    }
    
    console.log(`[CollectorAPIService] 获取文章: ${account.fakeid}, begin: ${begin}, keyword: ${keyword}`);
    
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

      // 记录API调用到数据库（替代 updateAPICache）
      await this.recordAPICall('appmsgpublish', {
        id: account.fakeid,
        begin: begin,
        size: 10,
        keyword: keyword,
      }, resp.base_resp.ret === 0 || resp.base_resp.ret === 200003);

      if (resp.base_resp.ret === 0) {
        const publish_page: PublishPage = JSON.parse(resp.publish_page);
        const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);

        // 返回的文章数量为0就表示已加载完毕
        const isCompleted = publish_list.length === 0;

        // 采集服务不需要更新文章缓存，专注于采集任务

        const articles = publish_list.flatMap(item => {
          const publish_info: PublishInfo = JSON.parse(item.publish_info);
          return publish_info.appmsgex;
        });
        
        console.log(`[CollectorAPIService] 获取文章成功，数量: ${articles.length}, 是否完成: ${isCompleted}`);
        return [articles, isCompleted, publish_page.total_count];
      } else if (resp.base_resp.ret === 200003) {
        throw new Error('session expired');
      } else {
        throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
      }
      
    } catch (error) {
      console.error('[CollectorAPIService] 获取文章失败:', error);
      throw new Error(`获取文章失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  /**
   * 记录API调用到数据库
   * 替代原有的 updateAPICache，记录到SQLite/PostgreSQL
   */
  private async recordAPICall(apiName: string, payload: any, isNormal: boolean): Promise<void> {
    try {
      // TODO: 实现数据库记录逻辑
      // 这里可以记录到SQLite或PostgreSQL
      const record = {
        api_name: apiName,
        payload: JSON.stringify(payload),
        is_normal: isNormal,
        call_time: new Date(),
        // 可以添加更多字段：任务ID、主体名称等
      };
      
      console.log(`[CollectorAPIService] 记录API调用: ${apiName}`, {
        payload,
        isNormal,
        timestamp: record.call_time
      });
      
      // 实际实现时，这里会调用数据库操作
      // await db.collection('api_calls').insert(record);
      
    } catch (error) {
      console.warn('[CollectorAPIService] 记录API调用失败:', error);
      // 不影响主要功能，记录失败可以忽略
    }
  }
  
  /**
   * Mock获取公众号列表
   */
  private async mockGetAccountList(keyword: string, begin = 0): Promise<[AccountInfo[], boolean]> {
    // 模拟延迟
    await this.delay(500);
    
    const mockAccounts: AccountInfo[] = Array.from({ length: Math.min(10, 5) }, (_, i) => ({
      fakeid: `mock_biz_${begin + i}`,
      nickname: `${keyword}测试公众号${begin + i}`,
      alias: `mock_alias_${begin + i}`,
      round_head_img: '',
      service_type: 0
    }));
    
    // 模拟分页逻辑：当begin >= 20时返回空数组表示结束
    const isCompleted = begin >= 20 || mockAccounts.length < 10;
    
    return [mockAccounts, isCompleted];
  }
  
  /**
   * Mock获取文章列表
   */
  private async mockGetArticleList(fakeid: string, begin = 0): Promise<[AppMsgEx[], boolean, number]> {
    // 模拟延迟
    await this.delay(300);
    
    const mockArticles: AppMsgEx[] = Array.from({ length: Math.min(10, 8) }, (_, i) => ({
      aid: `mock_article_${begin + i}`,
      title: `测试文章标题${begin + i}`,
      link: `https://mp.weixin.qq.com/s/mock_${begin + i}`,
      create_time: Date.now() - (begin + i) * 86400000,
      update_time: Date.now() - (begin + i) * 86400000,
      author_name: '测试作者',
      digest: `这是第${begin + i}篇测试文章的摘要内容`,
      cover: '',
      copyright_stat: 0,
      read_num: 1000 + i * 100,
      like_num: 100 + i * 10,
      old_like_num: 100 + i * 10
    }));
    
    // 模拟分页逻辑：当begin >= 50时返回空数组表示结束
    const isCompleted = begin >= 50 || mockArticles.length < 10;
    const totalCount = 50; // 模拟总文章数
    
    return [mockArticles, isCompleted, totalCount];
  }
  
  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 检查Mock模式状态
   */
  isMockMode(): boolean {
    return this.mockMode;
  }
}

// 创建单例实例
export const collectorAPIService = new CollectorAPIService();
