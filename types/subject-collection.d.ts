export interface CrawlTask {
  id: string;
  keyword: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    step: 'search' | 'verify' | 'fetch' | 'download' | 'completed';
    current: number;
    total: number;
    message: string;
  };
  result?: CrawlResult;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CrawlResult {
  account: AccountInfo;
  articles: CrawlArticle[];
  total: number;
  completed: number;
}

export interface CrawlArticle {
  aid: string;
  title: string;
  link: string;
  create_time: number;
  update_time: number;
  author_name: string;
  digest: string;
  markdown?: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
}
