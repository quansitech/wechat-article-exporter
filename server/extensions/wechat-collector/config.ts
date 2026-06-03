/**
 * Collector 运行时配置
 * 所有参数通过环境变量外部化，零配置可启动
 * @see openspec/changes/wechat-org-monitor/design.md D11
 */

function envInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(`[Config] ${key}="${raw}" 无效，使用默认值 ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function envDelayRange(key: string, defaultMin: number, defaultMax: number): [number, number] {
  const raw = process.env[key];
  if (!raw) return [defaultMin, defaultMax];
  const parts = raw.split('-').map(Number);
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1]) || parts[0] <= 0 || parts[1] <= parts[0]) {
    console.warn(`[Config] ${key}="${raw}" 无效（格式: min-max），使用默认值 ${defaultMin}-${defaultMax}`);
    return [defaultMin, defaultMax];
  }
  return [parts[0], parts[1]];
}

export const collectorConfig = {
  /** 文章处理并发数 */
  concurrency: envInt('COLLECTOR_CONCURRENCY', 2),

  /** 账号间随机延迟范围 (ms) */
  accountDelayMs: envDelayRange('COLLECTOR_ACCOUNT_DELAY_MS', 2000, 5000),

  /** 分页间随机延迟范围 (ms) */
  pageDelayMs: envDelayRange('COLLECTOR_PAGE_DELAY_MS', 1500, 3000),

  /** 文章下载间随机延迟范围 (ms) */
  downloadDelayMs: envDelayRange('COLLECTOR_DOWNLOAD_DELAY_MS', 1000, 3000),

  /** API 每页文章数 */
  pageSize: envInt('COLLECTOR_PAGE_SIZE', 10),

  /** 文章处理最大重试次数 */
  maxRetries: envInt('COLLECTOR_MAX_RETRIES', 3),

  /** 单篇文章下载超时 (ms) */
  downloadTimeoutMs: envInt('COLLECTOR_DOWNLOAD_TIMEOUT_MS', 30_000),

  /** Scheduler 扫描间隔 (ms) */
  schedulerScanIntervalMs: envInt('SCHEDULER_SCAN_INTERVAL_MS', 5 * 60 * 1000),

  /** 已完成任务保留时间 (ms) */
  taskTtlMs: envInt('COLLECTOR_TASK_TTL_MS', 24 * 60 * 60 * 1000),

  /** 认证失败指数退避基础延迟 (ms) */
  authBackoffBaseMs: envInt('COLLECTOR_AUTH_BACKOFF_BASE_MS', 60_000),

  /** 认证失败指数退避最大延迟 (ms) */
  authBackoffMaxMs: envInt('COLLECTOR_AUTH_BACKOFF_MAX_MS', 3_600_000),
} as const;

/** 在给定延迟范围内产生随机值 */
export function randomDelay(range: readonly [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}
