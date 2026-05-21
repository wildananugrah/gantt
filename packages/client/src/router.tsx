import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { ProjectPage } from './pages/ProjectPage';
import { MembersPage } from './pages/MembersPage';
import { UsersAdminPage } from './pages/UsersAdminPage';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});

const projectRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$id',
  validateSearch: (s: Record<string, unknown>) =>
    typeof s.task === 'string' ? { task: s.task } : ({} as { task?: string }),
  component: ProjectPage,
});

const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$id/members',
  component: MembersPage,
});

const usersAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings/users',
  component: UsersAdminPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  landingRoute,
  projectRoute,
  membersRoute,
  usersAdminRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}

export { projectRoute, membersRoute };
