import { collectorConfig } from '../config';
import { authProvider } from './auth-provider.service';
import { prisma } from './database.service';
import { pipelineService } from './pipeline.service';

const WATCHDOG_INTERVAL_MS = 6 * 60 * 60 * 1000;

export class SchedulerService {
  private scanTimer: NodeJS.Timeout | null = null;
  private authTimer: NodeJS.Timeout | null = null;
  private consecutiveAuthFailures = 0;
  private lastAuthFailureTime = 0;
  private lastBackoffLogTime = 0;

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

  private calcBackoffDelay(): number {
    return Math.min(
      collectorConfig.authBackoffBaseMs * Math.pow(2, this.consecutiveAuthFailures - 1),
      collectorConfig.authBackoffMaxMs,
    );
  }

  private logBackoff(): void {
    const now = Date.now();
    if (now - this.lastBackoffLogTime < 30 * 60 * 1000) return;
    this.lastBackoffLogTime = now;
    const backoffDelay = this.calcBackoffDelay();
    console.warn(`[Scheduler] Auth failure #${this.consecutiveAuthFailures}, backing off for ${backoffDelay}ms`);
  }

  async scanDueTargets(): Promise<void> {
    // Check exponential backoff before attempting auth
    if (this.consecutiveAuthFailures > 0) {
      const backoffDelay = this.calcBackoffDelay();
      const nextAllowedScanTime = this.lastAuthFailureTime + backoffDelay;
      if (Date.now() < nextAllowedScanTime) {
        this.logBackoff();
        return;
      }
    }

    const valid = await authProvider.isValid();
    if (!valid) {
      this.consecutiveAuthFailures++;
      this.lastAuthFailureTime = Date.now();
      const backoffDelay = this.calcBackoffDelay();
      console.warn(`[Scheduler] Auth failure #${this.consecutiveAuthFailures}, backing off for ${backoffDelay}ms`);
      return;
    }

    this.consecutiveAuthFailures = 0;
    this.lastAuthFailureTime = 0;
    this.lastBackoffLogTime = 0;

    const targets = await prisma.monitorTarget.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: new Date() },
      },
      orderBy: { nextRunAt: 'asc' },
    });

    for (const target of targets) {
      await pipelineService.runTarget(target.id, 'scheduled');
      // Pipeline updates MonitorTarget (lastRunAt, nextRunAt, lastCrawlTime) on completion
      // Scheduler only dispatches; pipeline owns the final state update
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
