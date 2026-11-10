import { NavLink } from 'react-router-dom';

export default function Navbar() {
  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm transition ${isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`;
  return (
    <nav className="fixed inset-x-0 top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <NavLink to="/" className="font-semibold tracking-tight text-white">LostArk<span className="text-violet-400">.</span></NavLink>
        <div className="flex items-center gap-1"><NavLink to="/" className={linkClass}>Home</NavLink><NavLink to="/blacklist" className={linkClass}>Black List</NavLink></div>
      </div>
    </nav>
  );
}
