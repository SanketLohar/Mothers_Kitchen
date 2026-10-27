import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Search,
  ShieldCheck,
  AlertCircle,
  Database,
  ChefHat,
  Building2,
  Users,
  ShoppingBag,
  CheckCheck,
  Trash2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const INITIAL_NOTIFICATIONS = [
  {
    id: "notif-1",
    title: "New Chef Registered",
    description: "Sunita Patil registered from Wakad. Review details and allocate delivery societies.",
    time: "10 mins ago",
    type: "chef",
    read: false,
    link: "/super-admin/chefs",
  },
  {
    id: "notif-2",
    title: "Chef Active Online",
    description: "Chef Sam turned online to accept lunch orders in Green Valley Society.",
    time: "40 mins ago",
    type: "chef",
    read: false,
    link: "/super-admin/chefs",
  },
  {
    id: "notif-3",
    title: "High Society Demand",
    description: "Blue Ridge Society in Hinjewadi reached 15 active meal subscriptions.",
    time: "2 hours ago",
    type: "society",
    read: false,
    link: "/super-admin/society",
  },
  {
    id: "notif-4",
    title: "Customer Database Growth",
    description: "8 new customer addresses registered across Baner and Wakad societies.",
    time: "5 hours ago",
    type: "customer",
    read: true,
    link: "/super-admin/customers",
  },
];

export function Topbar({ title, subtitle, headerAction }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mk_superadmin_notifications");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore error
        }
      }
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread'

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("mk_superadmin_notifications", JSON.stringify(notifications));
    }
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read!");
  };

  const handleClearAll = () => {
    setNotifications([]);
    toast.info("Notification inbox cleared.");
  };

  const handleNotificationClick = (item) => {
    handleMarkAsRead(item.id);
    setIsOpen(false);
    if (item.link) {
      navigate({ to: item.link });
    }
  };

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const getIconForType = (type) => {
    switch (type) {
      case "chef":
        return <ChefHat className="size-4 text-orange-600" />;
      case "society":
        return <Building2 className="size-4 text-blue-600" />;
      case "customer":
        return <Users className="size-4 text-emerald-600" />;
      default:
        return <ShoppingBag className="size-4 text-amber-600" />;
    }
  };

  const getBgForType = (type) => {
    switch (type) {
      case "chef":
        return "bg-orange-100/70 border-orange-200";
      case "society":
        return "bg-blue-100/70 border-blue-200";
      case "customer":
        return "bg-emerald-100/70 border-emerald-200";
      default:
        return "bg-amber-100/70 border-amber-200";
    }
  };

  return (
    <header className="sticky top-0 z-30 flex flex-col bg-card/95 backdrop-blur-md border-b border-border">
      {/* Setup / Demo Status Banner */}
      {!isFirebaseConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-3.5 text-amber-600 shrink-0" />
            <span className="font-medium">
              Running with Mother's Kitchen <strong>Demo Data</strong>. Firebase environment variables are unconfigured.
            </span>
          </div>
          <span className="text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
            Ready for Mother's Kitchen Firebase Web App
          </span>
        </div>
      )}

      {/* Main Topbar */}
      <div className="h-16 px-6 flex items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {headerAction}

          {/* Interactive Notifications Popover */}
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="size-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center transition-colors relative cursor-pointer"
                title="Notifications"
                aria-label="View notifications"
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 size-4.5 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                      {unreadCount}
                    </span>
                    <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary animate-ping opacity-75" />
                  </>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-80 sm:w-96 p-0 rounded-2xl shadow-xl border-border bg-card overflow-hidden"
            >
              {/* Header */}
              <div className="p-3.5 border-b border-border/80 bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Bell className="size-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground">Notifications</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {unreadCount} unread system alert{unreadCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="h-7 text-[11px] px-2 text-muted-foreground hover:text-primary gap-1 cursor-pointer"
                      title="Mark all as read"
                    >
                      <CheckCheck className="size-3.5" />
                      <span>Read all</span>
                    </Button>
                  )}
                  {notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="h-7 text-[11px] px-2 text-muted-foreground hover:text-destructive gap-1 cursor-pointer"
                      title="Clear notifications"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Tab Filters */}
              <div className="px-3 pt-2 pb-1.5 border-b border-border/50 flex items-center gap-2 bg-card">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    activeTab === "all"
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("unread")}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === "unread"
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>Unread</span>
                  {unreadCount > 0 && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </div>

              {/* Notification List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center space-y-2">
                    <div className="size-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                      <Bell className="size-5 opacity-40" />
                    </div>
                    <p className="text-xs font-bold text-foreground">No notifications</p>
                    <p className="text-[11px] text-muted-foreground">
                      {activeTab === "unread"
                        ? "You're all caught up! No unread alerts."
                        : "No new activity logged at this time."}
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-muted/50 ${
                        !notif.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div
                        className={`size-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${getBgForType(
                          notif.type
                        )}`}
                      >
                        {getIconForType(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <h4
                            className={`text-xs font-bold truncate ${
                              !notif.read ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                            {notif.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {notif.description}
                        </p>
                      </div>

                      {!notif.read && (
                        <span className="size-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-2 bg-muted/30 border-t border-border/80 flex items-center justify-between text-[11px] text-muted-foreground px-3">
                <span className="font-medium">Mother's Kitchen Portal</span>
                <span className="text-[10px] text-muted-foreground font-mono">Live Sync</span>
              </div>
            </PopoverContent>
          </Popover>

          {/* Admin Avatar Pill */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-border">
            <div className="size-8 rounded-full bg-primary/15 border border-primary/30 text-primary font-bold text-xs flex items-center justify-center">
              AD
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-foreground leading-tight">Admin</div>
              <div className="text-[10px] text-muted-foreground">Super Admin</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
