# Docker 部署指南 (WeChat Collector)

本指南介绍如何使用 Docker 部署 WeChat Collector 服务，并连接到现有的 PostgreSQL 数据库。

## 部署文件

- **Dockerfile**: `Dockerfile.collector` (独立文件，不影响项目原有 Dockerfile)
- **Compose**: `docker-compose.yml`

## 部署步骤

### 1. 配置数据库连接

打开 `docker-compose.yml`，修改 `DATABASE_URL` 环境变量以匹配您的 PostgreSQL 服务配置。

```yaml
environment:
  - DATABASE_URL=postgresql://您的用户名:您的密码@您的数据库IP:5432/wechat_collector
```

> **注意**: 如果数据库运行在宿主机上，请确保 Docker 容器可以访问宿主机 IP。在 Linux 上，您可能需要配置 `extra_hosts` 或使用宿主机的真实局域网 IP。

### 2. 启动服务

```bash
docker-compose up -d --build
```

### 3. 数据库迁移

服务启动后，执行以下命令初始化表结构：

```bash
docker-compose exec app npx prisma migrate deploy --schema=prisma/schema.prisma
```

### 4. 验证

访问 http://localhost:3000

## 恢复原 Dockerfile

如果您之前不小心覆盖了根目录的 `Dockerfile`，可以通过 git 恢复：

```bash
git checkout Dockerfile
```
