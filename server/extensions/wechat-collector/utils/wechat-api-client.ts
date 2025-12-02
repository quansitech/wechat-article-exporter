import { mockConfig, mockUtils } from '~/config/mock';
import { USER_AGENT } from '~/config';
import type {
    SearchBizResponse,
    AppMsgPublishResponse,
    AccountInfo,
    AppMsgEx,
    PublishInfo,
    PublishPage
} from '~/types/types';
import { registerTokenHook, registerCookieHook } from '~/server/utils/CookieStore';
import { getAuthFromFile } from '~/server/utils/auth-file';

/**
 * 微信 API 客户端（增强版）
 * 统一处理对微信接口的请求，封装 Mock 切换、认证钩子、API日志等功能
 */
export class WeChatApiClient {
    private enableApiLog: boolean;

    constructor(options?: { enableApiLog?: boolean }) {
        this.enableApiLog = options?.enableApiLog ?? false;
        // 自动注册认证钩子
        this.registerAuthHooks();
    }

    private get mockMode(): boolean {
        return mockConfig.enabled;
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

        console.log('[WeChatApiClient] 文件认证钩子已注册');
    }

    /**
     * 搜索公众号（增强版：返回结构化数据）
     */
    async searchBiz(keyword: string, begin: number = 0): Promise<{
        accounts: AccountInfo[];
        isCompleted: boolean;
    }> {
        console.log(`[WeChatApiClient] 搜索公众号: ${keyword}, begin: ${begin}`);

        try {
            const resp = await this.fetchSearchBiz(keyword, begin);

            // 记录API调用
            if (this.enableApiLog) {
                await this.recordAPICall('searchbiz', {
                    begin, size: 10, keyword
                }, resp.base_resp.ret === 0 || resp.base_resp.ret === 200003);
            }

            // 统一处理响应
            if (resp.base_resp.ret === 0) {
                const isCompleted = begin === 0 ? resp.total < 10 : resp.total === 0;
                console.log(`[WeChatApiClient] 搜索成功，找到 ${resp.list?.length || 0} 个公众号`);
                return { accounts: resp.list, isCompleted };
            } else if (resp.base_resp.ret === 200003) {
                throw new Error('session expired');
            } else {
                throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
            }
        } catch (error) {
            console.error('[WeChatApiClient] 搜索公众号失败:', error);
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
                total: filtered.length
            } as any;
        }

        return $fetch<SearchBizResponse>('/api/web/mp/searchbiz', {
            method: 'GET',
            query: { begin, size: 10, keyword },
            retry: 0,
        });
    }

    /**
     * 获取文章列表（增强版：返回结构化数据）
     */
    async getArticleList(fakeid: string, begin: number = 0): Promise<{
        articles: AppMsgEx[];
        isCompleted: boolean;
        totalCount: number;
    }> {
        console.log(`[WeChatApiClient] 获取文章: ${fakeid}, begin: ${begin}`);

        try {
            const resp = await this.fetchAppMsgPublish(fakeid, begin);

            // 记录API调用
            if (this.enableApiLog) {
                await this.recordAPICall('appmsgpublish', {
                    id: fakeid, begin, size: 10
                }, resp.base_resp.ret === 0 || resp.base_resp.ret === 200003);
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
            } else if (resp.base_resp.ret === 200003) {
                throw new Error('session expired');
            } else {
                throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
            }
        } catch (error) {
            console.error('[WeChatApiClient] 获取文章失败:', error);
            throw new Error(`获取文章失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    }

    /**
     * 底层文章列表调用（仅处理 Mock 切换）
     */
    private async fetchAppMsgPublish(fakeid: string, begin: number): Promise<AppMsgPublishResponse> {
        if (this.mockMode) {
            console.log(`[WeChatApiClient] Mock Articles: ${fakeid}`);
            await this.delay(300);
            const articles = mockUtils.getArticles();
            const publishList = articles.map(article => ({
                publish_info: JSON.stringify({ appmsgex: [article] })
            }));

            return {
                base_resp: { ret: 0, err_msg: 'ok' },
                publish_page: JSON.stringify({
                    publish_list: publishList,
                    total_count: articles.length
                })
            } as any;
        }

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
        base_resp: { ret: number; err_msg: string },
        identity_name?: string
    }> {
        if (this.mockMode) {
            console.log(`[WeChatApiClient] Mock AuthorInfo: ${biz}`);
            await this.delay(200);
            return mockUtils.getAuthorInfo(biz) as any;
        }

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
                timestamp: record.call_time
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
}

// 创建单例（启用API日志）
export const wechatApiClient = new WeChatApiClient({ enableApiLog: true });
