import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth, AppRole } from "../contexts/AuthContext";
import { Logo } from "./Logo";

interface ProtectedRouteProps {
  children: ReactNode;
  requireRoles?: AppRole[];
  requirePermission?: string;
}

export const ProtectedRoute = ({ children, requireRoles, requirePermission }: ProtectedRouteProps) => {
  const { user, roles, permissions, loading, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 gradient-surface">
        <Logo size="md" />
        <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super admins override everything
  if (isSuperAdmin) return <>{children}</>;

  if (requirePermission && permissions) {
    if (permissions[requirePermission] === false) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (requireRoles && requireRoles.length > 0) {
    const hasAccess = requireRoles.some((r) => roles.includes(r));
    if (!hasAccess) return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
