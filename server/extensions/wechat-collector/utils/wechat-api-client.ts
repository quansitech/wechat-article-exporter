import { USER_AGENT } from '~/config';
import { mockConfig, mockUtils } from '~/config/mock';
import { getAuthFromFile } from '~/server/utils/auth-file';
import { registerCookieHook, registerTokenHook } from '~/server/utils/CookieStore';
import type {
  AccountInfo,
  AppMsgEx,
  AppMsgPublishResponse,
  PublishInfo,
  PublishPage,
  SearchBizResponse,
} from '~/types/collection.types';
import { authProvider } from '../services/auth-provider.service';
import type { IAuthProvider } from '../types/auth';

export class WeChatApiClient {
  private enableApiLog: boolean;
  private authProvider: IAuthProvider;

  constructor(options?: { enableApiLog?: boolean; authProvider?: IAuthProvider }) {
    this.enableApiLog = options?.enableApiLog ?? false;
    this.authProvider = options?.authProvider ?? authProvider;
  }

  private get mockMode(): boolean {
    return mockConfig.enabled;
  }

  /**
   * 注册文件认证钩子，使后台 $fetch 请求携带凭证
   */
  initAuth(): void {
    registerTokenHook(async () => {
      return getAuthFromFile().token;
    });

    registerCookieHook(async () => {
      return getAuthFromFile().cookies;
    });

    console.log('[WeChatApiClient] File auth hooks registered');
  }

