import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "storekeeper" | "technician";

export interface Profile {
  id: string;
  email: string;
  arabic_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  permissions: Record<string, boolean>;
  loading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStorekeeper: boolean;
  isTechnician: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    const [{ data: profileData }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    // Block inactive users
    if (profileData && profileData.is_active === false) {
      await supabase.auth.signOut();
      setProfile(null);
      setRoles([]);
      setUser(null);
      setSession(null);
      return;
    }
    setProfile(profileData as Profile | null);
    
    const userRoles = (rolesData?.map((r) => r.role) ?? []) as AppRole[];
    setRoles(userRoles);

    // Fetch permissions based on primary role
    if (userRoles.length > 0) {
      const primaryRole = userRoles[0];
      const { data: permData } = await supabase.from("role_permissions").select("permissions").eq("role", primaryRole).maybeSingle();
      if (permData && permData.permissions) {
        setPermissions(permData.permissions as Record<string, boolean>);
      }
    }
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid deadlock
        setTimeout(() => loadUserData(newSession.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
        setPermissions({});
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadUserData(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setPermissions({});
  };

  const refreshProfile = async () => {
    if (user) await loadUserData(user.id);
  };

  const value: AuthContextValue = {
    user,
    session,
    profile,
    roles,
    permissions,
    loading,
    isSuperAdmin: roles.includes("super_admin"),
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isStorekeeper: roles.includes("storekeeper") || roles.includes("super_admin"),
    isTechnician: roles.includes("technician") || roles.includes("super_admin"),
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
