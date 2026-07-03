'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-white">
          Stage<span className="text-blue-400">Forge</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">模型无关的 AI 短剧全流程生产平台</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">邮箱</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">密码</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-400">登录失败，请检查邮箱与密码</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          seed 演示账号：demo@stageforge.dev / stageforge
        </p>
      </div>
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