  /**
   * 搜索公众号（增强版：返回结构化数据）
   */
  async searchBiz(
    keyword: string,
    begin: number = 0
  ): Promise<{
    accounts: AccountInfo[];
    isCompleted: boolean;
  }> {
    console.log(`[WeChatApiClient] 搜索公众号: ${keyword}, begin: ${begin}`);

    try {
      const resp = await this.fetchSearchBiz(keyword, begin);

      // 记录API调用
      if (this.enableApiLog) {
        await this.recordAPICall(
          'searchbiz',
          {
            begin,
            size: 10,
            keyword,
          },
          resp.base_resp.ret === 0 || resp.base_resp.ret === 200003
        );
      }

      // 统一处理响应
      if (resp.base_resp.ret === 0) {
        const isCompleted = begin === 0 ? resp.total < 10 : resp.total === 0;
        console.log(`[WeChatApiClient] 搜索成功，找到 ${resp.list?.length || 0} 个公众号`);
        return { accounts: resp.list, isCompleted };
      }

      if (resp.base_resp.ret === 200003) {
        throw new Error('session expired');
      }

      throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
    } catch (error) {
      console.error('[WeChatApiClient] 搜索公众号失败:', error);
      if (error instanceof Error && error.message.includes('session expired')) {
        throw new Error('session expired');
      }
      throw new Error(`搜索公众号失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 底层搜索调用（仅处理 Mock 切换）
   */
  private async fetchSearchBiz(keyword: string, begin: number): Promise<SearchBizResponse> {
    if (this.mockMode) {
      console.log(`[WeChatApiClient] Mock Search: ${keyword}`);
      await this.delay(500);
      const accounts = mockUtils.getAccounts();
      const filtered = accounts.filter(acc => acc.nickname.includes(keyword));
      return {
        base_resp: { ret: 0, err_msg: 'ok' },
        list: filtered,
        total: filtered.length,
      } as any;
    }

    await this.ensureAuth();
    return $fetch<SearchBizResponse>('/api/web/mp/searchbiz', {
      method: 'GET',
      query: { begin, size: 10, keyword },
      retry: 0,
    });
  }

  /**
   * 获取文章列表（增强版：返回结构化数据）
   */
  async getArticleList(
    fakeid: string,
    begin: number = 0
  ): Promise<{
    articles: AppMsgEx[];
    isCompleted: boolean;
    totalCount: number;
  }> {
    console.log(`[WeChatApiClient] 获取文章: ${fakeid}, begin: ${begin}`);

    try {
      const resp = await this.fetchAppMsgPublish(fakeid, begin);

      // 记录API调用
      if (this.enableApiLog) {
        await this.recordAPICall(
          'appmsgpublish',
          {
            id: fakeid,
            begin,
            size: 10,
          },
          resp.base_resp.ret === 0 || resp.base_resp.ret === 200003
        );
      }

      // 统一处理响应
      if (resp.base_resp.ret === 0) {
        const publish_page: PublishPage = JSON.parse(resp.publish_page);
        const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);
        const isCompleted = publish_list.length === 0;

        const articles = publish_list.flatMap(item => {
          const publish_info: PublishInfo = JSON.parse(item.publish_info);
          return publish_info.appmsgex;
        });

        console.log(`[WeChatApiClient] 获取文章成功，数量: ${articles.length}, 是否完成: ${isCompleted}`);
        return { articles, isCompleted, totalCount: publish_page.total_count };
      }

      if (resp.base_resp.ret === 200003) {
        throw new Error('session expired');
      }

      throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
    } catch (error) {
      console.error('[WeChatApiClient] 获取文章失败:', error);
      if (error instanceof Error && error.message.includes('session expired')) {
        throw new Error('session expired');
      }
      throw new Error(`获取文章失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 底层文章列表调用（仅处理 Mock 切换）
   */
  private async fetchAppMsgPublish(fakeid: string, begin: number): Promise<AppMsgPublishResponse> {
    if (this.mockMode) {
      console.log(`[WeChatApiClient] Mock Articles: ${fakeid}, begin: ${begin}`);
      await this.delay(300);
      const allArticles = mockUtils.getArticles(fakeid);
      const pageSize = 10;
      let currentPageArticles: AppMsgEx[] = [];

      // 简单分页逻辑：假设 mockUtils.getArticles() 返回了足够的数据（例如15篇）
      // begin=0: 第一页（前pageSize篇）
      // begin=10: 第二页（第pageSize+1到2*pageSize篇）
      // begin>=20: 读取完成（空数组）
      const startIndex = begin;
      const endIndex = begin + pageSize;

      if (startIndex < allArticles.length) {
        currentPageArticles = allArticles.slice(startIndex, Math.min(endIndex, allArticles.length));
      }
      // 如果 startIndex >= allArticles.length，currentPageArticles 保持为空数组

      const publishList = currentPageArticles.map(article => ({
        publish_info: JSON.stringify({ appmsgex: [article] }),
      }));

      return {
        base_resp: { ret: 0, err_msg: 'ok' },
        publish_page: JSON.stringify({
          publish_list: publishList,
          total_count: allArticles.length, // 总文章数
        }),
      } as any;
    }

    await this.ensureAuth();
    return $fetch<AppMsgPublishResponse>('/api/web/mp/appmsgpublish', {
      method: 'GET',
      query: { id: fakeid, begin, size: 10 },
      retry: 0,
    });
  }

  /**
   * 获取公众号主体信息（验证用）
   */
  async getAuthorInfo(biz: string): Promise<{
    base_resp: { ret: number; err_msg: string };
    identity_name?: string;
  }> {
    if (this.mockMode) {
      console.log(`[WeChatApiClient] Mock AuthorInfo: ${biz}`);
      await this.delay(200);
      return mockUtils.getAuthorInfo(biz) as any;
    }

    await this.ensureAuth();
    return $fetch('/api/public/beta/authorinfo', {
      method: 'GET',
      query: { biz },
      retry: 0,
    });
  }

  /**
   * 下载页面内容（用于提取文章）
   */
  async downloadPage(url: string): Promise<string> {
    if (this.mockMode) {
      console.log(`[WeChatApiClient] Mock Download: ${url}`);
      await this.delay(800);
      return mockUtils.generateHtml(url);
    }

    // SSRF 防护：仅允许微信公众号域名
    const allowedHosts = ['mp.weixin.qq.com'];
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw new Error(`不允许的协议: ${parsed.protocol}`);
      }
      if (!allowedHosts.includes(parsed.hostname)) {
        throw new Error(`不允许的域名: ${parsed.hostname}`);
      }
    } catch (error) {
      throw new Error(`URL 验证失败: ${error instanceof Error ? error.message : error}`);
    }

    const res = await fetch(url, {
      headers: {
        Referer: 'https://mp.weixin.qq.com/',
        Origin: 'https://mp.weixin.qq.com',
        'User-Agent': USER_AGENT,
      },
    });

    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    return res.text();
  }

  /**
   * 记录API调用（可选功能）
   */
  private async recordAPICall(apiName: string, payload: any, isNormal: boolean): Promise<void> {
    if (!this.enableApiLog) return;

    try {
      const record = {
        api_name: apiName,
        payload: JSON.stringify(payload),
        is_normal: isNormal,
        call_time: new Date(),
      };

      console.log(`[WeChatApiClient] API调用: ${apiName}`, {
        payload,
        isNormal,
        timestamp: record.call_time,
      });

      // TODO: 实现数据库记录逻辑
      // await db.collection('api_calls').insert(record);
    } catch (error) {
      console.warn('[WeChatApiClient] 记录API调用失败:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async ensureAuth(): Promise<void> {
    const valid = await this.authProvider.isValid();
    if (!valid) {
      throw new Error('session expired');
    }
  }
}

export const wechatApiClient = new WeChatApiClient({ enableApiLog: true, authProvider });
