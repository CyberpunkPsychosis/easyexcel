'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button className="btn-ghost text-xs" onClick={() => signOut({ callbackUrl: '/login' })}>
      退出
    </button>
  );
}
