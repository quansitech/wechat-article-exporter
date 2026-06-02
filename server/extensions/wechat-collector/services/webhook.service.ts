import { validateWebhookUrl } from '../utils/webhook-url-validator';

interface WebhookPayload {
  event: 'crawl.completed' | 'crawl.failed' | 'auth.expired';
  targetId: string;
  crawlRunId?: string;
  status?: string;
  error?: string;
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/***`;
  } catch {
    return '***';
  }
}

export class WebhookService {
  async notify(webhookUrl: string | null | undefined, payload: WebhookPayload): Promise<void> {
    if (!webhookUrl) return;

    // 发送前验证 URL 安全性（防御性编程：即使创建时已验证）
    try {
      validateWebhookUrl(webhookUrl);
    } catch {
      console.warn(`[Webhook] URL 安全验证失败，跳过通知: ${maskUrl(webhookUrl)}`);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      console.log(`[Webhook] 通知已发送: ${payload.event} -> ${maskUrl(webhookUrl)}`);
    } catch (error) {
      console.warn(`[Webhook] 发送失败: ${maskUrl(webhookUrl)}`, error instanceof Error ? error.message : error);
    }
  }
}

export const webhookService = new WebhookService();
