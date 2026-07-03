# StageForge

**模型无关的 AI 短剧全流程生产平台** —— 从剧本、分镜、关键帧、视频、配音、口型到 9:16 成片，
**每一个环节都能自由切换任意模型**：项目级设默认，单个镜头可覆盖，还能让两个模型跑同一镜头 A/B 选优。

对标字节「小云雀短剧 Agent」（10 万字剧本一键成片），但小云雀全流程锁死 Seedance 一个模型；
StageForge 的架构第一性原则是：

> **新增一个模型 = 新增一个 adapter 文件 + 注册表加一行，不改动任何流水线代码。**

## 架构

```
┌─ apps/web (Next.js 14) ──────────────────────────────┐
│  仪表盘 / 三栏工作台(Stage Rail) / 分镜表 / 成本仪表盘  │
│  API routes: 提交任务 + 查状态（不做长耗时生成）        │
└───────────────┬──────────────────────────────────────┘
                │ BullMQ (Redis)
┌─ apps/worker ─▼──────────────────────────────────────┐
│  generation 队列: 读 job → 找 adapter → submit→poll   │
│  compose 队列: ffmpeg 拼接+烧字幕 → 9:16 成片          │
└───────────────┬──────────────────────────────────────┘
                │
┌─ packages/adapters ──────────────────────────────────┐
│  registry: Record<Capability, ModelAdapter[]>         │
│  claude(真实) · seedance/kling/hailuo/veo/… (mock)    │
├─ packages/core ──────────────────────────────────────┤
│  Capability/ModelAdapter/CostModel 契约 · 存储 · 队列  │
├─ packages/db (Prisma + PostgreSQL) ──────────────────┤
│  Project→Episode→Scene→Shot→Variant / ShotStage       │
│  ModelConfig(项目默认模型) / CreditLedger(成本流水)     │
└──────────────────────────────────────────────────────┘
```

**13 个能力插槽**：`text.script / text.storyboard / text.translate / image.t2i / image.character /
video.t2v / video.i2v / audio.tts / audio.voiceclone / audio.lipsync / audio.music / audio.sfx / render.compose`

**切模型的三个层级**（全部只是改一个 adapterId，零代码分支）：
1. 项目级默认：`ModelConfig.adapterId`
2. 单镜覆盖：`ShotStage.adapterId`（工作台右侧 Stage Rail 下拉）
3. 单次 A/B：生成请求带 `adapterId` 参数（不落库，只出一个对比变体）

## 快速开始

```bash
cp .env.example .env          # 按需填 ANTHROPIC_API_KEY（不填则全 mock，demo 不断链）
docker compose up -d           # Postgres + Redis + MinIO
npm install
npm run db:push && npm run db:seed
npm run dev                    # web:3000 + worker
```

登录 `demo@stageforge.dev / stageforge`。seed 自带示例项目（2 角色、1 集分镜）。

> 本地需要 `ffmpeg`（mock 视频渲染与成片合成）。没有 ffmpeg 时 mock 视频退化为 SVG 占位、
> 合成会给出明确报错，其余全流程不受影响。

### 一条龙体验

1. 首页「新建项目」→ 粘贴剧本（≤10 万字）→ 选分镜模型 → 创建
2. 几秒后分镜表出现（无 ANTHROPIC_API_KEY 时用确定性 mock；有 key 时走 Claude 真实拆解）
3. 工作台选中镜头 → 右侧 Stage Rail 依次「生成」关键帧 → 视频（下拉可换 Seedance/可灵/海螺/Veo/…）
4. 同一环节点「A/B 对比…」用另一个模型再出一个变体，缩略图点击选优
5. 左侧剧集「合成」→ 拼接选中变体 + 烧字幕 → 成片下载
6. 「成本」页看按环节/模型拆解的真实流水（含全部重roll）

## 证明：新增一个模型只需一个文件 + 一行

活示例见 [`packages/adapters/src/adapters/video/_example-newmodel.ts`](packages/adapters/src/adapters/video/_example-newmodel.ts)。

1. 复制该文件为 `happyhorse.ts`，填新模型的 `id/caps/cost/notes`；
2. 在 [`registry.ts`](packages/adapters/src/registry.ts) 的 `ALL_ADAPTERS` 数组加一行 `happyhorseI2V,`；
3. 完成 —— Stage Rail 下拉、成本估算、生成流水线、A/B 竞技场自动识别新模型。

接真实 API 时把 `defineMockVideoAdapter` 换成手写 `ModelAdapter`（submit 提交第三方任务、poll 查状态），
契约不变。真实与 mock 适配器在流水线眼里没有任何区别（参考 `text/claude.ts`）。

## 模型注册表（M1 seed）

能力声明与参考单价来自 2026-07 多源交叉核验的调研（详见构建规格附录 A），
存疑数据在各 adapter 文件注释中标注来源与不确定性。要点：

| 环节 | 可选模型 | 备注 |
|---|---|---|
| 分镜/剧本/翻译 | **Claude（真实）**、GPT/DeepSeek/Gemini（mock） | 无 key 自动降级 mock |
| 关键帧 | 即梦、Midjourney V7、Flux、ComfyUI 本地 | |
| 视频 | Seedance 2.0、可灵 3.0、海螺 2.3、Veo 3.1、Sora 2（停服警告）、Wan 2.7、Vidu、Runway、LTX-2 | 单段时长上限差异大（8s~60s），UI 徽标展示 |
| 配音/克隆 | ElevenLabs v3、即梦语音、MiniMax | |
| 口型 | sync.so Sync-3、MuseTalk（开源）、剪映 | |
| 配乐/音效 | Suno、Udio、即梦音效 | |
| 合成 | 内置 ffmpeg（字幕默认烧制：80% 观众静音观看） | |

⚠️ 成本口径：UI 区分「单次生成成本」与「预计总成本（含重roll）」——
行业单次成功率常不足 40%，抽卡税才是真实成本大头。

## 常用命令

```bash
npm run dev            # web + worker 一起起
npm run typecheck      # 全 workspace 类型检查
npm run build          # 生产构建（含 prisma generate）
npm run db:push        # 同步 schema 到数据库
npm run db:seed        # 演示数据
```

## 部署

见 [DEPLOY.md](./DEPLOY.md)：Vercel（web）+ Railway（Postgres/Redis/worker）+ R2/S3（资产）。
注意本项目**不能部署到 GitHub Pages**（有数据库/队列/服务端合成）。

## 里程碑

- **M1（当前）**：可运行骨架 —— 鉴权、项目、剧本→分镜（Claude 真实）、镜头流水线（mock 生成）、
  变体/A/B/选优、ffmpeg 合成、成本流水、全模型注册表 + Stage Rail 切换 ✅
- **M2**：真实视频/图像/语音 API 接入（火山引擎/可灵/ElevenLabs/sync.so）、角色一致性系统（全能参考注入 + LoRA 任务 + 人脸相似度打分 + 正反打回退）
- **M3**：出海本地化流水线（译制→克隆配音→口型→多语字幕批量导出）、配乐音效、整集批量生成
- **M4**：团队协作、备案合规卡点（发布前强制检查）、模板市场、数据分析
