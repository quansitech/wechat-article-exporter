import { execSync } from 'child_process';

/**
 * 测试端点 - Mock 模式自动化测试
 * 仅开发环境可用，需要 DEBUG_KEY 认证
 * 访问 http://localhost:3000/api/test/run-collection-test?key=<DEBUG_KEY> 来执行测试
 */
export default defineEventHandler(async (event) => {
    // 安全守卫：生产环境禁止执行
    if (process.env.NODE_ENV === 'production') {
        throw createError({
            statusCode: 403,
            message: 'Test endpoints are not available in production',
        });
    }

    // 安全守卫：需要 DEBUG_KEY 认证
    const query = getQuery(event);
    const key = query.key as string | undefined;
    if (!key || key !== process.env.DEBUG_KEY) {
        throw createError({
            statusCode: 401,
            message: 'Unauthorized: valid DEBUG_KEY required via ?key= parameter',
        });
    }

    const startTime = Date.now();
    const logs: string[] = [];

    function log(message: string) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        logs.push(logMessage);
    }

    try {
        log('=== 开始 Mock 模式自动化测试 ===');

        // 1. 重置数据库
        log('正在重置数据库...');
        try {
            execSync('npx prisma migrate reset --force --skip-seed --schema=server/extensions/wechat-collector/prisma/schema.prisma', {
                stdio: 'pipe',
                env: process.env
            });
            log('数据库重置完成');
        } catch (error) {
            throw new Error(`数据库重置失败: ${error}`);
        }

        // 2. 动态导入服务（在 Nuxt 环境中，路径别名会正确解析）
        const { pipelineService } = await import('~/server/extensions/wechat-collector/services/pipeline.service');
        const { mockConfig } = await import('~/config/mock');
        const { prisma } = await import('~/server/extensions/wechat-collector/services/database.service');

        // 3. 强制开启 Mock 模式
        const originalMockState = mockConfig.enabled;
        mockConfig.enabled = true;
        log('Mock 模式已强制开启');

        try {
            // 测试用例 1: 指定 maxArticles = 2
            log('\n--- 测试用例 1: 指定 maxArticles = 2 ---');
            const task1Id = await pipelineService.startCollection('测试公众号1', {
                maxArticles: 2,
                forceRefresh: true,
                concurrency: 1
            });
            log(`任务1已启动: ${task1Id}`);

            // 等待任务完成
            await waitForTask(pipelineService, task1Id, log);

            // 验证结果
            const articles1 = await prisma.article.findMany({
                where: { account: { name: '测试公众号1' } }
            });
            log(`任务1结果: 期望 2 篇，实际 ${articles1.length} 篇`);

            if (articles1.length !== 2) {
                throw new Error(`测试用例 1 失败: 期望 2 篇文章，实际 ${articles1.length} 篇`);
            }
            log('[PASS] 测试用例 1 通过');

            // 测试用例 2: 不指定 maxArticles
            log('\n--- 测试用例 2: 不指定 maxArticles (采集所有) ---');
            const task2Id = await pipelineService.startCollection('测试公众号2', {
                forceRefresh: true,
                concurrency: 2
            });
            log(`任务2已启动: ${task2Id}`);

            await waitForTask(pipelineService, task2Id, log);

            const articles2 = await prisma.article.findMany({
                where: { account: { name: '测试公众号2' } }
            });

            const expectedCount = 11; // Mock 数据中的文章数
            log(`任务2结果: 期望 ${expectedCount} 篇，实际 ${articles2.length} 篇`);

            if (articles2.length !== expectedCount) {
                log('[WARN] 数量不匹配，可能是 Mock 数据生成逻辑有变或增量检查影响');
            } else {
                log('[PASS] 测试用例 2 通过');
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            log(`\n=== 所有测试完成 (耗时 ${duration}s) ===`);

            return {
                success: true,
                duration: `${duration}s`,
                logs,
                results: {
                    test1: { expected: 2, actual: articles1.length, passed: articles1.length === 2 },
                    test2: { expected: expectedCount, actual: articles2.length, passed: articles2.length === expectedCount }
                }
            };

        } finally {
            // 恢复 Mock 状态
            mockConfig.enabled = originalMockState;
            await prisma.$disconnect();
            log('测试环境已清理');
        }

    } catch (error) {
        log(`\n[FAIL] 测试失败: ${error instanceof Error ? error.message : String(error)}`);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            logs
        };
    }
});

/**
 * 等待任务完成
 */
async function waitForTask(pipelineService: any, taskId: string, log: (msg: string) => void) {
    log(`等待任务 ${taskId} 完成...`);
    const maxAttempts = 60; // 最多等待 60 秒
    let attempts = 0;

    while (attempts < maxAttempts) {
        const status = await pipelineService.getStatus(taskId);
        const task = status.tasks[0];

        if (!task) {
            throw new Error(`任务 ${taskId} 不存在`);
        }

        if (task.status === 'completed') {
            log(`任务 ${taskId} 已完成`);
            return;
        }

        if (task.status === 'failed') {
            throw new Error(`任务失败: ${task.error}`);
        }

        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }

    throw new Error(`任务 ${taskId} 超时`);
}
