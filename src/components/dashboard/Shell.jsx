import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function Shell({ title, subtitle, headerAction, children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("mk_admin_session") : null;
    if (!saved) {
      navigate({ to: "/login" });
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.role !== "super-admin") {
        navigate({ to: "/login" });
      }
    } catch {
      localStorage.removeItem("mk_admin_session");
      navigate({ to: "/login" });
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} subtitle={subtitle} headerAction={headerAction} />
        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
