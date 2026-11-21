import { createContext, useContext } from "react";
export const AdminIdentity = createContext<string | null>(null);
export function useAdminName() {
  return useContext(AdminIdentity);
}
