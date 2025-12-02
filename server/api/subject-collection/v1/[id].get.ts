import { getCrawlTask } from '~/server/extensions/subject-collection/services/subject-collection.service';

export default defineEventHandler(async (event) => {
  const { id } = event.context.params as { id: string };

  const task = getCrawlTask(id);

  if (!task) {
    throw createError({
      statusCode: 404,
      statusMessage: '任务不存在'
    });
  }

  return {
    task_id: task.id,
    keyword: task.keyword,
    status: task.status,
    progress: task.progress,
    result: task.result,
    error: task.error,
    created_at: task.createdAt,
    updated_at: task.updatedAt
  };
});
