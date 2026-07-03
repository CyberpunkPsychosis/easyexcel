# StageForge 部署指南（Vercel + Railway）

> **为什么不是 GitHub Pages**：GitHub Pages 只能托管静态文件。StageForge 有 PostgreSQL、
> Redis 队列、常驻 worker 进程和服务端 ffmpeg 合成，必须跑在能执行服务端代码的平台。
> GitHub 在本方案中的角色是**代码仓库 + CI 触发源**：push 后 Vercel/Railway 自动拉取部署。

## 拓扑

| 组件 | 平台 | 说明 |
|---|---|---|
| Next.js（页面 + API routes） | **Vercel** | API 只做「提交任务/查状态」，不碰长耗时生成，天然适配 serverless 时长限制 |
| PostgreSQL | **Railway** | 托管 Postgres 插件 |
| Redis | **Railway** | 托管 Redis 插件（BullMQ 队列） |
| Worker（BullMQ 消费者 + ffmpeg） | **Railway** | 常驻进程，镜像内需安装 ffmpeg |
| 资产存储 | **Cloudflare R2 / AWS S3** | 生产必须用 S3 驱动（Vercel/Railway 文件系统均为临时盘） |

## 一、Railway（数据库 / Redis / Worker）

1. railway.app 新建项目，依次 **New → Database → PostgreSQL** 和 **New → Database → Redis**。
2. **New → GitHub Repo** 选择本仓库，新建 service 命名 `stageforge-worker`：
   - Settings → Root Directory：`stageforge`
   - Settings → Build：默认 Nixpacks 即可；在 Settings → Deploy → Custom Start Command 填：
     ```
     npm run start -w @stageforge/worker
     ```
   - 需要 ffmpeg：Settings → Nixpacks 添加 apt 包 `ffmpeg`（或改用 Dockerfile，`apt-get install -y ffmpeg`）。
3. Worker service → Variables 注入（用 Railway 的引用语法直接引数据库变量）：
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   STORAGE_DRIVER=s3
   S3_ENDPOINT=<R2/S3 endpoint>
   S3_REGION=auto
   S3_BUCKET=stageforge
   S3_ACCESS_KEY_ID=…
   S3_SECRET_ACCESS_KEY=…
   S3_FORCE_PATH_STYLE=true
   ANTHROPIC_API_KEY=…            # 可选；其余模型 key 同理
   ```
4. 初始化数据库（本地执行一次，DATABASE_URL 指向 Railway Postgres 的公网连接串）：
   ```bash
   DATABASE_URL=postgresql://… npm run db:push
   DATABASE_URL=postgresql://… npm run db:seed
   ```

## 二、Vercel（前端 + API）

1. vercel.com → Add New Project → 选本 GitHub 仓库。
2. 项目设置：
   - **Root Directory**：`stageforge/apps/web`
   - Framework：Next.js（自动识别）
   - Install Command 覆盖为：`cd ../.. && npm install`
   - Build Command 覆盖为：`cd ../.. && npm run build`
3. Environment Variables（与 Railway worker 保持一致的那几项 + NextAuth）：
   ```
   DATABASE_URL=…            # Railway Postgres 公网连接串
   REDIS_URL=…               # Railway Redis 公网连接串
   STORAGE_DRIVER=s3
   S3_ENDPOINT / S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_FORCE_PATH_STYLE
   NEXTAUTH_URL=https://<your-app>.vercel.app
   NEXTAUTH_SECRET=<openssl rand -base64 32>
   ANTHROPIC_API_KEY=…       # 可选
   ```
4. Deploy。之后每次 push 自动构建。

## 三、验证清单（M1）

- [ ] `https://<app>.vercel.app/login` 打开，demo 账号可登录
- [ ] 首页看到 seed 示例项目；新建项目 + 粘贴剧本 → 分镜出现（worker 日志有任务消费记录）
- [ ] 工作台对一个镜头生成关键帧/视频（mock），变体缩略图出现且可选优
- [ ] Stage Rail 切换模型下拉生效（换 adapter 后再生成，任务记录的 adapterId 变化）
- [ ] 「合成」产出成片 mp4 可下载（验证 Railway 镜像里 ffmpeg 就位）
- [ ] 成本页有按环节/模型的流水

## 常见问题

- **Vercel 构建时 Prisma 报错找不到引擎**：确认 Install Command 是在 monorepo 根执行的
  `npm install`（postinstall 会下载引擎）；`npm run build` 已内置 `prisma generate`。
- **任务一直 queued**：worker 没起来或 REDIS_URL 不一致。看 Railway worker 日志应有
  `StageForge worker 启动`。Vercel 与 Railway 必须指向**同一个** Redis。
- **合成失败提示无 ffmpeg**：Railway worker 镜像未装 ffmpeg，见上文 Nixpacks/Dockerfile 说明。
- **资产 404 / 部署后图片丢失**：生产忘了切 `STORAGE_DRIVER=s3`。local 驱动只适合本机开发。
- **免费额度**：Vercel Hobby + Railway 免费档足够 M1 演示；Railway Redis/Postgres 免费档有
  容量限制，量产前升级。
