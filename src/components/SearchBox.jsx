import { AlertCircle, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { searchItems } from '../lib/api';
import ResultItem from './ResultItem';

export default function SearchBox({ onSelect, recentItems = [] }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const controller = useRef(null);
  const container = useRef(null);

  const runSearch = () => {
    controller.current?.abort();
    if (debounced.trim().length < 1) { setResults([]); setStatus('idle'); return; }
    const next = new AbortController();
    controller.current = next;
    setStatus('loading'); setOpen(true); setActive(-1);
    searchItems(debounced.trim(), next.signal).then((items) => {
      if (!next.signal.aborted) { setResults(items); setStatus('success'); }
    }).catch((error) => {
      if (error.name !== 'AbortError' && !next.signal.aborted) setStatus('error');
    });
  };
  useEffect(runSearch, [debounced]);
  useEffect(() => {
    const handler = (event) => { if (!container.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const items = query.trim() ? results : recentItems;
  const select = (item) => { setQuery(''); setOpen(false); onSelect(item); };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (!open || !items.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => (value + 1) % items.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => (value - 1 + items.length) % items.length); }
    if (event.key === 'Enter' && active >= 0) { event.preventDefault(); select(items[active]); }
  };
  return (
    <div ref={container} className="relative w-full max-w-2xl">
      <div className="flex items-center rounded-2xl border border-zinc-700 bg-zinc-900 px-5 shadow-2xl shadow-black/20 focus-within:border-violet-500">
        <Search className="mr-3 h-6 w-6 shrink-0 text-zinc-500" />
        <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}
          role="combobox" aria-expanded={open} aria-controls="search-results" aria-activedescendant={active >= 0 ? `result-${active}` : undefined}
          className="h-16 min-w-0 flex-1 bg-transparent text-lg text-white outline-none placeholder:text-zinc-500" placeholder="Tìm kiếm nhân vật..." />
        {status === 'loading' && <LoaderCircle className="h-5 w-5 animate-spin text-violet-400" />}
      </div>
      {open && (query.trim() || recentItems.length > 0) && (
        <div id="search-results" role="listbox" className="absolute left-0 right-0 top-[4.5rem] z-10 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {!query.trim() && <div className="px-4 pt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Tìm gần đây</div>}
          {status === 'error' && <div className="flex items-center gap-2 p-4 text-sm text-red-300"><AlertCircle className="h-4 w-4" />Lỗi tìm kiếm. <button className="underline" onClick={runSearch}>Thử lại</button></div>}
          {status === 'success' && !results.length && query.trim() && <div className="p-4 text-sm text-zinc-400">Không tìm thấy kết quả.</div>}
          {items.map((item, index) => <ResultItem key={item.id} id={`result-${index}`} item={item} query={query} active={active === index} onClick={() => select(item)} />)}
        </div>
      )}
    </div>
  );
}
