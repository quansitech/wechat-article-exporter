/**
 * 微信公众号采集归档功能 - 类型定义
 * 完全独立于现有类型，通过扩展方式实现
 */

/**
 * 采集任务
 */
export interface CollectionTask {
  id: string;
  subjectName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    step: 'discovering' | 'collecting' | 'processing' | 'completed';
    percentage: number;
    accountsDiscovered: number;
    articlesCollected: number;
    articlesProcessed: number;
    message?: string;  // 添加消息字段
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 采集账号（独立于现有账号存储）
 */
export interface CollectionAccount {
  id: string;
  subjectName: string;
  fakeid: string;           // 关联现有账号的fakeid，仅用于API调用
  nickname: string;
  verified: boolean;
  lastCrawlTime: Date;      // 最后采集时间，用于增量检查
  createdAt: Date;
}

/**
 * 采集文章（独立于现有文章存储）
 */
export interface CollectionArticle {
  id: string;
  accountId: string;        // 关联采集账号ID
  url: string;
  urlHash: string;          // SHA256(url) 用于去重
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  markdownContent?: string;
  filePath?: string;        // 保存的文件路径
  createdAt: Date;
  processedAt?: Date;
}

/**
 * 采集选项
 */
export interface CollectionOptions {
  maxArticles?: number;     // 最大文章数，默认100
  forceRefresh?: boolean;   // 强制刷新，忽略增量检查
  concurrency?: number;     // 并发数，默认5
}

/**
 * API请求类型
 */
export interface StartCollectionRequest {
  subjectName: string;
  options?: CollectionOptions;
}

export interface StartCollectionResponse {
  taskId: string;
  status: 'started' | 'queued' | 'error';
  message: string;
}

export interface StatusQuery {
  taskId?: string;
  subjectName?: string;
}

export interface CollectionStatusResponse {
  tasks: CollectionTask[];
  summary: {
    totalTasks: number;
    runningTasks: number;
    completedTasks: number;
    failedTasks: number;
  };
}

/**
 * 采集结果
 */
export interface CollectionResult {
  taskId: string;
  subjectName: string;
  accounts: CollectionAccount[];
  articles: CollectionArticle[];
  totalArticles: number;
  processedArticles: number;
  failedArticles: number;
  startTime: Date;
  endTime?: Date;
}

/**
 * 文章处理结果
 */
export interface ArticleProcessResult {
  article: CollectionArticle;
  success: boolean;
  error?: string;
  filePath?: string;
}

/**
 * 服务接口定义
 */
export interface IAccountDiscoveryService {
  discover(subjectName: string): Promise<CollectionAccount[]>;
  verify(accountInfo: any, subjectName: string): Promise<boolean>;
}

export interface IArticleCollectorService {
  collect(accounts: CollectionAccount[], options?: CollectionOptions): Promise<CollectionArticle[]>;
  checkIncremental(account: CollectionAccount): Promise<boolean>;
}

export interface IContentProcessorService {
  process(articles: CollectionArticle[], options?: CollectionOptions): Promise<ArticleProcessResult[]>;
  downloadAndConvert(url: string): Promise<string>;
  saveToFile(content: string, metadata: { title: string; author: string; date: Date }): Promise<string>;
}

export interface ITaskManagerService {
  createTask(subjectName: string, options?: CollectionOptions): Promise<string>;
  getTask(taskId: string): CollectionTask | null;
  getAllTasks(subjectName?: string): CollectionTask[];
  updateTaskProgress(taskId: string, progress: Partial<CollectionTask['progress']>): Promise<void>;
  updateTaskStatus(taskId: string, status: CollectionTask['status'], error?: string): Promise<void>;
}

export interface IPipelineService {
  startCollection(subjectName: string, options?: CollectionOptions): Promise<string>;
  getStatus(taskId?: string, subjectName?: string): Promise<CollectionStatusResponse>;
}
