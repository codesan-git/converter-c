import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import Sidebar from '@/components/Sidebar';

export const Route = createRootRoute({
  component: () => (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 transition-all duration-300">
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </div>
  ),
});