import { createCrawlTask } from '~/server/services/subject-collection.service';

interface TaskRequestBody {
  keyword: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<TaskRequestBody>(event);
  
  if (!body.keyword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'keyword参数不能为空'
    });
  }

  // 创建爬取任务
  const task = createCrawlTask(body.keyword);
  
  return {
    task_id: task.id,
    status: task.status,
    progress: task.progress,
    created_at: task.createdAt
  };
});
