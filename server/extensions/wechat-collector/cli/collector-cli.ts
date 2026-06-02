#!/usr/bin/env node
/**
 * wechat-collector CLI — thin wrapper around the Collector API
 *
 * Usage:
 *   npx tsx cli/collector-cli.ts target add "某机构"
 *   npx tsx cli/collector-cli.ts target list
 *   npx tsx cli/collector-cli.ts target run <id>
 *   npx tsx cli/collector-cli.ts articles [--account=xxx]
 *   npx tsx cli/collector-cli.ts health
 *   npx tsx cli/collector-cli.ts auth refresh --token=xxx --cookies=xxx
 */

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api/collector`;

async function request(method: string, path: string, body?: any): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case 'target': {
      const sub = args[1];
      if (sub === 'add') {
        const subjectName = args[2];
        if (!subjectName) {
          console.error('Usage: target add <subjectName>');
          process.exit(1);
        }
        const res = await request('POST', '/targets', { subjectName, checkIntervalMinutes: 60 });
        console.log(JSON.stringify(res, null, 2));
      } else if (sub === 'list') {
        const res = await request('GET', '/targets');
        console.log(JSON.stringify(res, null, 2));
      } else if (sub === 'run') {
        const id = args[2];
        if (!id) {
          console.error('Usage: target run <id>');
          process.exit(1);
        }
        const res = await request('POST', `/targets/${id}/run`);
        console.log(JSON.stringify(res, null, 2));
      } else if (sub === 'delete') {
        const id = args[2];
        if (!id) {
          console.error('Usage: target delete <id>');
          process.exit(1);
        }
        const res = await request('DELETE', `/targets/${id}`);
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.error('Usage: target <add|list|run|delete>');
      }
      break;
    }
    case 'articles': {
      const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1] || '20';
      const res = await request('GET', `/articles?limit=${limit}`);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'health': {
      const res = await request('GET', '/health');
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'auth': {
      const sub = args[1];
      if (sub === 'refresh') {
        const token = args.find(a => a.startsWith('--token='))?.split('=')[1];
        const cookies = args.find(a => a.startsWith('--cookies='))?.split('=')[1];
        if (!token || !cookies) {
          console.error('Usage: auth refresh --token=xxx --cookies=xxx');
          process.exit(1);
        }
        const res = await request('POST', '/auth/refresh', { token, cookies });
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.error('Usage: auth <refresh>');
      }
      break;
    }
    default:
      console.log('Usage: collector-cli <target|articles|health|auth>');
  }
}

main().catch(console.error);
