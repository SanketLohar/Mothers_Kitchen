import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  Building2,
  ChefHat,
  Store,
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
import { subscribeToOrders } from "@/services/orderService";

export const Route = createFileRoute("/super-admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const [stats, setStats] = useState({
    totalSocieties: 0,
    totalChefs: 0,
    totalSellers: 0,
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [societies, setSocieties] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubKpis = subscribeToDashboardKpis((liveStats) => {
      setStats(liveStats);
      setLoading(false);
    });

    const unsubSocs = subscribeToSocieties((list) => {
      setSocieties(list || []);
    });

    const unsubOrders = subscribeToOrders((list) => {
      setOrders(list || []);
    });

    return () => {
      unsubKpis();
      unsubSocs();
      unsubOrders();
    };
  }, []);

  // Compute Top Performing Societies aggregated from real orders
  const topSocieties = useMemo(() => {
    if (!societies || societies.length === 0) return [];

    return societies
      .map((s) => {
        const socId = String(s.id || "").toLowerCase();
        const socName = String(s.name || "").toLowerCase();

        // Match real orders with this society
        const matchingOrders = orders.filter((o) => {
          const addr = o.deliveryAddress;
          const oSocId = String(addr?.societyId || o.societyId || "").toLowerCase();
          const oSocName = String(addr?.societyName || o.societyName || o.society || "").toLowerCase();
          const oAddrText = typeof o.deliveryAddress === "string" ? o.deliveryAddress.toLowerCase() : "";

          return (
            (oSocId && (oSocId === socId || oSocId === `soc_${socId}`)) ||
            (oSocName && (oSocName === socName || oSocName.includes(socName) || socName.includes(oSocName))) ||
            (oAddrText && oAddrText.includes(socName))
          );
        });

        const totalOrders = matchingOrders.length;
        let totalRevenue = 0;
        matchingOrders.forEach((o) => {
          if (o.status !== "rejected" && o.status !== "cancelled") {
            totalRevenue += Number(o.totalAmount || o.amount || o.itemTotal || 0);
          }
        });

        return {
          ...s,
          totalOrders,
          totalRevenue,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue || b.totalOrders - a.totalOrders || a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [societies, orders]);

  return (
    <Shell
      title="Dashboard"
      subtitle="Live operational overview across societies, registered cooks, customers, and revenues."
    >
      {/* Quick Action Links — Shifted Up for High Priority Access */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/super-admin/society" className="group">
          <div className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center gap-3 shadow-2xs">
            <div className="size-9 rounded-lg bg-sky-500/10 text-sky-700 flex items-center justify-center shrink-0">
              <Building2 className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-primary truncate">Add Society</div>
              <div className="text-[10px] text-muted-foreground truncate">Wings & floors</div>
            </div>
          </div>
        </Link>
        <Link to="/super-admin/chefs" className="group">
          <div className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center gap-3 shadow-2xs">
            <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
              <ChefHat className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-primary truncate">Register Chef</div>
              <div className="text-[10px] text-muted-foreground truncate">Login & delivery</div>
            </div>
          </div>
        </Link>
        <Link to="/super-admin/highlights" className="group">
          <div className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center gap-3 shadow-2xs">
            <div className="size-9 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-primary truncate">App Highlights</div>
              <div className="text-[10px] text-muted-foreground truncate">4 mobile sliders</div>
            </div>
          </div>
        </Link>
        <Link to="/super-admin/marketing" className="group">
          <div className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center gap-3 shadow-2xs">
            <div className="size-9 rounded-lg bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center shrink-0">
              <Megaphone className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground group-hover:text-primary truncate">WhatsApp Push</div>
              <div className="text-[10px] text-muted-foreground truncate">Society promos</div>
            </div>
          </div>
        </Link>
      </div>

      {/* KPI Cards Row (2 Rows of 3 Cards — Clean, Creative & Elevated) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/super-admin/society" className="group">
          <KpiCard
            title="Total Society"
            value={stats.totalSocieties}
            icon={Building2}
            tone="blue"
            tag="Delivery Hubs"
          />
        </Link>
        <Link to="/super-admin/chefs" className="group">
          <KpiCard
            title="Total Chef"
            value={stats.totalChefs}
            icon={ChefHat}
            tone="emerald"
            tag="Home Cooks"
          />
        </Link>
        <Link to="/super-admin/chefs" className="group">
          <KpiCard
            title="Total Seller"
            value={stats.totalSellers}
            icon={Store}
            tone="purple"
            tag="Marketplace"
          />
        </Link>
        <Link to="/super-admin/customers" className="group">
          <KpiCard
            title="Total Customer"
            value={stats.totalCustomers}
            icon={Users}
            tone="orange"
            tag="Residents"
          />
        </Link>
        <Link to="/super-admin/reports" className="group">
          <KpiCard
            title="Total Orders"
            value={stats.totalOrders}
            icon={ShoppingBag}
            tone="amber"
            tag="Delivered"
          />
        </Link>
        <Link to="/super-admin/reports" className="group">
          <KpiCard
            title="Total Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={IndianRupee}
            tone="emerald"
            tag="Earnings"
          />
        </Link>
      </div>

      {/* Operational Details Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Top Operational Societies */}
        <Card className="border-border">
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
            {topSocieties.length === 0 ? (
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
              topSocieties.map((soc, idx) => (
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
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {soc.totalOrders || 0} {(soc.totalOrders || 0) === 1 ? "order" : "orders"}
                      </span>
                      <span className="text-muted-foreground/30">•</span>
                      <Badge variant={soc.status === "enabled" ? "success" : "destructive"} className="text-[10px] py-0 px-1.5">
                        {soc.status === "enabled" ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
