// Menu lateral. Os itens e permissões vêm de layout/navigation.ts.
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrandMark } from "@/components/layout/BrandMark";
import { visibleGroups } from "@/components/layout/navigation";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const STORAGE_KEY = "lt-sidebar-groups";

function loadOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export const Sidebar = ({ activeTab, setActiveTab }: SidebarProps) => {
  const { userRole } = useCustomAuth();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const groups = visibleGroups(userRole);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpen);

  const toggleGroup = (id: string, open: boolean) =>
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: open };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* sem armazenamento local */
      }
      return next;
    });

  const go = (id: string) => {
    setActiveTab(id);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarPrimitive collapsible="icon">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3">
        <button
          type="button"
          onClick={() => go("dashboard")}
          className="flex items-center rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          title="Ir para o painel"
        >
          <BrandMark compact={collapsed} />
        </button>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {groups.map((group) => {
          const hasActive = group.items.some((i) => i.id === activeTab);
          const isOpen = collapsed ? true : (openGroups[group.id] ?? true) || hasActive;

          return (
            <Collapsible key={group.id} open={isOpen} onOpenChange={(open) => toggleGroup(group.id, open)}>
              <SidebarGroup className="py-1">
                {!collapsed && (
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="flex h-7 cursor-pointer items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground">
                      <span>{group.label}</span>
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const active = activeTab === item.id;
                        return (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              isActive={active}
                              onClick={() => go(item.id)}
                              tooltip={item.label}
                              className={cn(
                                "h-9 gap-3 rounded-lg text-[13.5px] font-medium text-sidebar-foreground/80",
                                "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                "data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-foreground",
                                "data-[active=true]:shadow-[inset_3px_0_0_0_hsl(var(--sidebar-primary))]",
                              )}
                            >
                              <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-sidebar-primary" : "opacity-70")} />
                              <span className="truncate">{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarRail />
    </SidebarPrimitive>
  );
};
