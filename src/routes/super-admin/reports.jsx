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
import { subscribeToOrders } from "@/services/orderService";

export const Route = createFileRoute("/super-admin/reports")({
  component: StatisticsReportsPage,
});

function parseOrderDate(order) {
  if (!order) return null;
  const val = order.createdAt || order.timestamp || order.date;
  if (!val) return null;
  if (typeof val.toDate === "function") return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

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
  const [orders, setOrders] = useState([]);

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

    const unsubOrders = subscribeToOrders((list) => {
      setOrders(list || []);
    });

    return () => {
      unsubKpis();
      unsubSocs();
      unsubChefs();
      unsubOrders();
    };
  }, []);

  // Filter real Firestore orders by the selected reporting period in Asia/Kolkata
  const filteredOrdersByPeriod = useMemo(() => {
    if (!orders.length) return [];

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const todayYMD = formatter.format(now);
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayYMD = formatter.format(yesterdayDate);

    const currentMonthPrefix = todayYMD.slice(0, 7);

    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
    const startOfWeekYMD = formatter.format(startOfWeek);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return orders.filter((o) => {
      const d = parseOrderDate(o);
      if (!d) return true;
      const orderYMD = formatter.format(d);

      switch (selectedPeriod) {
        case "today":
          return orderYMD === todayYMD;
        case "yesterday":
          return orderYMD === yesterdayYMD;
        case "this_week":
          return orderYMD >= startOfWeekYMD && orderYMD <= todayYMD;
        case "this_month":
          return orderYMD.startsWith(currentMonthPrefix) || d >= thirtyDaysAgo;
        case "custom":
          return (
            (!customStartDate || orderYMD >= customStartDate) &&
            (!customEndDate || orderYMD <= customEndDate)
          );
        default:
          return true;
      }
    });
  }, [orders, selectedPeriod, customStartDate, customEndDate]);

  // Aggregate stats derived directly from actual DB orders and collections
  const activeStats = useMemo(() => {
    const totalOrdersCount = filteredOrdersByPeriod.length;
    let totalRevenueSum = 0;
    filteredOrdersByPeriod.forEach((o) => {
      if (o.status !== "rejected" && o.status !== "cancelled") {
        totalRevenueSum += Number(o.totalAmount || o.amount || o.itemTotal || 0);
      }
    });

    return {
      chefs: stats.totalChefs || chefs.length,
      customers: stats.totalCustomers,
      orders: totalOrdersCount,
      revenue: totalRevenueSum,
    };
  }, [filteredOrdersByPeriod, stats, chefs.length]);

  // Distinct cities across societies and chefs
  const allCities = useMemo(() => {
    const fromSocs = societies.map((s) => s.city).filter(Boolean);
    const fromChefs = chefs.map((c) => c.city).filter(Boolean);
    return Array.from(new Set([...fromSocs, ...fromChefs])).sort();
  }, [societies, chefs]);

  // Dependent available areas for Report 1 (filtered by chefCustCity)
  const chefCustAvailableAreas = useMemo(() => {
    const list = chefCustCity === "all"
      ? societies
      : societies.filter((s) => String(s.city || "").toLowerCase() === chefCustCity.toLowerCase());
    return Array.from(new Set(list.map((s) => s.area).filter(Boolean))).sort();
  }, [societies, chefCustCity]);

  // Dependent available areas for Report 2 (filtered by ordersCity)
  const ordersAvailableAreas = useMemo(() => {
    const list = ordersCity === "all"
      ? societies
      : societies.filter((s) => String(s.city || "").toLowerCase() === ordersCity.toLowerCase());
    return Array.from(new Set(list.map((s) => s.area).filter(Boolean))).sort();
  }, [societies, ordersCity]);

  // Dependent available areas and societies for Report 3 (filtered by chefPerfCity / chefPerfArea)
  const chefPerfAvailableAreas = useMemo(() => {
    const list = chefPerfCity === "all"
      ? societies
      : societies.filter((s) => String(s.city || "").toLowerCase() === chefPerfCity.toLowerCase());
    return Array.from(new Set(list.map((s) => s.area).filter(Boolean))).sort();
  }, [societies, chefPerfCity]);

  const chefPerfAvailableSocieties = useMemo(() => {
    const list = societies.filter((s) => {
      const matchCity = chefPerfCity === "all" || String(s.city || "").toLowerCase() === chefPerfCity.toLowerCase();
      const matchArea = chefPerfArea === "all" || String(s.area || "").toLowerCase() === chefPerfArea.toLowerCase();
      return matchCity && matchArea;
    });
    return Array.from(new Set(list.map((s) => s.name).filter(Boolean))).sort();
  }, [societies, chefPerfCity, chefPerfArea]);

  // 1. Filtered data for Report 1: Chef / Customer Count per Society (based strictly on chef baseSociety)
  const filteredChefCustomerSocieties = useMemo(() => {
    return societies
      .filter((s) => {
        const matchCity = chefCustCity === "all" || String(s.city || "").toLowerCase() === chefCustCity.toLowerCase();
        const matchArea = chefCustArea === "all" || String(s.area || "").toLowerCase() === chefCustArea.toLowerCase();
        return matchCity && matchArea;
      })
      .map((s) => {
        const socName = (s.name || "").trim().toLowerCase();
        const socId = (s.id || "").trim().toLowerCase();
        const baseChefs = chefs.filter((c) => {
          const base = (c.baseSociety || "").trim().toLowerCase();
          return base && (base === socName || base === socId);
        });
        return {
          ...s,
          totalChefs: baseChefs.length,
        };
      });
  }, [societies, chefs, chefCustCity, chefCustArea]);

  // 2. Filtered data for Report 2: Orders / Revenue per Society (derived from DB orders)
  const filteredOrdersRevenueSocieties = useMemo(() => {
    const list = societies.filter((s) => {
      const matchCity = ordersCity === "all" || String(s.city || "").toLowerCase() === ordersCity.toLowerCase();
      const matchArea = ordersArea === "all" || String(s.area || "").toLowerCase() === ordersArea.toLowerCase();
      return matchCity && matchArea;
    });

    return list.map((s) => {
      const socId = String(s.id || "").toLowerCase();
      const socName = String(s.name || "").toLowerCase();

      // Find real matching orders from filteredOrdersByPeriod
      const matchingOrders = filteredOrdersByPeriod.filter((o) => {
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

      const totalOrdersCount = matchingOrders.length;
      let totalRevenueSum = 0;
      matchingOrders.forEach((o) => {
        if (o.status !== "rejected" && o.status !== "cancelled") {
          totalRevenueSum += Number(o.totalAmount || o.amount || o.itemTotal || 0);
        }
      });

      return {
        ...s,
        totalOrders: totalOrdersCount,
        totalRevenue: totalRevenueSum,
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders || b.totalRevenue - a.totalRevenue || a.name.localeCompare(b.name));
  }, [societies, filteredOrdersByPeriod, ordersCity, ordersArea]);

  // 3. Filtered data for Report 3: Chef Performance (derived from DB orders)
  const filteredChefPerformance = useMemo(() => {
    const list = chefs.filter((c) => {
      const baseSoc = societies.find(
        (s) =>
          (s.name && (c.baseSociety || "").toLowerCase() === s.name.toLowerCase()) ||
          (s.id && c.baseSociety === s.id)
      );
      const chefCity = (c.city || baseSoc?.city || "").toLowerCase();
      const chefArea = (c.area || baseSoc?.area || "").toLowerCase();
      const cAddr = String(c.address || "").toLowerCase();

      const matchCity =
        chefPerfCity === "all" ||
        chefCity === chefPerfCity.toLowerCase() ||
        (!chefCity && cAddr.includes(chefPerfCity.toLowerCase()));

      const matchArea =
        chefPerfArea === "all" ||
        chefArea === chefPerfArea.toLowerCase() ||
        (!chefArea && cAddr.includes(chefPerfArea.toLowerCase()));

      const matchSociety =
        chefPerfSociety === "all" ||
        String(c.baseSociety || "").toLowerCase() === chefPerfSociety.toLowerCase();

      return matchCity && matchArea && matchSociety;
    });

    return list.map((c) => {
      const chefId = String(c.chefId || c.id || "").toUpperCase();
      const chefIdClean = chefId.replace(/[^A-Z0-9_]/gi, "");

      let chefOrdersCount = 0;
      let chefRevenue = 0;
      let acceptedOrders = 0;
      let rejectedOrders = 0;
      let acceptedItems = 0;
      let rejectedItems = 0;

      filteredOrdersByPeriod.forEach((order) => {
        const subOrders = order.subOrders || order.chefSubOrders || {};
        const matchingKey = Object.keys(subOrders).find(
          (k) => k.toUpperCase() === chefId || k.toUpperCase() === chefIdClean
        );
        const subOrder = matchingKey ? subOrders[matchingKey] : null;

        const items = Array.isArray(order.items) ? order.items : [];
        const chefItems = items.filter((it) => {
          const itChefId = String(it.chefId || "").toUpperCase();
          return itChefId === chefId || (matchingKey && itChefId === matchingKey.toUpperCase());
        });

        const isChefInOrder = Boolean(
          subOrder ||
          chefItems.length > 0 ||
          order.chefStatuses?.[chefId] ||
          order.chefStatuses?.[matchingKey]
        );

        if (!isChefInOrder) return;

        chefOrdersCount += 1;

        let isOrderRejected = false;
        let orderAcceptedQty = 0;
        let orderRejectedQty = 0;

        if (subOrder && Array.isArray(subOrder.items) && subOrder.items.length > 0) {
          const subSt = String(subOrder.status || "").toLowerCase();
          subOrder.items.forEach((it) => {
            const qty = Number(it.quantity || 1);
            const price = Number(it.totalPrice || it.subtotal || (Number(it.unitPrice || it.pricePerPlate || 0) * qty) || 0);
            const itemSt = String(it.itemStatus || it.status || it.orderStatus || subSt || "").toLowerCase();

            if (itemSt === "rejected" || itemSt === "cancelled") {
              rejectedItems += qty;
              orderRejectedQty += qty;
            } else {
              acceptedItems += qty;
              orderAcceptedQty += qty;
              chefRevenue += price;
            }
          });
          isOrderRejected = subSt === "rejected" || subSt === "cancelled" || (orderAcceptedQty === 0 && orderRejectedQty > 0);
        } else if (chefItems.length > 0) {
          const chefSt = String(order.chefStatuses?.[chefId] || order.chefStatuses?.[matchingKey] || order.status || "").toLowerCase();
          chefItems.forEach((it) => {
            const qty = Number(it.quantity || 1);
            const price = Number(it.totalPrice || it.subtotal || (Number(it.unitPrice || it.pricePerPlate || 0) * qty) || 0);
            const itemSt = String(it.itemStatus || it.status || it.orderStatus || chefSt || "").toLowerCase();

            if (itemSt === "rejected" || itemSt === "cancelled") {
              rejectedItems += qty;
              orderRejectedQty += qty;
            } else {
              acceptedItems += qty;
              orderAcceptedQty += qty;
              chefRevenue += price;
            }
          });
          isOrderRejected = chefSt.includes("reject") || (orderAcceptedQty === 0 && orderRejectedQty > 0);
        } else {
          const orderSt = String(order.chefStatuses?.[chefId] || order.chefStatuses?.[matchingKey] || order.status || "").toLowerCase();
          if (orderSt.includes("reject") || orderSt.includes("cancel")) {
            rejectedItems += 1;
            isOrderRejected = true;
          } else {
            acceptedItems += 1;
            chefRevenue += Number(subOrder?.totalAmount || order.totalAmount || 0);
          }
        }

        if (isOrderRejected) {
          rejectedOrders += 1;
        } else {
          acceptedOrders += 1;
        }
      });

      return {
        ...c,
        totalOrders: chefOrdersCount,
        totalRevenue: chefRevenue,
        acceptedOrders,
        rejectedOrders,
        acceptedItems,
        rejectedItems,
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders || b.totalRevenue - a.totalRevenue || (a.fullName || "").localeCompare(b.fullName || ""));
  }, [chefs, societies, filteredOrdersByPeriod, chefPerfCity, chefPerfArea, chefPerfSociety]);

  // Individual Report Excel Exporters
  const handleExportChefCustomerReport = () => {
    if (!filteredChefCustomerSocieties.length) {
      toast.info("No records match the active filters to export.");
      return;
    }
    try {
      const rows = filteredChefCustomerSocieties.map((s, i) => ({
        "Sr No": i + 1,
        "Society Name": toTitleCase(s.name),
        "City": toTitleCase(s.city),
        "Area": toTitleCase(s.area),
        "Total Chefs": s.totalChefs || 0,
        "Total Customers": s.totalCustomers || 0,
      }));

      const filterSuffix = chefCustCity !== "all" ? `_${chefCustCity}` : "";
      exportToExcel(rows, `Chef_Customer_Count_Report${filterSuffix}`, "Chef & Customer Count");
      toast.success(`Exported ${rows.length} society records to Excel!`);
    } catch (err) {
      toast.error("Failed to export report: " + err.message);
    }
  };

  const handleExportOrdersRevenueReport = () => {
    if (!filteredOrdersRevenueSocieties.length) {
      toast.info("No records match the active filters to export.");
      return;
    }
    try {
      const rows = filteredOrdersRevenueSocieties.map((s, i) => ({
        "Sr No": i + 1,
        "Society Name": toTitleCase(s.name),
        "City": toTitleCase(s.city),
        "Area": toTitleCase(s.area),
        "Total Orders": s.totalOrders || 0,
        "Total Revenue (INR)": s.totalRevenue || 0,
      }));

      const filterSuffix = ordersCity !== "all" ? `_${ordersCity}` : "";
      exportToExcel(rows, `Orders_Revenue_Report_${selectedPeriod}${filterSuffix}`, "Orders & Revenue");
      toast.success(`Exported ${rows.length} society records to Excel!`);
    } catch (err) {
      toast.error("Failed to export report: " + err.message);
    }
  };

  const handleExportChefPerformanceReport = () => {
    if (!filteredChefPerformance.length) {
      toast.info("No chef records match the active filters to export.");
      return;
    }
    try {
      const rows = filteredChefPerformance.map((chef, idx) => ({
        "Sr No": idx + 1,
        "Chef Name": toTitleCase(chef.fullName || chef.name || "Chef"),
        "Chef ID": chef.chefId || chef.id,
        "Base Society": toTitleCase(chef.baseSociety || "Not Set"),
        "City": toTitleCase(chef.city || ""),
        "Area": toTitleCase(chef.area || ""),
        "Total Orders": chef.totalOrders || 0,
        "Revenue (INR)": chef.totalRevenue || 0,
        "Accepted Items": chef.acceptedItems || 0,
        "Rejected Items": chef.rejectedItems || 0,
      }));

      const filterSuffix = chefPerfCity !== "all" ? `_${chefPerfCity}` : "";
      exportToExcel(rows, `Chef_Performance_Report_${selectedPeriod}${filterSuffix}`, "Chef Performance");
      toast.success(`Exported ${rows.length} chef performance records to Excel!`);
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
                      {chefCustAvailableAreas.map((ar) => (
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

                {/* Export Report 1 Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportChefCustomerReport}
                  className="ml-auto h-8 text-xs font-semibold gap-1.5 rounded-lg border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600 cursor-pointer"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600" />
                  <span>Export to Excel</span>
                </Button>
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
                      {ordersAvailableAreas.map((ar) => (
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

                {/* Export Report 2 Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportOrdersRevenueReport}
                  className="ml-auto h-8 text-xs font-semibold gap-1.5 rounded-lg border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600 cursor-pointer"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600" />
                  <span>Export to Excel</span>
                </Button>
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
                          {s.totalOrders || 0}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">
                          {formatCurrency(s.totalRevenue || 0)}
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
                      {chefPerfAvailableAreas.map((ar) => (
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
                      {chefPerfAvailableSocieties.map((soc) => (
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

                {/* Export Report 3 Button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportChefPerformanceReport}
                  className="ml-auto h-8 text-xs font-semibold gap-1.5 rounded-lg border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-600 cursor-pointer"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-600" />
                  <span>Export to Excel</span>
                </Button>
              </div>

              {/* Table: Chef | Total Orders | Revenue | Accepted Items | Rejected Items */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Chef</TableHead>
                    <TableHead className="text-center font-bold">Total Orders</TableHead>
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
                      const totalOrders = chef.totalOrders || 0;
                      const totalRevenue = chef.totalRevenue || 0;
                      const acceptedItems = chef.acceptedItems || 0;
                      const rejectedItems = chef.rejectedItems || 0;

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
