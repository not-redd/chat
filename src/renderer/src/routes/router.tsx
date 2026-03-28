import { RootRoute, Route, Router, Outlet } from "@tanstack/react-router";

import App from "../App";

export function RootLayout(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Outlet />
    </div>
  );
}

const rootRoute = new RootRoute({
  component: RootLayout
});

const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App
});

const aboutRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: function About(): React.JSX.Element {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">About</h1>
        <p className="text-lg">This is the about page.</p>
      </div>
    );
  }
});

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute]);

// oxlint-disable-next-line
export const router = new Router({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
