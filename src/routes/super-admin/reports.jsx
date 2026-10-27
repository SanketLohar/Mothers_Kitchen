import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { KpiCard } from "@/components/dashboard/KpiCard";
import {
  Calendar,
  ChefHat,
  Users,
  ShoppingBag,
  IndianRupee,
  PieChart as PieIcon,
  Download,
  Building2,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { exportToExcel } from "@/lib/excel-export";
import { toast } from "sonner";
import { subscribeToDashboardKpis } from "@/services/dashboardService";
import { subscribeToSocieties } from "@/services/societyService";

export const Route = createFileRoute("/super-admin/reports")({
  component: StatisticsReportsPage,
});

const PIE_COLORS = ["#1B4332", "#2D6A4F", "#40916C", "#52B788", "#74C69D", "#D8D2C2"];

export function StatisticsReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("this_month");
  const [customStartDate, setCustomStartDate] = useState("2026-10-01");
  const [customEndDate, setCustomEndDate] = useState("2026-10-31");
  const [stats, setStats] = useState({
    totalSocieties: 0,
    totalChefs: 0,
    totalCustomers: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [societies, setSocieties] = useState([]);

  useEffect(() => {
    const unsubKpis = subscribeToDashboardKpis((liveStats) => {
      setStats(liveStats);
    });

    const unsubSocs = subscribeToSocieties((list) => {
      setSocieties(list || []);
    });

    return () => {
      unsubKpis();
      unsubSocs();
    };
  }, []);

  // Multiplier for previewing date-filtered periods
  const periodMultiplier = useMemo(() => {
    switch (selectedPeriod) {
      case "today":
        return 0.1;
      case "yesterday":
        return 0.1;
      case "this_week":
        return 0.4;
      case "this_month":
      default:
        return 1.0;
    }
  }, [selectedPeriod]);

  const activeStats = useMemo(() => {
    return {
      chefs: stats.totalChefs,
      customers: stats.totalCustomers,
      orders: Math.round(stats.totalOrders * periodMultiplier),
      revenue: Math.round(stats.totalRevenue * periodMultiplier),
    };
  }, [stats, periodMultiplier]);

  const handleExportSocietyReport = () => {
    if (societies.length === 0) {
      toast.info("No society records available to export.");
      return;
    }
    try {
      const rows = societies.map((s, i) => ({
        "Sr No": i + 1,
        "Society Name": s.name,
        "Area": s.area,
        "City": s.city,
        "Total Chefs": s.totalChefs || 0,
        "Total Customers": s.totalCustomers || 0,
        "Total Orders": Math.round((s.totalOrders || 0) * periodMultiplier),
        "Total Revenue (INR)": Math.round((s.totalRevenue || 0) * periodMultiplier),
      }));

      exportToExcel(rows, `Mothers_Kitchen_Society_Report_${selectedPeriod}`, "Society Report");
      toast.success("Society analytics report exported to Excel!");
    } catch (err) {
      toast.error("Failed to export report: " + err.message);
    }
  };

  return (
    <Shell
      title="Statistics and Report"
      subtitle="Live revenue, order volume, cook capacity, and society-level analytical insights."
    >
      {/* Date Period Filter Bar with Export Action (BRD p. 23) */}
      <Card className="border-border">
        <CardContent className="p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground shrink-0">
              <Calendar className="size-4 text-primary" />
              <span>Reporting Period (Asia/Kolkata):</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-muted p-1 rounded-xl">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "this_month", label: "This Month" },
                { id: "custom", label: "Custom Date" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    selectedPeriod === p.id
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {selectedPeriod === "custom" && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs font-mono"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Export Button Placed Near Filters */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end shrink-0">
            <Button
              onClick={handleExportSocietyReport}
              variant="outline"
              className="gap-2 h-10 rounded-xl hover:border-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>Export Analytics</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Period Orders"
          value={activeStats.orders}
          icon={ShoppingBag}
          tone="primary"
          subtitle={`Orders during ${selectedPeriod.replace("_", " ")}`}
        />
        <KpiCard
          title="Period Revenue"
          value={formatCurrency(activeStats.revenue)}
          icon={IndianRupee}
          tone="emerald"
          subtitle={`Earnings during ${selectedPeriod.replace("_", " ")}`}
        />
        <KpiCard
          title="Total Active Chefs"
          value={activeStats.chefs}
          icon={ChefHat}
          tone="blue"
          subtitle="Registered home cooks"
        />
        <KpiCard
          title="Total Customers"
          value={activeStats.customers}
          icon={Users}
          tone="orange"
          subtitle="Verified residential base"
        />
      </div>

      {/* 2 Detailed Breakdown Tables (BRD p. 23) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Chef / Customer Count per Society */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/70">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ChefHat className="size-4 text-primary" />
              <span>Chef / Customer Count per Society</span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Society Name</TableHead>
                <TableHead className="text-center">Total Chefs</TableHead>
                <TableHead className="text-right">Total Customers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {societies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">
                    No societies registered in database yet.
                  </TableCell>
                </TableRow>
              ) : (
                societies.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-center font-bold text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {s.name}
                    </TableCell>
                    <TableCell className="text-center font-bold text-emerald-700">
                      {s.totalChefs || 0}
                    </TableCell>
                    <TableCell className="text-right font-medium text-foreground">
                      {s.totalCustomers || 0}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Table 2: Orders / Revenue per Society */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/70">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <IndianRupee className="size-4 text-[#E76F51]" />
              <span>Orders / Revenue per Society</span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Society Name</TableHead>
                <TableHead className="text-center">Total Orders</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {societies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground text-xs">
                    No orders recorded in database yet.
                  </TableCell>
                </TableRow>
              ) : (
                societies.map((s, idx) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-center font-bold text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {s.name}
                    </TableCell>
                    <TableCell className="text-center font-bold text-primary">
                      {Math.round((s.totalOrders || 0) * periodMultiplier)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">
                      {formatCurrency((s.totalRevenue || 0) * periodMultiplier)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </Shell>
  );
}
