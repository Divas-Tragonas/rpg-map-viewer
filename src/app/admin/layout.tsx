import { AdminSidebar } from '@/components/admin/AdminSidebar';

export const metadata = { title: 'Back Office — RPG Map Viewer' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace',
      background: '#0d1117',
      color: '#c9d1d9',
    }}>
      <AdminSidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {children}
      </main>
    </div>
  );
}
