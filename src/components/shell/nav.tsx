import { CloudSun, Egg, HandCoins, LayoutDashboard, PawPrint, Settings, ShoppingCart, Wallet, Warehouse, Wheat } from "lucide-react";
import type { ComponentType } from "react";
import { useNavigation } from "@/api/hooks";
import type { MsgKey } from "@/i18n";
import { useCan, useMembership } from "@/stores/session";

export interface NavItem {
  to: string;
  label: MsgKey;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}

/**
 * The menu comes from the navigation payload and the caller's capabilities
 * (6.2). Disabled modules are removed, not greyed out (ONB-04).
 */
export function useNavItems(): { main: NavItem[]; bottom: NavItem[]; ready: boolean } {
  const nav = useNavigation();
  const role = useMembership()?.role;
  const money = useCan("money.read");
  const stock = useCan("stock.read");
  const modules = nav.data?.modules ?? [];
  const worker = role === "field_worker";

  const main: (NavItem | false)[] = [
    { to: "/", label: "nav.dashboard", icon: LayoutDashboard },
    modules.includes("livestock") && { to: "/animals", label: "nav.animals", icon: PawPrint },
    modules.includes("batches") && { to: "/poultry", label: "nav.poultry", icon: Egg },
    modules.includes("crops") && { to: "/crops", label: "nav.crops", icon: Wheat },
    stock && { to: "/stock", label: "nav.stock", icon: Warehouse },
    money && { to: "/sales", label: "nav.sales", icon: HandCoins },
    money && { to: "/purchases", label: "nav.purchases", icon: ShoppingCart },
    money && { to: "/money", label: "nav.money", icon: Wallet },
    { to: "/weather", label: "nav.weather", icon: CloudSun },
  ];
  const bottom: (NavItem | false)[] = [!worker && { to: "/settings", label: "nav.settings", icon: Settings }];
  return { main: main.filter(Boolean) as NavItem[], bottom: bottom.filter(Boolean) as NavItem[], ready: !!nav.data };
}
