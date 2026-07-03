'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const SELLING_POINTS = [
  ['01', '任意环节 · 任意模型', '编剧、分镜、关键帧、视频、配音、口型 —— 每一环都能自由换模型，单镜可覆盖'],
  ['02', 'A/B 竞技场', '两个模型跑同一镜头并排选优，把「抽卡」变成可控的生产工序'],
  ['03', '成本一等公民', '每次重roll都入账，抽卡税看得见；合规卡点与 AI 标识水印内置'],
] as const;

function LoginForm() {
  const [email, setEmail] = useState('demo@stageforge.dev');
  const [password, setPassword] = useState('stageforge');
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();
  const error = params.get('error');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn('credentials', { email, password, callbackUrl: '/' });
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen">
      {/* 品牌面板 */}
      <section className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="sprockets absolute left-0 right-0 top-0" />
        <div className="sprockets absolute bottom-0 left-0 right-0" />

        {/* 装饰 9:16 画框 */}
        <div
          className="pointer-events-none absolute -right-16 top-1/2 h-[560px] w-[315px] -translate-y-1/2 rotate-6 rounded-[28px] border border-slate-800 opacity-70"
          style={{
            background:
              'linear-gradient(200deg, rgba(207,154,66,0.14), rgba(20,19,16,0.9) 45%, rgba(117,152,95,0.08))',
          }}
        >
          <div className="absolute inset-x-0 top-0 h-14 rounded-t-[28px] bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 h-14 rounded-b-[28px] bg-black/60" />
          <span className="timecode absolute bottom-4 left-1/2 -translate-x-1/2">9:16 · 00:01:30:00</span>
        </div>

        <header className="animate-fade-up pt-8">
          <p className="micro-label">AI Short-Drama Studio</p>
          <h1 className="display-title mt-3 text-5xl leading-tight">
            Stage<span className="text-blue-400">Forge</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            模型无关的 AI 短剧全流程生产平台。
            <br />
            从剧本到全语种成片 —— 导演坐在调色台前，模型只是插在导轨上的镜头。
          </p>
        </header>

        <ul className="max-w-md space-y-6 pb-10">
          {SELLING_POINTS.map(([no, title, desc], i) => (
            <li key={no} className="animate-fade-up flex gap-4" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
              <span className="font-display text-2xl text-blue-600">{no}</span>
              <div>
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 登录表单 */}
      <section className="flex w-full items-center justify-center p-6 lg:w-[480px] lg:border-l lg:border-slate-800/70">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden">
            <p className="micro-label">AI Short-Drama Studio</p>
            <h1 className="display-title mt-2 text-4xl">
              Stage<span className="text-blue-400">Forge</span>
            </h1>
          </div>

          <div className="mt-10 lg:mt-0">
            <p className="micro-label">Sign In</p>
            <h2 className="display-title mt-2 text-2xl">进入制片间</h2>
            <span className="rule-gold mt-3" />
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="micro-label mb-2 block">邮箱</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="micro-label mb-2 block">密码</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-400">登录失败，请检查邮箱与密码</p>}
            <button className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? '登录中…' : '开机'}
            </button>
          </form>
          <p className="mt-6 text-center font-mono text-[11px] text-slate-600">
            demo@stageforge.dev / stageforge
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
