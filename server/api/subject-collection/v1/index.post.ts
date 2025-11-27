import { createCrawlTask } from '~/server/services/subject-collection.service';
import { MOCK_MODE } from '../mock/index';
import { registerTokenHook, registerCookieHook, getTokenFromStore } from '~/server/utils/CookieStore';
import { getAuthFromFile } from '~/server/utils/auth-file';

// 注册文件认证钩子
registerTokenHook(async (event) => {
  return getAuthFromFile().token;
});

registerCookieHook(async (event) => {
  return getAuthFromFile().cookies;
});

interface TaskRequestBody {
  keyword: string;
}

export default defineEventHandler(async (event) => {
  const token = await getTokenFromStore(event);
  
  if (!MOCK_MODE && !token) {
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
