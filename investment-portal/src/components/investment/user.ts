import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export const InvestmentUserContext = createContext<User | null>(null);

// The investment portal lives outside `_authenticated`, so pages read the signed-in user from here instead of route context.
export function useInvestmentUser() {
  const user = useContext(InvestmentUserContext);
  if (!user) throw new Error("useInvestmentUser must be used inside the investment portal");
  return user;
}
