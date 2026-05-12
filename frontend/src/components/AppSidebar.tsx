import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  Menu,
  LogOut,
  User,
  Lock,
  X,
} from "lucide-react";
import { getMe, logoutApi } from "@/api";
import type { UserProfile } from "@/types";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { EditProfileModal } from "@/components/auth/EditProfileModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/ModeToggle";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: string | number;
}

export interface SidebarUser {
  name: string;
  email: string;
  avatar?: string;
}

export interface AppSidebarProps {
  user: SidebarUser;
  navItems?: NavItem[];
  onLogout: () => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Projets", icon: FolderOpen, href: "/projects" },
  { label: "Messages", icon: MessageSquare, href: "/messages" },
  { label: "Analytiques", icon: BarChart3, href: "/analytics" },
  { label: "Paramètres", icon: Settings, href: "/settings" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

function useSidebarOpen(isMobile: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebar-open");
    return stored !== null ? stored === "true" : true;
  });

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-open", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [isMobile]);

  return { open, toggle, setOpen };
}

// ── Nav item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  item: NavItem;
  isOpen: boolean;
  isActive: boolean;
  onClick: () => void;
}

function SidebarNavItem({ item, isOpen, isActive, onClick }: NavItemProps) {
  const Icon = item.icon;

  const inner = (
    <button
      onClick={onClick}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium",
        "transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        !isOpen && "justify-center px-0",
      )}
    >
      <Icon
        className={cn(
          "flex-shrink-0 transition-colors",
          isOpen ? "h-4 w-4" : "h-5 w-5",
          isActive
            ? "text-primary"
            : "text-sidebar-muted-foreground group-hover:text-sidebar-accent-foreground",
        )}
      />
      {isOpen && (
        <span className="truncate flex-1 text-left">{item.label}</span>
      )}
      {isOpen && item.badge !== undefined && (
        <Badge className="ml-auto h-4 min-w-[1.25rem] px-1 text-[10px] bg-primary text-primary-foreground border-0">
          {item.badge}
        </Badge>
      )}
      {!isOpen && item.badge !== undefined && (
        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
      )}
    </button>
  );

  if (isOpen) return <li>{inner}</li>;

  return (
    <li className="relative">
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
          {item.badge !== undefined && (
            <Badge className="ml-2 h-4 px-1 text-[10px] bg-primary text-primary-foreground border-0">
              {item.badge}
            </Badge>
          )}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

// ── Profile dropdown ──────────────────────────────────────────────────────────

interface ProfileProps {
  user: SidebarUser;
  isOpen: boolean;
  onLogout: () => void;
}

function SidebarProfile({ user, isOpen, onLogout }: ProfileProps) {
  const [profile,          setProfile]          = useState<UserProfile | null>(null);
  const [showChangePwd,    setShowChangePwd]    = useState(false);
  const [showEditProfile,  setShowEditProfile]  = useState(false);

  useEffect(() => {
    getMe().then(setProfile).catch(() => {});
  }, []);

  const displayName = profile?.display_name ?? user.name;
  const email       = profile?.email        ?? user.email;

  async function handleLogout() {
    await logoutApi();
    onLogout();
  }

  const avatar = (
    <Avatar className="h-8 w-8 flex-shrink-0 ring-2 ring-border">
      {user.avatar && <AvatarImage src={user.avatar} alt={displayName} />}
      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs">
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Profile menu"
            className={cn(
              "w-full flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors outline-none",
              "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
              !isOpen && "justify-center",
            )}
          >
            {avatar}
            {isOpen && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-sidebar-foreground truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-sidebar-muted-foreground truncate">
                  {email}
                </p>
              </div>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-60 shadow-xl">

          {/* Header */}
          <div className="flex items-center gap-3 px-2 py-2.5 mb-1 rounded-md bg-muted/60">
            <Avatar className="h-9 w-9 flex-shrink-0">
              {user.avatar && <AvatarImage src={user.avatar} alt={displayName} />}
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
          </div>

          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-2 py-1">
            Account
          </DropdownMenuLabel>

          <DropdownMenuItem onClick={() => setShowEditProfile(true)} className="text-foreground">
            <User className="h-4 w-4" />
            Edit profile
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowChangePwd(true)} className="text-foreground">
            <Lock className="h-4 w-4" />
            Change password
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleLogout}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordModal open={showChangePwd} onOpenChange={setShowChangePwd} />
      <EditProfileModal
        open={showEditProfile}
        onOpenChange={setShowEditProfile}
        profile={profile}
        onUpdated={setProfile}
      />
    </>
  );
}

