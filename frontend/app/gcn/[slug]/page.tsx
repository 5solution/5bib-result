'use client';

import { use, useState } from 'react';

/**
 * FEATURE-090 — Public Crew GCN search + download page.
 * Crew gõ tên → tìm trong đợt → render GCN PNG (tải về).
 * Gọi backend qua frontend `/api/*` proxy.
 */

interface CrewResult {
  id: string;
  fullName: string;
  position: string;
}

export default function GcnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<CrewResult[]>([]);
  const [selected, setSelected] = useState<CrewResult | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setState('loading');
    setSelected(null);
    try {
      const res = await fetch(
        `/api/crew-certificates/public/${encodeURIComponent(slug)}/search?name=${encodeURIComponent(name.trim())}`,
      );
      if (!res.ok) throw new Error('not found');
      setResults((await res.json()) as CrewResult[]);
      setState('done');
    } catch {
      setResults([]);
      setState('error');
    }
  }

  const renderUrl = selected
    ? `/api/crew-certificates/public/render/${selected.id}`
    : '';

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-stone-900">Giấy chứng nhận Crew</h1>
      <p className="mt-1 text-sm text-stone-500">Nhập tên của bạn để tìm và tải Giấy chứng nhận.</p>

      <form onSubmit={search} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Họ và tên của bạn"
          className="flex-1 rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-blue-600"
        />
        <button
          type="submit"
          disabled={name.trim().length < 2}
          className="rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white disabled:opacity-50"
        >
          Tìm
        </button>
      </form>

      <div className="mt-8">
        {state === 'loading' && <p className="text-stone-500">Đang tìm…</p>}
        {state === 'error' && <p className="text-stone-500">Không tìm thấy. Kiểm tra lại tên hoặc liên hệ BTC.</p>}
        {state === 'done' && results.length === 0 && (
          <p className="text-stone-500">Không tìm thấy “{name}”. Thử gõ đầy đủ họ tên.</p>
        )}

        {!selected && results.length > 0 && (
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setSelected(r)}
                  className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-4 py-3 text-left hover:border-blue-600"
                >
                  <span>
                    <span className="font-medium text-stone-900">{r.fullName}</span>
                    <span className="ml-2 text-sm text-stone-500">{r.position}</span>
                  </span>
                  <span className="text-sm text-blue-700">Xem GCN →</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <div className="space-y-4">
            <button onClick={() => setSelected(null)} className="text-sm text-blue-700">← Chọn người khác</button>
            <p className="font-medium text-stone-900">{selected.fullName} — {selected.position}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={renderUrl} alt={`GCN ${selected.fullName}`} className="w-full rounded-lg border border-stone-200" />
            <a
              href={renderUrl}
              download={`GCN-${selected.fullName}.png`}
              className="inline-block rounded-lg bg-blue-700 px-5 py-2.5 font-medium text-white"
            >
              Tải Giấy chứng nhận
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
