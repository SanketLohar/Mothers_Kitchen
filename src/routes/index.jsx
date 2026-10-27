import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const session = typeof window !== "undefined" ? localStorage.getItem("mk_admin_session") : null;
    if (session) {
      throw redirect({ to: "/super-admin" });
    }
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