// ── Sidebar inner ─────────────────────────────────────────────────────────────

interface SidebarInnerProps {
  user: SidebarUser;
  navItems: NavItem[];
  isOpen: boolean;
  onToggle: () => void;
  onLogout: () => void;
  onNav?: () => void;
}

function SidebarInner({
  user,
  navItems,
  isOpen,
  onToggle,
  onLogout,
  onNav,
}: SidebarInnerProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleNav(href: string) {
    navigate(href);
    onNav?.();
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col gap-2 py-3">
        {/* Brand + toggle */}
        <div
          className={cn(
            "flex items-center px-3 mb-1",
            isOpen ? "justify-between" : "justify-center",
          )}
        >
          {isOpen && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <span className="text-white font-bold text-xs">R</span>
              </div>
              <span className="font-semibold text-sidebar-foreground text-sm tracking-tight">
                RAG Q&amp;A
              </span>
            </button>
          )}
          <button
            onClick={onToggle}
            aria-label={isOpen ? "Réduire le menu" : "Ouvrir le menu"}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                !isOpen && "rotate-180",
              )}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2" aria-label="Navigation principale">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.href}
                item={item}
                isOpen={isOpen}
                isActive={
                  location.pathname === item.href ||
                  location.pathname.startsWith(item.href + "/")
                }
                onClick={() => handleNav(item.href)}
              />
            ))}
          </ul>
        </nav>

        {/* Footer: mode toggle + profile */}
        <div className="px-2 pt-2 border-t border-sidebar-border flex flex-col gap-0.5">
          {isOpen ? (
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs text-sidebar-muted-foreground">
                Appearance
              </span>
              <ModeToggle className="h-7 w-7 text-sidebar-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" />
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <ModeToggle className="h-8 w-8 text-sidebar-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Appearance</TooltipContent>
            </Tooltip>
          )}
          <SidebarProfile user={user} isOpen={isOpen} onLogout={onLogout} />
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── AppSidebar ────────────────────────────────────────────────────────────────

export function AppSidebar({
  user,
  navItems = DEFAULT_NAV,
  onLogout,
}: AppSidebarProps) {
  const isMobile = useIsMobile();
  const { open, toggle, setOpen } = useSidebarOpen(isMobile);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le menu"
          className="fixed top-3 left-3 z-40 h-9 w-9 rounded-lg flex items-center justify-center bg-sidebar border border-sidebar-border text-sidebar-muted-foreground hover:text-sidebar-accent-foreground shadow-md md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border shadow-xl",
            "transform transition-transform duration-250 ease-in-out md:hidden",
            open ? "translate-x-0" : "-translate-x-full",
          )}
          aria-label="Menu de navigation"
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="absolute top-3 right-3 h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
          >
            <X className="h-4 w-4" />
          </button>
          <SidebarInner
            user={user}
            navItems={navItems}
            isOpen
            onToggle={() => setOpen(false)}
            onLogout={onLogout}
            onNav={() => setOpen(false)}
          />
        </aside>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col flex-shrink-0 bg-sidebar border-r border-sidebar-border h-screen",
        "transition-all duration-200 ease-in-out",
        open ? "w-60" : "w-14",
      )}
      aria-label="Menu de navigation"
    >
      <SidebarInner
        user={user}
        navItems={navItems}
        isOpen={open}
        onToggle={toggle}
        onLogout={onLogout}
      />
    </aside>
  );
}

// ── SidebarLayout ─────────────────────────────────────────────────────────────

interface SidebarLayoutProps {
  sidebarProps: AppSidebarProps;
  children: React.ReactNode;
}

export function SidebarLayout({ sidebarProps, children }: SidebarLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar {...sidebarProps} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
