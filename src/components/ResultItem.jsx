import { DISPLAY_FIELDS } from '../config/schema';

export default function ResultItem({ item, query, active, onClick, id }) {
  const label = String(item[DISPLAY_FIELDS[0]] ?? '');
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = query ? label.split(new RegExp(`(${escaped})`, 'ig')) : [label];
  return (
    <button id={id} type="button" role="option" aria-selected={active} onClick={onClick}
      className={`w-full px-4 py-3 text-left ${active ? 'bg-zinc-800' : 'hover:bg-zinc-800/70'}`}>
      <div className="font-medium text-zinc-100">{parts.map((part, index) => part.toLowerCase() === query.toLowerCase() ? <strong key={index} className="text-violet-300">{part}</strong> : part)}</div>
      <div className="mt-1 flex gap-3 text-xs text-zinc-500">
        {DISPLAY_FIELDS.slice(1).map((field) => item[field] != null && <span key={field}>{Array.isArray(item[field]) ? item[field].join(', ') : String(item[field])}</span>)}
      </div>
    </button>
  );
}
