import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  Building2,
  ChefHat,
  Users,
  ShoppingBag,
  IndianRupee,
  ArrowRight,
  Sparkles,
  MapPin,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { subscribeToDashboardKpis } from "@/services/dashboardService";
import { subscribeToSocieties } from "@/services/societyService";

export const Route = createFileRoute("/super-admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const [stats, setStats] = useState({
    totalSocieties: 0,
    totalChefs: 0,
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubKpis = subscribeToDashboardKpis((liveStats) => {
      setStats(liveStats);
      setLoading(false);
    });

    const unsubSocs = subscribeToSocieties((list) => {
      setSocieties(list || []);
    });

    return () => {
      unsubKpis();
      unsubSocs();
    };
  }, []);

  return (
    <Shell
      title="Dashboard"
      subtitle="Live operational overview across societies, registered cooks, customers, and revenues."
    >
      {/* Welcome Banner matching App Palette */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#3d1a08] via-[#5c2810] to-[#e8650a] p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-2">
          <Badge className="bg-orange-400/20 text-orange-200 border-orange-400/30">
            Mother's Kitchen Operations
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight font-sans">
            Welcome, Super Admin
          </h2>
          <p className="text-orange-100/90 text-sm leading-relaxed">
            Manage societies, approved cooks, customers, and track daily homemade food orders right across your residential network.
          </p>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-4 opacity-15">
          <ChefHat className="size-48 text-white" />
        </div>
      </div>

      {/* KPI Cards Row (Live DB Counts) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Link to="/super-admin/society" className="group">
          <KpiCard
            title="Total Societies"
            value={stats.totalSocieties}
            icon={Building2}
            tone="blue"
            subtitle="Active delivery zones"
          />
        </Link>
        <Link to="/super-admin/chefs" className="group">
          <KpiCard
            title="Total Chefs"
            value={stats.totalChefs}
            icon={ChefHat}
            tone="emerald"
            subtitle="Registered home cooks"
          />
        </Link>
        <Link to="/super-admin/customers" className="group">
          <KpiCard
            title="Total Customers"
            value={stats.totalCustomers}
            icon={Users}
            tone="orange"
            subtitle="Verified residents"
          />
        </Link>
        <Link to="/super-admin/reports" className="group">
          <KpiCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={ShoppingBag}
            tone="primary"
            subtitle="Delivered orders"
          />
        </Link>
        <Link to="/super-admin/reports" className="group">
          <KpiCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={IndianRupee}
            tone="emerald"
            subtitle="Kitchen network earnings"
          />
        </Link>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Operational Societies */}
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold">Top Performing Societies</CardTitle>
              <p className="text-xs text-muted-foreground">Order volume and revenue by residential hub</p>
            </div>
            <Link to="/super-admin/society">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All Societies <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {societies.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground space-y-2">
                <Building2 className="size-8 mx-auto text-muted-foreground/40" />
                <p className="text-xs">No societies registered in database yet.</p>
                <Link to="/super-admin/society">
                  <Button size="sm" variant="outline" className="mt-1 text-xs rounded-xl">
                    Add First Society
                  </Button>
                </Link>
              </div>
            ) : (
              societies.slice(0, 5).map((soc, idx) => (
                <div
                  key={soc.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-tight">{soc.name}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <MapPin className="size-3 text-muted-foreground" />
                        {soc.area}, {soc.city} • {soc.wings?.length || soc.numberOfWings || 0} Wings
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-700">
                      {formatCurrency(soc.totalRevenue || 0)}
                    </div>
                    <Badge variant={soc.status === "enabled" ? "success" : "destructive"} className="text-[10px] mt-0.5">
                      {soc.status === "enabled" ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Operations Actions */}
        <Card className="border-border flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Quick Actions</CardTitle>
            <p className="text-xs text-muted-foreground">Common administrative workflows</p>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-center">
            <Link to="/super-admin/society">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl text-left cursor-pointer">
                <div className="size-8 rounded-lg bg-sky-500/10 text-sky-700 flex items-center justify-center shrink-0">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">Add New Society</div>
                  <div className="text-[11px] text-muted-foreground">Configure wings and floor counts</div>
                </div>
              </Button>
            </Link>

            <Link to="/super-admin/chefs">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl text-left cursor-pointer">
                <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                  <ChefHat className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">Register New Chef</div>
                  <div className="text-[11px] text-muted-foreground">Provision cook login & delivery mapping</div>
                </div>
              </Button>
            </Link>

            <Link to="/super-admin/highlights">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl text-left cursor-pointer">
                <div className="size-8 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">Update App Highlights</div>
                  <div className="text-[11px] text-muted-foreground">Manage 4 customer home slider banners</div>
                </div>
              </Button>
            </Link>

            <Link to="/super-admin/marketing">
              <Button variant="outline" className="w-full justify-start gap-3 h-12 rounded-xl text-left cursor-pointer">
                <div className="size-8 rounded-lg bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center shrink-0">
                  <Megaphone className="size-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground">WhatsApp Broadcast</div>
                  <div className="text-[11px] text-muted-foreground">Send society targeted promotions</div>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
