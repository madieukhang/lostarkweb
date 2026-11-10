import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Blacklist from './pages/Blacklist';
import Home from './pages/Home';

function NotFound() { return <main className="flex min-h-screen items-center justify-center pt-16 text-center"><div><h1 className="text-4xl font-bold text-white">404</h1><p className="mt-2 text-zinc-400">Trang không tồn tại.</p></div></main>; }

export default function App() {
  return <><Navbar /><Routes><Route path="/" element={<Home />} /><Route path="/blacklist" element={<Blacklist />} /><Route path="*" element={<NotFound />} /></Routes></>;
}
