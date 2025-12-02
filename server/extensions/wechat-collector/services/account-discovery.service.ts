import type {
  CollectionAccount,
  IAccountDiscoveryService
} from '~/types/collection.types';
import { wechatApiClient } from '../utils/wechat-api-client';
import { prisma } from './database.service';

/**
 * 账号发现服务
 * 负责搜索和验证公众号账号
 */
export class AccountDiscoveryService implements IAccountDiscoveryService {

  /**
   * 发现公众号账号
   * 优先查库，库中没有才调用API
   */
  async discover(subjectName: string): Promise<CollectionAccount[]> {
    console.log(`[AccountDiscovery] 开始搜索公众号: ${subjectName}`);

    try {
      // 1. 查库: 检查是否已经搜过该主体 (entityName)
      const cachedAccounts = await prisma.account.findMany({
        where: {
          entityName: subjectName,
          isVerified: true
        }
      });

      if (cachedAccounts.length > 0) {
        console.log(`[AccountDiscovery] 缓存命中: 找到 ${cachedAccounts.length} 个已验证账号`);
        return cachedAccounts.map(acc => ({
          id: acc.id,
          subjectName: acc.entityName || subjectName,
          fakeid: acc.id,
          nickname: acc.name,
          verified: acc.isVerified,
          lastCrawlTime: acc.lastCrawlTime || new Date(0),
          createdAt: acc.createdAt
        }));
      }

      // 2. 库中无，调用 API 搜索
      console.log(`[AccountDiscovery] 缓存未命中，调用API搜索...`);
      const { accounts, isCompleted } = await wechatApiClient.searchBiz(subjectName, 0);

      if (!accounts || accounts.length === 0) {
        console.log(`[AccountDiscovery] 未找到与"${subjectName}"相关的公众号`);
        return [];
      }

      console.log(`[AccountDiscovery] API 找到 ${accounts.length} 个公众号`);

      // 3. 验证并入库
      const collectionAccounts: CollectionAccount[] = [];

      for (const account of accounts) {
        // 验证公众号主体
        const isValid = await this.verify(account, subjectName);

        if (isValid) {
          // 入库 (Postgres/SQLite)
          // 使用 fakeid 作为 ID
          const savedAccount = await prisma.account.upsert({
            where: { id: account.fakeid },
            update: {
              name: account.nickname,
              entityName: subjectName,
              isVerified: true,
              updatedAt: new Date()
            },
            create: {
              id: account.fakeid,
              name: account.nickname,
              entityName: subjectName,
              isVerified: true,
              lastCrawlTime: null // 新账号默认未采集
            }
          });

          collectionAccounts.push({
            id: savedAccount.id,
            subjectName,
            fakeid: savedAccount.id,
            nickname: savedAccount.name,
            verified: savedAccount.isVerified,
            lastCrawlTime: savedAccount.lastCrawlTime || new Date(0),
            createdAt: savedAccount.createdAt
          });

          console.log(`[AccountDiscovery] 验证通过并入库: ${account.nickname} (${account.fakeid})`);
        } else {
          console.log(`[AccountDiscovery] 验证失败: ${account.nickname} (${account.fakeid})`);
        }
      }

      return collectionAccounts;

    } catch (error) {
      console.error(`[AccountDiscovery] 搜索公众号失败:`, error);
      throw new Error(`搜索公众号失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 验证公众号主体
   */
  async verify(accountInfo: { fakeid: string; nickname: string }, subjectName: string): Promise<boolean> {
    try {
      // 调用统一客户端进行验证
      const response = await wechatApiClient.getAuthorInfo(accountInfo.fakeid);

      if (response.base_resp.ret === 0) {
        const identityName = response.identity_name || '';
        const isMatch = identityName.toLowerCase().includes(subjectName.toLowerCase()) ||
          accountInfo.nickname.toLowerCase().includes(subjectName.toLowerCase());

        console.log(`[AccountDiscovery] 验证结果: ${isMatch}, 主体: ${identityName}, 账号: ${accountInfo.nickname}`);
        return isMatch;
      }

      console.warn(`[AccountDiscovery] 验证接口返回错误: ${response.base_resp.ret} ${response.base_resp.err_msg}`);
      return false;

    } catch (error) {
      console.warn(`[AccountDiscovery] 验证公众号失败:`, error);
      return false;
    }
  }

  /**
   * 获取已发现的账号
   */
  async getDiscoveredAccount(accountId: string): Promise<CollectionAccount | null> {
    const acc = await prisma.account.findUnique({ where: { id: accountId } });
    if (!acc) return null;
    return {
      id: acc.id,
      subjectName: acc.entityName || '',
      fakeid: acc.id,
      nickname: acc.name,
      verified: acc.isVerified,
      lastCrawlTime: acc.lastCrawlTime || new Date(0),
      createdAt: acc.createdAt
    };
  }

  /**
   * 更新账号的最后采集时间
   */
  async updateLastCrawlTime(accountId: string, crawlTime: Date): Promise<void> {
    try {
      await prisma.account.update({
        where: { id: accountId },
        data: { lastCrawlTime: crawlTime }
      });
      console.log(`[AccountDiscovery] 更新账号采集时间: ${accountId}, 时间: ${crawlTime}`);
    } catch (error) {
      console.error(`[AccountDiscovery] 更新采集时间失败: ${accountId}`, error);
    }
  }
}

// 创建单例实例
export const accountDiscoveryService = new AccountDiscoveryService();
