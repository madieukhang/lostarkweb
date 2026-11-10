import { useEffect, useState } from 'react';
import SearchBox from '../components/SearchBox';

const RECENT_KEY = 'lostark-recent-searches';

export default function Home() {
  const [selected, setSelected] = useState(null);
  const [recent, setRecent] = useState([]);
  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')); } catch { setRecent([]); } }, []);
  const select = (item) => {
    setSelected(item);
    setRecent((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 5);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
      return next;
    });
  };
  return <main className="flex min-h-screen items-center justify-center px-4 pb-16 pt-24">
    <section className="flex w-full max-w-3xl -translate-y-8 flex-col items-center text-center">
      <p className="mb-3 text-sm font-medium uppercase tracking-[0.25em] text-violet-400">LostArk Search</p>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">Tìm kiếm nhanh chóng</h1>
      <p className="mb-8 max-w-md text-zinc-400">Tra cứu thông tin nhân vật Lost Ark từ dữ liệu cộng đồng.</p>
      <SearchBox onSelect={select} recentItems={recent} />
      {selected && <div className="mt-8 w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left"><p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Đã chọn</p><h2 className="text-xl font-semibold text-white">{selected.name}</h2><p className="mt-2 text-sm text-zinc-400">Lý do: {selected.reason || 'Chưa cập nhật'}</p><p className="mt-2 text-sm text-zinc-400">Nhân vật liên quan: {selected.allCharacters?.join(', ') || selected.name}</p></div>}
    </section>
  </main>;
}
