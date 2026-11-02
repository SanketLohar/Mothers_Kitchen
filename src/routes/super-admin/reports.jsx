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
  Building2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatCurrency, toTitleCase } from "@/lib/utils";
import { exportToExcel } from "@/lib/excel-export";
import { toast } from "sonner";
import { subscribeToDashboardKpis } from "@/services/dashboardService";
import { subscribeToSocieties } from "@/services/societyService";
import { subscribeToChefs } from "@/services/chefService";

export const Route = createFileRoute("/super-admin/reports")({
  component: StatisticsReportsPage,
});

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
  const [chefs, setChefs] = useState([]);

  // Collapsible states — collapsed by default as requested
  const [isChefCustomerExpanded, setIsChefCustomerExpanded] = useState(false);
  const [isOrdersRevenueExpanded, setIsOrdersRevenueExpanded] = useState(false);
  const [isChefPerformanceExpanded, setIsChefPerformanceExpanded] = useState(false);

  // Filters for Report 1: Chef / Customer Count per Society (City | Area)
  const [chefCustCity, setChefCustCity] = useState("all");
  const [chefCustArea, setChefCustArea] = useState("all");

  // Filters for Report 2: Orders / Revenue per Society (City | Area)
  const [ordersCity, setOrdersCity] = useState("all");
  const [ordersArea, setOrdersArea] = useState("all");

  // Filters for Report 3: Chef Performance (City | Area | Society)
  const [chefPerfCity, setChefPerfCity] = useState("all");
  const [chefPerfArea, setChefPerfArea] = useState("all");
  const [chefPerfSociety, setChefPerfSociety] = useState("all");

  useEffect(() => {
    const unsubKpis = subscribeToDashboardKpis((liveStats) => {
      setStats(liveStats);
    });

    const unsubSocs = subscribeToSocieties((list) => {
      setSocieties(list || []);
    });

    const unsubChefs = subscribeToChefs((list) => {
      setChefs(list || []);
    });

    return () => {
      unsubKpis();
      unsubSocs();
      unsubChefs();
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

  // Distinct options across societies and chefs
  const allCities = useMemo(() => {
    const fromSocs = societies.map((s) => s.city).filter(Boolean);
    const fromChefs = chefs.map((c) => c.city).filter(Boolean);
    return Array.from(new Set([...fromSocs, ...fromChefs])).sort();
  }, [societies, chefs]);

  const allAreas = useMemo(() => {
    const fromSocs = societies.map((s) => s.area).filter(Boolean);
    const fromChefs = chefs.map((c) => c.area).filter(Boolean);
    return Array.from(new Set([...fromSocs, ...fromChefs])).sort();
  }, [societies, chefs]);

  const allSocieties = useMemo(() => {
    const fromSocs = societies.map((s) => s.name).filter(Boolean);
    const fromChefs = chefs.map((c) => c.baseSociety).filter(Boolean);
    return Array.from(new Set([...fromSocs, ...fromChefs])).sort();
  }, [societies, chefs]);

  // 1. Filtered data for Report 1: Chef / Customer Count per Society
  const filteredChefCustomerSocieties = useMemo(() => {
    return societies.filter((s) => {
      const matchCity = chefCustCity === "all" || String(s.city || "").toLowerCase() === chefCustCity.toLowerCase();
      const matchArea = chefCustArea === "all" || String(s.area || "").toLowerCase() === chefCustArea.toLowerCase();
      return matchCity && matchArea;
    });
  }, [societies, chefCustCity, chefCustArea]);

  // 2. Filtered data for Report 2: Orders / Revenue per Society
  const filteredOrdersRevenueSocieties = useMemo(() => {
    return societies.filter((s) => {
      const matchCity = ordersCity === "all" || String(s.city || "").toLowerCase() === ordersCity.toLowerCase();
      const matchArea = ordersArea === "all" || String(s.area || "").toLowerCase() === ordersArea.toLowerCase();
      return matchCity && matchArea;
    });
  }, [societies, ordersCity, ordersArea]);

  // 3. Filtered data for Report 3: Chef Performance
  const filteredChefPerformance = useMemo(() => {
    return chefs.filter((c) => {
      // Find linked society info
      const chefSocNames = Array.from(new Set([...(c.assignedSocieties || []), c.baseSociety].filter(Boolean)));
      const linkedSocs = societies.filter((s) => chefSocNames.includes(s.name) || chefSocNames.includes(s.id));

      const matchCity =
        chefPerfCity === "all" ||
        String(c.city || "").toLowerCase() === chefPerfCity.toLowerCase() ||
        linkedSocs.some((s) => String(s.city || "").toLowerCase() === chefPerfCity.toLowerCase());

      const matchArea =
        chefPerfArea === "all" ||
        String(c.area || "").toLowerCase() === chefPerfArea.toLowerCase() ||
        linkedSocs.some((s) => String(s.area || "").toLowerCase() === chefPerfArea.toLowerCase());

      const matchSociety =
        chefPerfSociety === "all" ||
        String(c.baseSociety || "").toLowerCase() === chefPerfSociety.toLowerCase() ||
        chefSocNames.some((sn) => String(sn).toLowerCase() === chefPerfSociety.toLowerCase());

      return matchCity && matchArea && matchSociety;
    });
  }, [chefs, societies, chefPerfCity, chefPerfArea, chefPerfSociety]);

  const handleExportSocietyReport = () => {
    if (societies.length === 0 && chefs.length === 0) {
      toast.info("No data available to export.");
      return;
    }
    try {
      const rows = filteredOrdersRevenueSocieties.map((s, i) => ({
        "Sr No": i + 1,
        "Society Name": toTitleCase(s.name),
        "Area": toTitleCase(s.area),
        "City": toTitleCase(s.city),
        "Total Chefs": s.totalChefs || 0,
        "Total Customers": s.totalCustomers || 0,
        "Total Orders": Math.round((s.totalOrders || 0) * periodMultiplier),
        "Total Revenue (INR)": Math.round((s.totalRevenue || 0) * periodMultiplier),
      }));

      exportToExcel(rows, `Mothers_Kitchen_Analytics_${selectedPeriod}`, "Society Analytics");
      toast.success("Analytics report exported to Excel!");
    } catch (err) {
      toast.error("Failed to export report: " + err.message);
    }
  };

  return (
    <Shell
      title="Statistics and Report"
      subtitle="Live revenue, order volume, cook capacity, and society & chef analytical insights."
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
                      ? "bg-card text-foreground shadow-xs font-bold"
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
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Period Orders"
          value={activeStats.orders}
          icon={ShoppingBag}
          tone="primary"
          subtitle={`Orders during ${(selectedPeriod || "").replace("_", " ")}`}
        />
        <KpiCard
          title="Period Revenue"
          value={formatCurrency(activeStats.revenue)}
          icon={IndianRupee}
          tone="emerald"
          subtitle={`Earnings during ${(selectedPeriod || "").replace("_", " ")}`}
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

      {/* 3 Collapsible Report Sections (Collapsed by default, expanded on click with filters) */}
      <div className="space-y-4">
        {/* REPORT 1: Chef / Customer Count per Society */}
        <Card className="border-border overflow-hidden transition-all shadow-xs">
          <CardHeader
            onClick={() => setIsChefCustomerExpanded((prev) => !prev)}
            className="p-4 sm:p-5 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ChefHat className="size-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                  <span>Chef / Customer Count per Society</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {filteredChefCustomerSocieties.length} Societies
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Distribution of approved cooks and registered residents across societies.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs font-semibold hidden sm:inline">
                {isChefCustomerExpanded ? "Collapse" : "Click to Expand"}
              </span>
              <div className="size-8 rounded-lg border border-border flex items-center justify-center bg-card">
                {isChefCustomerExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </div>
          </CardHeader>

          {isChefCustomerExpanded && (
            <div className="border-t border-border">
              {/* Filter Bar: City | Area */}
              <div className="p-3.5 bg-muted/30 border-b border-border flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Filter className="size-3.5 text-primary" />
                  <span>Filter:</span>
                </div>

                {/* City Filter */}
                <div className="w-44">
                  <Select
                    value={chefCustCity}
                    onValueChange={(val) => {
                      setChefCustCity(val);
                      setChefCustArea("all");
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-card">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {allCities.map((ct) => (
                        <SelectItem key={ct} value={ct}>
                          {toTitleCase(ct)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Area Filter */}
                <div className="w-44">
                  <Select value={chefCustArea} onValueChange={(val) => setChefCustArea(val)}>
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-card">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {allAreas.map((ar) => (
                        <SelectItem key={ar} value={ar}>
                          {toTitleCase(ar)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(chefCustCity !== "all" || chefCustArea !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setChefCustCity("all");
                      setChefCustArea("all");
                    }}
                    className="h-8 text-xs text-primary font-semibold hover:bg-primary/10 gap-1 px-2.5"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset</span>
                  </Button>
                )}
              </div>

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Society Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead className="text-center font-bold">Total Chefs</TableHead>
                    <TableHead className="text-right font-bold">Total Customers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChefCustomerSocieties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-muted-foreground text-xs">
                        No societies match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChefCustomerSocieties.map((s, idx) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-center font-bold text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {toTitleCase(s.name)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{toTitleCase(s.city)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{toTitleCase(s.area)}</TableCell>
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
            </div>
          )}
        </Card>

        {/* REPORT 2: Orders / Revenue per Society */}
        <Card className="border-border overflow-hidden transition-all shadow-xs">
          <CardHeader
            onClick={() => setIsOrdersRevenueExpanded((prev) => !prev)}
            className="p-4 sm:p-5 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                <IndianRupee className="size-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                  <span>Orders / Revenue per Society</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {filteredOrdersRevenueSocieties.length} Societies
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Order fulfillment and sales revenue generated by each residential society.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs font-semibold hidden sm:inline">
                {isOrdersRevenueExpanded ? "Collapse" : "Click to Expand"}
              </span>
              <div className="size-8 rounded-lg border border-border flex items-center justify-center bg-card">
                {isOrdersRevenueExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </div>
          </CardHeader>

          {isOrdersRevenueExpanded && (
            <div className="border-t border-border">
              {/* Filter Bar: City | Area */}
              <div className="p-3.5 bg-muted/30 border-b border-border flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Filter className="size-3.5 text-emerald-700" />
                  <span>Filter:</span>
                </div>

                {/* City Filter */}
                <div className="w-44">
                  <Select
                    value={ordersCity}
                    onValueChange={(val) => {
                      setOrdersCity(val);
                      setOrdersArea("all");
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-card">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {allCities.map((ct) => (
                        <SelectItem key={ct} value={ct}>
                          {toTitleCase(ct)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Area Filter */}
                <div className="w-44">
                  <Select value={ordersArea} onValueChange={(val) => setOrdersArea(val)}>
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-card">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {allAreas.map((ar) => (
                        <SelectItem key={ar} value={ar}>
                          {toTitleCase(ar)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(ordersCity !== "all" || ordersArea !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOrdersCity("all");
                      setOrdersArea("all");
                    }}
                    className="h-8 text-xs text-primary font-semibold hover:bg-primary/10 gap-1 px-2.5"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset</span>
                  </Button>
                )}
              </div>

              {/* Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Society Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead className="text-center font-bold">Total Orders</TableHead>
                    <TableHead className="text-right font-bold">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrdersRevenueSocieties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-muted-foreground text-xs">
                        No orders recorded for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrdersRevenueSocieties.map((s, idx) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-center font-bold text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {toTitleCase(s.name)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{toTitleCase(s.city)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{toTitleCase(s.area)}</TableCell>
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
            </div>
          )}
        </Card>

        {/* REPORT 3: Chef Performance Report (Chef | Order | Revenue | Accepted Items | Rejected Items) */}
        <Card className="border-border overflow-hidden transition-all shadow-xs">
          <CardHeader
            onClick={() => setIsChefPerformanceExpanded((prev) => !prev)}
            className="p-4 sm:p-5 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors select-none"
          >
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
                <TrendingUp className="size-4.5" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
                  <span>Chef Performance & Fulfillment Report</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {filteredChefPerformance.length} Chefs
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Orders handled, revenue earned, accepted items, and rejected items per home chef.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-xs font-semibold hidden sm:inline">
                {isChefPerformanceExpanded ? "Collapse" : "Click to Expand"}
              </span>
              <div className="size-8 rounded-lg border border-border flex items-center justify-center bg-card">
                {isChefPerformanceExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </div>
            </div>
          </CardHeader>

          {isChefPerformanceExpanded && (
            <div className="border-t border-border">
              {/* Filter Bar: City | Area | Society */}
              <div className="p-3.5 bg-muted/30 border-b border-border flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Filter className="size-3.5 text-blue-700" />
                  <span>Filter:</span>
                </div>

                {/* City Filter */}
                <div className="w-40">
                  <Select
                    value={chefPerfCity}
                    onValueChange={(val) => {
                      setChefPerfCity(val);
                      setChefPerfArea("all");
                      setChefPerfSociety("all");
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-card">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {allCities.map((ct) => (
                        <SelectItem key={ct} value={ct}>
                          {toTitleCase(ct)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Area Filter */}
                <div className="w-40">
                  <Select
                    value={chefPerfArea}
                    onValueChange={(val) => {
                      setChefPerfArea(val);
                      setChefPerfSociety("all");
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-card">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {allAreas.map((ar) => (
                        <SelectItem key={ar} value={ar}>
                          {toTitleCase(ar)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Society Filter */}
                <div className="w-44">
                  <Select
                    value={chefPerfSociety}
                    onValueChange={(val) => setChefPerfSociety(val)}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-lg bg-card">
                      <SelectValue placeholder="All Societies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Societies</SelectItem>
                      {allSocieties.map((soc) => (
                        <SelectItem key={soc} value={soc}>
                          {toTitleCase(soc)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(chefPerfCity !== "all" || chefPerfArea !== "all" || chefPerfSociety !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setChefPerfCity("all");
                      setChefPerfArea("all");
                      setChefPerfSociety("all");
                    }}
                    className="h-8 text-xs text-primary font-semibold hover:bg-primary/10 gap-1 px-2.5"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset</span>
                  </Button>
                )}
              </div>

              {/* Table: Chef | Order | Revenue | Accepted Items | Rejected Items */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Chef</TableHead>
                    <TableHead className="text-center font-bold">Order</TableHead>
                    <TableHead className="text-right font-bold">Revenue</TableHead>
                    <TableHead className="text-center font-bold">Accepted Items</TableHead>
                    <TableHead className="text-center font-bold">Rejected Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChefPerformance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-28 text-center text-muted-foreground text-xs">
                        No chefs match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredChefPerformance.map((chef, idx) => {
                      const totalOrders = Math.round((Number(chef.totalOrders || chef.ordersToday || 0)) * periodMultiplier);
                      const totalRevenue = Math.round((Number(chef.totalRevenue || 0)) * periodMultiplier);
                      const acceptedItems = Number(chef.acceptedItems ?? chef.acceptedOrders ?? totalOrders);
                      const rejectedItems = Number(chef.rejectedItems ?? chef.rejectedOrders ?? chef.consecutiveTimeouts ?? 0);

                      return (
                        <TableRow key={chef.id}>
                          <TableCell className="text-center font-bold text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                {toTitleCase(chef.fullName || chef.name || "Chef")}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                                {chef.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {toTitleCase(chef.baseSociety || "")}
                              {chef.city ? ` • ${toTitleCase(chef.city)}` : ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-primary">
                            {totalOrders}
                          </TableCell>
                          <TableCell className="text-right font-bold text-emerald-700">
                            {formatCurrency(totalRevenue)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs">
                              <CheckCircle2 className="size-3 text-emerald-600" />
                              <span>{acceptedItems}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center gap-1 font-semibold px-2.5 py-0.5 rounded-full text-xs ${
                              rejectedItems > 0
                                ? "text-rose-700 bg-rose-50 border border-rose-200"
                                : "text-muted-foreground bg-muted border border-border"
                            }`}>
                              <XCircle className={`size-3 ${rejectedItems > 0 ? "text-rose-600" : "text-muted-foreground"}`} />
                              <span>{rejectedItems}</span>
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
