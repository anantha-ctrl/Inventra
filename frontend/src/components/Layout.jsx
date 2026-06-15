import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="sh-app">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="sh-main">
        <Topbar onToggleSidebar={() => setOpen((v) => !v)} />
        <main className="sh-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
