"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import { RoleKey, DEFAULT_ROLE } from "@/lib/roleConfig";

interface RoleContextType {
  activeRole: RoleKey;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  loading: boolean;
  logout: () => void;
}

const RoleContext = createContext<RoleContextType>({
  activeRole: DEFAULT_ROLE,
  user: null,
  loading: true,
  logout: () => {},
});

const mapDbRoleToKey = (role: string): RoleKey => {
  switch (role) {
    case "Super Admin": return "super_admin";
    case "Owner": return "owner";
    case "CS / Sales": return "cs_sales";
    case "Chef / Kitchen": return "chef";
    case "Kitchen": return "chef";
    case "Purchasing": return "purchasing";
    case "Finance / Keuangan": return "finance";
    case "Finance": return "finance";
    case "HR": return "hr";
    case "HRD": return "hr";
    default: return "super_admin";
  }
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const loading = status === "loading";
  const user = session?.user
    ? {
        id: (session.user as any).id,
        name: session.user.name || "",
        email: session.user.email || "",
        role: (session.user as any).role || "",
      }
    : null;

  const activeRole = user ? mapDbRoleToKey(user.role) : DEFAULT_ROLE;

  const logout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <RoleContext.Provider value={{ activeRole, user, loading, logout }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
