import { Fragment, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePlatformAuthStore } from "../store/platformAuthStore.ts";

export function PlatformProtectedRoute({ children }: { children: ReactNode }) {
  const user = usePlatformAuthStore((state) => state.user);
  const location = useLocation();
  if (!user || user.role !== "PLATFORM_ADMIN" || !user.isActive)
    return (
      <Navigate
        to="/platform/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  return <Fragment key={user.id}>{children}</Fragment>;
}
