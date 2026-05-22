import { Link } from '@tanstack/react-router';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { ProjectSwitcher } from './project/ProjectSwitcher';

export function AppTopBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <header className="h-12 border-b border-rule bg-paper flex items-center px-3 sm:px-4 gap-2 sm:gap-4">
      <Link to="/" className="font-semibold text-[14px]">Gantt</Link>
      <ProjectSwitcher />
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {user?.role === 'admin' && (
          <Link to="/settings/users" className="hidden sm:inline text-[12px] text-muted hover:text-ink">Users</Link>
        )}
        <Link
          to="/settings/profile"
          className="text-[12px] text-muted hover:text-ink truncate max-w-[120px] sm:max-w-none"
          title={user?.email}
        >
          <span className="hidden sm:inline">{user?.email}</span>
          <span className="sm:hidden">Profile</span>
        </Link>
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
          className="w-6 h-6 grid place-items-center rounded text-muted hover:text-ink hover:bg-mist text-[13px] leading-none"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button onClick={logout} className="text-[12px] text-muted hover:text-ink">
          <span className="hidden sm:inline">Sign out</span>
          <span className="sm:hidden">Exit</span>
        </button>
      </div>
    </header>
  );
}
