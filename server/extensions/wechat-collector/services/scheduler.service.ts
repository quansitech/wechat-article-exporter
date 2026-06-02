import { collectorConfig } from '../config';
import { authProvider } from './auth-provider.service';
import { prisma } from './database.service';
import { monitorTargetService } from './monitor-target.service';
import { pipelineService } from './pipeline.service';

const WATCHDOG_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class SchedulerService {
  private scanTimer: NodeJS.Timeout | null = null;
  private authTimer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.scanTimer || this.authTimer) return;

    this.scanTimer = setInterval(() => {
      this.scanDueTargets().catch(error => console.error('[Scheduler] 扫描失败:', error));
    }, collectorConfig.schedulerScanIntervalMs);

    this.authTimer = setInterval(() => {
      authProvider.isValid().catch(error => console.error('[Scheduler] Auth watchdog failed:', error));
    }, WATCHDOG_INTERVAL_MS);

    this.scanDueTargets().catch(error => console.error('[Scheduler] 启动扫描失败:', error));
  }

  stop(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
    if (this.authTimer) clearInterval(this.authTimer);
    this.scanTimer = null;
    this.authTimer = null;
  }

  async scanDueTargets(): Promise<void> {
    const valid = await authProvider.isValid();
    if (!valid) {
      console.warn('[Scheduler] 认证无效，跳过调度');
      return;
    }

    const targets = await prisma.monitorTarget.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: new Date() },
      },
      orderBy: { nextRunAt: 'asc' },
    });

    for (const target of targets) {
      await pipelineService.runTarget(target.id, 'scheduled');
      const now = new Date();
      await prisma.monitorTarget.update({
        where: { id: target.id },
        data: {
          lastRunAt: now,
          nextRunAt: monitorTargetService.nextRunAt(target.checkIntervalMinutes, now),
        },
      });
    }
  }

  async getStatus() {
    const activeTargets = await prisma.monitorTarget.count({ where: { enabled: true } });
    const nextTarget = await prisma.monitorTarget.findFirst({
      where: { enabled: true },
      orderBy: { nextRunAt: 'asc' },
    });

    return {
      active: !!this.scanTimer,
      activeTargets,
      nextRunAt: nextTarget?.nextRunAt || null,
    };
  }
}

export const schedulerService = new SchedulerService();
