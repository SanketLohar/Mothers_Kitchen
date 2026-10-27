import { Outlet, createRootRoute, Link, useRouter } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

function RootErrorComponent({ error, reset }) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-3xl border border-border bg-card shadow-lg">
        <div className="size-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {error?.message || "An unexpected error occurred while rendering the page."}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Try Again</span>
          </Button>
          <Link to="/super-admin">
            <Button size="sm" className="gap-1.5">
              <Home className="size-3.5" />
              <span>Go to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-3xl border border-border bg-card shadow-lg">
        <div className="text-6xl font-black text-primary/30">404</div>
        <h2 className="text-xl font-bold text-foreground">Page Not Found</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The requested page could not be found or may have been moved.
        </p>
        <div className="pt-2">
          <Link to="/super-admin">
            <Button size="sm" className="gap-1.5">
              <Home className="size-3.5" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
