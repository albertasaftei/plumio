import { ParentComponent, Show } from "solid-js";
import { useLocation } from "@solidjs/router";
import { AppLayout } from "./AppLayout";
import { routes } from "~/routes";

// Routes that should NOT have the AppLayout wrapper
const PUBLIC_ROUTES = [routes.login, routes.register] as string[];
const ROUTES_WITHOUT_SIDEBAR = [routes.settings] as string[];

export const AuthenticatedLayout: ParentComponent = (props) => {
  const location = useLocation();

  const isPublicRoute = () => PUBLIC_ROUTES.includes(location.pathname);
  const shouldShowSidebar = () =>
    !ROUTES_WITHOUT_SIDEBAR.includes(location.pathname);

  // Use Show component for reactive conditional rendering
  return (
    <Show when={!isPublicRoute()} fallback={<>{props.children}</>}>
      <AppLayout showSidebar={shouldShowSidebar()}>{props.children}</AppLayout>
    </Show>
  );
};
