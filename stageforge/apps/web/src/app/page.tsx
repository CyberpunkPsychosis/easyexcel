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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  const userId = session.user.id;

  const [projects, totals] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { episodes: true, characters: true } } },
    }),
    prisma.creditLedger.groupBy({
      by: ['currency'],
      where: { userId, kind: 'charge' },
      _sum: { deltaCents: true },
    }),
  ]);

  const storyboardAdapters = listAdapters('text.storyboard').map(serializeAdapter);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Stage<span className="text-blue-400">Forge</span>
          </h1>
          <p className="text-sm text-slate-400">
            每个环节自由切换任意模型 · 编剧 → 分镜 → 关键帧 → 视频 → 配音 → 口型 → 成片
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <section className="mt-6 flex flex-wrap gap-3">
        {totals.length === 0 && (
          <div className="card px-4 py-3 text-sm text-slate-400">累计消耗：暂无</div>
        )}
        {totals.map((t) => (
          <div key={t.currency} className="card px-4 py-3">
            <div className="text-xs text-slate-500">累计消耗（{t.currency}，含全部重roll）</div>
            <div className="text-xl font-semibold text-white">
              {formatCents(-(t._sum.deltaCents ?? 0), t.currency)}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <NewProjectForm storyboardAdapters={storyboardAdapters} />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card block p-5 transition hover:border-blue-600">
            <h3 className="font-semibold text-white">{p.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-400">{p.description ?? '—'}</p>
            <div className="mt-3 flex gap-4 text-xs text-slate-500">
              <span>{p._count.episodes} 集</span>
              <span>{p._count.characters} 角色</span>
              <span>{p.updatedAt.toLocaleDateString('zh-CN')}</span>
            </div>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-slate-500">
            还没有项目。新建项目并粘贴剧本，30 秒后你会得到一张可投产的分镜表。
          </p>
        )}
      </section>
    </main>
  );
}
