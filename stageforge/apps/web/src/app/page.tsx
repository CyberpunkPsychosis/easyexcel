import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { prisma } from '@stageforge/db';
import { listAdapters, serializeAdapter } from '@stageforge/adapters';
import { authOptions } from '@/lib/auth';
import { NewProjectForm } from '@/components/new-project-form';
import { SignOutButton } from '@/components/signout-button';
import { formatCents } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 项目封面：项目名哈希 → 双色低饱和渐变（每个项目一张独一无二的"海报"） */
function coverGradient(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const h2 = (h + 48) % 360;
  return `linear-gradient(155deg, hsl(${h} 38% 26%) 0%, hsl(${h} 30% 13%) 55%, hsl(${h2} 42% 18%) 100%)`;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const [projects, totals] = await Promise.all([
    prisma.project.findMany({
      // 自己的 + 被邀请协作的
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { episodes: true, characters: true } } },
    }),
    prisma.creditLedger.groupBy({
      by: ['currency'],
      where: { userId, kind: 'charge' },
      _sum: { deltaCents: true },
    }),
  ]);
  const episodeCount = projects.reduce((a, p) => a + p._count.episodes, 0);

  const storyboardAdapters = listAdapters('text.storyboard').map(serializeAdapter);
  const templates = await prisma.template.findMany({
    where: { OR: [{ builtIn: true }, { authorId: userId }] },
    orderBy: [{ builtIn: 'desc' }, { usedCount: 'desc' }],
    select: { id: true, name: true, genre: true, description: true },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 pb-20">
      <header className="flex items-end justify-between pt-10">
        <div className="animate-fade-up">
          <p className="micro-label">AI Short-Drama Studio</p>
          <h1 className="display-title mt-2 text-4xl">
            Stage<span className="text-blue-400">Forge</span>
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            <span className="rule-gold mr-3" />
            编剧 → 分镜 → 关键帧 → 视频 → 配音 → 口型 → 成片，每一环模型任意切换
          </p>
        </div>
        <div className="flex items-center gap-3 pb-1 text-sm text-slate-500">
          <span className="font-mono text-xs">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>

      {/* 统计瓦片 */}
      <section className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="card animate-fade-up p-5" style={{ animationDelay: '0.05s' }}>
          <p className="micro-label">项目</p>
          <p className="display-title mt-2 text-3xl">{projects.length}</p>
        </div>
        <div className="card animate-fade-up p-5" style={{ animationDelay: '0.1s' }}>
          <p className="micro-label">剧集</p>
          <p className="display-title mt-2 text-3xl">{episodeCount}</p>
        </div>
        {totals.length === 0 ? (
          <div className="card animate-fade-up p-5" style={{ animationDelay: '0.15s' }}>
            <p className="micro-label">累计消耗</p>
            <p className="display-title mt-2 text-3xl text-slate-500">—</p>
          </div>
        ) : (
          totals.slice(0, 2).map((t, i) => (
            <div key={t.currency} className="card animate-fade-up p-5" style={{ animationDelay: `${0.15 + i * 0.05}s` }}>
              <p className="micro-label">累计消耗 · {t.currency}</p>
              <p className="display-title mt-2 text-3xl text-blue-300">
                {formatCents(-(t._sum.deltaCents ?? 0), t.currency)}
              </p>
              <p className="mt-1 text-[10px] text-slate-600">含全部重roll（抽卡税可见）</p>
            </div>
          ))
        )}
      </section>

      <section className="mt-10">
        <NewProjectForm storyboardAdapters={storyboardAdapters} templates={templates} />
      </section>

      {/* 项目海报墙 */}
      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p, i) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="card card-hover animate-fade-up block overflow-hidden"
            style={{ animationDelay: `${0.1 + i * 0.06}s` }}
          >
            <div className="relative h-28" style={{ background: coverGradient(p.name) }}>
              <div className="sprockets absolute inset-x-0 bottom-0 opacity-60" />
              <span className="timecode absolute right-3 top-3 rounded bg-black/50 px-2 py-1">
                EP {String(p._count.episodes).padStart(2, '0')}
              </span>
              <span className="font-display absolute bottom-5 left-4 text-xl font-semibold tracking-wide text-white/95">
                {p.name}
              </span>
            </div>
            <div className="p-4">
              <p className="line-clamp-1 text-xs text-slate-500">{p.description ?? '—'}</p>
              <div className="mt-3 flex items-center gap-4 font-mono text-[10px] text-slate-600">
                <span>{p._count.characters} 角色</span>
                <span>{p.updatedAt.toLocaleDateString('zh-CN')}</span>
                {p.ownerId !== userId && <span className="badge bg-purple-900/60 text-purple-300">协作</span>}
              </div>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <div className="card col-span-full flex flex-col items-center py-20 text-center">
            <p className="font-display text-2xl text-slate-400">「好戏，从一张分镜表开始。」</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
              新建项目并粘贴剧本 —— 30 秒后你会得到一张可投产的分镜表，
              然后逐镜选模型、A/B 选优，直到全语种成片。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
