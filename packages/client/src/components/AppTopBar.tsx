import { Link } from '@tanstack/react-router';
import { useAuth } from '../lib/auth';
import { ProjectSwitcher } from './project/ProjectSwitcher';

export function AppTopBar() {
  const { user, logout } = useAuth();
  return (
    <header className="h-12 border-b border-rule bg-paper flex items-center px-4 gap-4">
      <Link to="/" className="font-semibold text-[14px]">Gantt</Link>
      <ProjectSwitcher />
      <div className="ml-auto flex items-center gap-3">
        {user?.role === 'admin' && (
          <Link to="/settings/users" className="text-[12px] text-muted hover:text-ink">Users</Link>
        )}
        <span className="text-[12px] text-muted">{user?.email}</span>
        <button onClick={logout} className="text-[12px] text-muted hover:text-ink">Sign out</button>
      </div>
    </header>
  );
}
