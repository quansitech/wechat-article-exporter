import { randomUUID } from 'crypto';
import { prisma } from './database.service';

const DEFAULT_INTERVAL_MINUTES = 720;

export interface CreateMonitorTargetInput {
  subjectName: string;
  checkIntervalMinutes?: number;
  webhookUrl?: string | null;
}

export class MonitorTargetService {
  async create(input: CreateMonitorTargetInput) {
    const subjectName = input.subjectName.trim();
    if (!subjectName) {
      throw new Error('主体名称不能为空');
    }

    const checkIntervalMinutes = input.checkIntervalMinutes ?? DEFAULT_INTERVAL_MINUTES;
    if (!Number.isFinite(checkIntervalMinutes) || checkIntervalMinutes <= 0) {
      throw new Error('检查间隔必须大于 0');
    }

    return prisma.monitorTarget.create({
      data: {
        id: randomUUID(),
        subjectName,
        checkIntervalMinutes,
        webhookUrl: input.webhookUrl || null,
        enabled: true,
        nextRunAt: new Date(),
      },
    });
  }

  async list() {
    const targets = await prisma.monitorTarget.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        crawlRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    return targets.map(target => {
      const [latestRun] = target.crawlRuns;
      const { crawlRuns, ...data } = target;
      return {
        ...data,
        latestRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              articlesNew: latestRun.articlesNew,
              articlesFailed: latestRun.articlesFailed,
              completedAt: latestRun.completedAt,
            }
          : null,
      };
    });
  }

  async get(id: string) {
    return prisma.monitorTarget.findUnique({ where: { id } });
  }

  async findBySubjectName(subjectName: string) {
    return prisma.monitorTarget.findFirst({
      where: { subjectName, enabled: true },
    });
  }

  async disable(id: string) {
    return prisma.monitorTarget.update({
      where: { id },
      data: { enabled: false },
    });
  }

  nextRunAt(intervalMinutes: number, from = new Date()): Date {
    return new Date(from.getTime() + intervalMinutes * 60 * 1000);
  }
}

export const monitorTargetService = new MonitorTargetService();
