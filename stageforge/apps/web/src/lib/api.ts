/** 客户端 fetch 封装：JSON、错误抛出（服务端 handleError 的 error 字段） */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `请求失败 (${res.status})`);
  }
  return data;
}
