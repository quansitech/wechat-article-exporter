import { createCrawlTask } from '~/server/services/subject-collection.service';

interface TaskRequestBody {
  keyword: string;
}

export default defineEventHandler(async (event) => {
  const token = await getTokenFromStore(event);
  
  if (!token) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '认证信息无效',
      },
    };
  }

  const body = await readBody<TaskRequestBody>(event);
  
  if (!body.keyword) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'keyword不能为空',
      },
    };
  }

  const task = createCrawlTask(body.keyword);
  
  return {
    task_id: task.id,
    status: task.status,
    progress: task.progress,
    created_at: task.createdAt
  };
});
