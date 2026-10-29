import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Shell } from "@/components/dashboard/Shell";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  MapPin,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  CloudUpload,
  Loader2,
  Filter,
  FileSpreadsheet,
  Minus,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isFirebaseConfigured } from "@/lib/firebase";
import { exportToExcel } from "@/lib/excel-export";
import { toTitleCase } from "@/lib/utils";
import {
  subscribeToSocieties,
  createSociety,
  updateSociety,
  toggleSocietyStatus,
  deleteSociety,
  generateSocietyId,
} from "@/services/societyService";
import {
  subscribeToChefs,
  syncExistingChefsToSocieties,
} from "@/services/chefService";

export const Route = createFileRoute("/super-admin/society")({
  component: SocietyManagementPage,
});

export function SocietyManagementPage() {
  const [societies, setSocieties] = useState([]);
  const [chefs, setChefs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Live Firestore subscriptions
  useEffect(() => {
    // Backfill any existing registered chefs (e.g. Sam, CHEF_001) into society subcollections
    syncExistingChefsToSocieties();

    const unsubSocieties = subscribeToSocieties((list) => {
      setSocieties(list || []);
      setLoading(false);
    });

    const unsubChefs = subscribeToChefs((list) => {
      setChefs(list || []);
    });

    return () => {
      unsubSocieties();
      unsubChefs();
    };
  }, []);

  const getChefsForSociety = (soc) => {
    if (!soc) return [];
    return chefs.filter((c) => {
      const assigned = Array.isArray(c.assignedSocieties) ? c.assignedSocieties : [];
      return (
        assigned.includes(soc.name) ||
        assigned.includes(soc.id) ||
        c.baseSociety === soc.name ||
        c.baseSociety === soc.id
      );
    });
  };

  const getChefCountForSociety = (soc) => {
    const list = getChefsForSociety(soc);
    return Math.max(list.length, Number(soc.totalChefs || 0));
  };

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSociety, setEditingSociety] = useState(null);
  const [deleteSocietyId, setDeleteSocietyId] = useState(null);
  const [viewingSociety, setViewingSociety] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add / Edit Society (BRD p. 18 hierarchy)
  const [formData, setFormData] = useState({
    city: "",
    area: "",
    name: "",
    numberOfWings: 1,
    wings: [{ name: "A", floors: 10 }],
    status: "enabled",
  });
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const [customCities, setCustomCities] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mk_custom_cities");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const addCustomCity = (cityName) => {
    const formatted = toTitleCase(cityName?.trim() || "");
    if (!formatted) return;
    setCustomCities((prev) => {
      const next = Array.from(new Set([...prev, formatted]));
      if (typeof window !== "undefined") {
        localStorage.setItem("mk_custom_cities", JSON.stringify(next));
      }
      return next;
    });
  };

  // Distinct known cities from existing societies + custom added cities + standard defaults
  const allKnownCities = useMemo(() => {
    const fromSocieties = societies.map((s) => toTitleCase(s.city?.trim())).filter(Boolean);
    const defaults = ["Pune", "Mumbai", "Pimpri-Chinchwad", "Nagpur", "Nashik", "Thane"];
    return Array.from(new Set([...fromSocieties, ...customCities, ...defaults])).sort();
  }, [societies, customCities]);

  const filteredCitySuggestions = useMemo(() => {
    const input = (formData.city || "").trim().toLowerCase();
    if (!input) return allKnownCities.slice(0, 10);
    return allKnownCities.filter((c) => c.toLowerCase().includes(input));
  }, [allKnownCities, formData.city]);

  // Distinct known areas from existing societies + standard Pune areas
  const allKnownAreas = useMemo(() => {
    const fromSocieties = societies.map((s) => toTitleCase(s.area?.trim())).filter(Boolean);
    const defaults = [
      "Wakad", "Baner", "Hinjewadi", "Aundh", "Kothrud",
      "Viman Nagar", "Kharadi", "Hadapsar", "Pimple Saudagar",
      "Bavdhan", "Magarpatta", "Pashan", "Ravet", "Balewadi",
      "Kalyani Nagar", "Koregaon Park", "Shivajinagar"
    ];
    return Array.from(new Set([...fromSocieties, ...defaults])).sort();
  }, [societies]);

  const filteredAreaSuggestions = useMemo(() => {
    const input = (formData.area || "").trim().toLowerCase();
    if (!input) return allKnownAreas.slice(0, 10);
    return allKnownAreas.filter((a) => a.toLowerCase().includes(input));
  }, [allKnownAreas, formData.area]);

  const handleOpenAddModal = () => {
    setEditingSociety(null);
    setShowCitySuggestions(false);
    setShowAreaSuggestions(false);
    setFormData({
      city: "",
      area: "",
      name: "",
      numberOfWings: 1,
      wings: [{ name: "A", floors: 10 }],
      status: "enabled",
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (soc) => {
    setEditingSociety(soc);
    setShowCitySuggestions(false);
    setShowAreaSuggestions(false);
    const wingsData =
      soc.wings && soc.wings.length > 0
        ? soc.wings.map((w) => ({ ...w, name: toTitleCase(w.name) }))
        : [{ name: "A", floors: 10 }];
    setFormData({
      city: toTitleCase(soc.city || ""),
      area: toTitleCase(soc.area || ""),
      name: toTitleCase(soc.name || ""),
      numberOfWings: soc.numberOfWings || wingsData.length,
      wings: wingsData,
      status: soc.status || "enabled",
    });
    setIsAddModalOpen(true);
  };

  const handleWingCountChange = (count) => {
    const num = Math.max(1, Math.min(26, parseInt(count, 10) || 1));
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const newWings = Array.from({ length: num }, (_, i) => {
      const existing = formData.wings[i];
      return existing || { name: alphabet[i] || `W${i + 1}`, floors: 10 };
    });

    setFormData((prev) => ({
      ...prev,
      numberOfWings: num,
      wings: newWings,
    }));
  };

  const handleAddWing = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const currentCount = formData.wings.length;
    if (currentCount >= 26) {
      toast.error("Maximum 26 wings supported.");
      return;
    }
    const nextName = alphabet[currentCount] || `W${currentCount + 1}`;
    const updatedWings = [...formData.wings, { name: nextName, floors: 10 }];
    setFormData((prev) => ({
      ...prev,
      numberOfWings: updatedWings.length,
      wings: updatedWings,
    }));
  };

  const handleRemoveWing = (indexToRemove) => {
    if (formData.wings.length <= 1) {
      toast.error("A society must have at least one wing.");
      return;
    }
    const updatedWings = formData.wings.filter((_, idx) => idx !== indexToRemove);
    setFormData((prev) => ({
      ...prev,
      numberOfWings: updatedWings.length,
      wings: updatedWings,
    }));
  };

  const handleWingNameChange = (index, name) => {
    const updated = [...formData.wings];
    updated[index] = { ...updated[index], name: toTitleCase(name) };
    setFormData((prev) => ({ ...prev, wings: updated }));
  };

  const handleFloorChange = (index, floors) => {
    const val = Math.max(1, parseInt(floors, 10) || 1);
    const updated = [...formData.wings];
    updated[index] = { ...updated[index], floors: val };
    setFormData((prev) => ({ ...prev, wings: updated }));
  };

  const handleToggleStatus = async (id) => {
    const target = societies.find((s) => s.id === id);
    if (!target) return;
    const newStatus = target.status === "enabled" ? "disabled" : "enabled";

    // Optimistic UI update
    setSocieties((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
    );

    if (isFirebaseConfigured && !target.id.startsWith("soc-")) {
      try {
        await toggleSocietyStatus(id, newStatus);
      } catch (err) {
        console.error("Toggle error:", err);
        toast.error("Failed to update status in database.");
      }
    }

    toast.success(
      `${target.name} is now ${newStatus.toUpperCase()}.${
        newStatus === "disabled"
          ? " Customer app will display temporary unavailable notice."
          : " Customers can now order food."
      }`
    );
  };

  const handleSaveSociety = async (e) => {
    e.preventDefault();

    const cleanedName = toTitleCase(formData.name.trim());
    const cleanedArea = toTitleCase(formData.area.trim());
    const cleanedCity = toTitleCase(formData.city.trim());

    if (!cleanedName || !cleanedArea || !cleanedCity) {
      toast.error("Please provide Society Name, Area, and City.");
      return;
    }

    // Check duplicate society name in the same area
    const duplicate = societies.find(
      (s) =>
        s.id !== editingSociety?.id &&
        s.name.trim().toLowerCase() === cleanedName.toLowerCase() &&
        s.area.trim().toLowerCase() === cleanedArea.toLowerCase()
    );

    if (duplicate) {
      toast.error(`A society named "${cleanedName}" already exists in ${cleanedArea}.`);
      return;
    }

    const cleanedWings = (formData.wings || []).map((w) => ({
      ...w,
      name: toTitleCase(String(w.name || "").trim()),
      floors: Math.max(1, parseInt(w.floors, 10) || 1),
    }));

    addCustomCity(cleanedCity);

    const payload = {
      ...formData,
      name: cleanedName,
      area: cleanedArea,
      city: cleanedCity,
      wings: cleanedWings,
    };

    setIsSubmitting(true);
    try {
      if (editingSociety) {
        if (isFirebaseConfigured && !editingSociety.id.startsWith("soc-")) {
          await updateSociety(editingSociety.id, payload);
          toast.success(`Society "${cleanedName}" updated in Firestore!`);
        } else {
          setSocieties((prev) =>
            prev.map((s) =>
              s.id === editingSociety.id
                ? { ...s, ...payload }
                : s
            )
          );
          toast.success(`Society "${cleanedName}" updated successfully.`);
        }
      } else {
        if (isFirebaseConfigured) {
          const created = await createSociety(payload);
          toast.success(`Society "${cleanedName}" created with ID ${created.id}!`);
        } else {
          const newSoc = {
            id: generateSocietyId(cleanedName),
            ...payload,
            totalChefs: 0,
            totalCustomers: 0,
            totalOrders: 0,
            totalRevenue: 0,
          };
          setSocieties((prev) => [newSoc, ...prev]);
          toast.success(`New Society "${cleanedName}" registered successfully.`);
        }
      }
      setIsAddModalOpen(false);
    } catch (err) {
      console.error("Save society error:", err);
      toast.error("Failed to save society: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSociety = async () => {
    if (!deleteSocietyId) return;
    const target = societies.find((s) => s.id === deleteSocietyId);
    setSocieties((prev) => prev.filter((s) => s.id !== deleteSocietyId));

    if (isFirebaseConfigured && !deleteSocietyId.startsWith("soc-")) {
      try {
        await deleteSociety(deleteSocietyId);
      } catch (err) {
        console.error("Delete error:", err);
      }
    }

    toast.success(`Society "${target?.name || ""}" deleted.`);
    setDeleteSocietyId(null);
  };

  // Derived cascading filter options
  const availableCities = useMemo(() => {
    return Array.from(new Set(societies.map((s) => s.city).filter(Boolean))).sort();
  }, [societies]);

  const availableAreas = useMemo(() => {
    const relevant = selectedCity === "all" ? societies : societies.filter((s) => s.city === selectedCity);
    return Array.from(new Set(relevant.map((s) => s.area).filter(Boolean))).sort();
  }, [societies, selectedCity]);

  const activeFilterCount =
    (selectedCity !== "all" ? 1 : 0) +
    (selectedArea !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  // Filtered Societies
  const filteredSocieties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return societies.filter((s) => {
      const matchesSearch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.area && s.area.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q));

      const matchesCity = selectedCity === "all" || s.city === selectedCity;
      const matchesArea = selectedArea === "all" || s.area === selectedArea;
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;

      return matchesSearch && matchesCity && matchesArea && matchesStatus;
    });
  }, [societies, searchQuery, selectedCity, selectedArea, statusFilter]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredSocieties.length) {
      toast.error("No societies found to export.");
      return;
    }

    try {
      const exportRows = filteredSocieties.map((soc, idx) => ({
        "Sr No": idx + 1,
        "Society ID": soc.id || "",
        "Society Name": toTitleCase(soc.name || ""),
        "Area": toTitleCase(soc.area || ""),
        "City": toTitleCase(soc.city || ""),
        "Wings Count": soc.wings?.length || soc.numberOfWings || 1,
        "Total Floors": soc.wings?.reduce((a, b) => a + Number(b.floors || 0), 0) || 0,
        "Status": soc.status === "enabled" ? "Enabled" : "Disabled",
        "Registered Cooks": getChefCountForSociety(soc),
        "Total Customers": soc.totalCustomers || 0,
      }));

      const dateStr = new Date().toISOString().slice(0, 10);
      const citySuffix = selectedCity !== "all" ? `_${selectedCity.replace(/\s+/g, "_")}` : "";
      exportToExcel(exportRows, `Mothers_Kitchen_Societies${citySuffix}_${dateStr}`, "Societies");
      toast.success(`Exported ${exportRows.length} society records to Excel (.xlsx)!`);
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to export Excel file: " + err.message);
    }
  };

  return (
    <Shell
      title="Society Management"
      subtitle="View and manage all societies created by admin with configurable wing & floor hierarchies."
      headerAction={
        <Button onClick={handleOpenAddModal} className="gap-2 rounded-xl cursor-pointer">
          <Plus className="size-4" />
          <span>Add Society</span>
        </Button>
      }
    >
      {/* Search and Filters Bar (Laundrysta Style) */}
      <Card className="border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search by society name, area or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full rounded-xl bg-card border-border"
            />
          </div>

          {/* Action Buttons: Filter Popover + Export Excel */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
            {/* Laundrysta-style Filter Popover */}
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`gap-2 h-10 rounded-xl cursor-pointer ${
                    activeFilterCount > 0 ? "border-primary bg-primary/10 text-primary font-bold" : ""
                  }`}
                >
                  <Filter className="size-4" />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="size-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent align="end" className="w-80 sm:w-88 p-5 space-y-4 rounded-2xl shadow-xl border-border bg-card">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                    <Filter className="size-4 text-primary" />
                    <span>Filter Societies</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCity("all");
                        setSelectedArea("all");
                        setStatusFilter("all");
                      }}
                      className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* City Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    City
                  </Label>
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      setSelectedCity(e.target.value);
                      setSelectedArea("all");
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">All Cities</option>
                    {availableCities.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Area Dropdown (Cascading from City) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Area
                  </Label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">All Areas</option>
                    {availableAreas.map((ar) => (
                      <option key={ar} value={ar}>
                        {ar}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </Label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                {/* Popover Footer */}
                <div className="pt-2 flex items-center justify-between border-t border-border">
                  <span className="text-xs text-muted-foreground font-semibold">
                    {filteredSocieties.length} societies found
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs cursor-pointer"
                      onClick={() => {
                        setSelectedCity("all");
                        setSelectedArea("all");
                        setStatusFilter("all");
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs rounded-lg cursor-pointer"
                      onClick={() => setIsFilterOpen(false)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Export Excel Button */}
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="gap-2 h-10 rounded-xl cursor-pointer hover:border-emerald-600 hover:text-emerald-600 transition-colors"
            >
              <FileSpreadsheet className="size-4 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Societies Table (BRD p. 18 layout) */}
      <Card className="border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Society Name</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Wings & Floors</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSocieties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No societies match your search criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredSocieties.map((soc, idx) => (
                <TableRow key={soc.id} className={soc.status === "disabled" ? "bg-rose-50/30" : ""}>
                  <TableCell className="text-center font-bold text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{toTitleCase(soc.name)}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                        {soc.id}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className={getChefCountForSociety(soc) > 0 ? "font-semibold text-emerald-700" : ""}>
                        {getChefCountForSociety(soc)} registered cooks
                      </span>
                      {" • "}
                      {soc.totalCustomers || 0} customers
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{toTitleCase(soc.area)}</TableCell>
                  <TableCell className="text-muted-foreground">{toTitleCase(soc.city)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1 font-mono text-[11px]">
                      <Layers className="size-3 text-muted-foreground" />
                      {soc.wings?.length || 1} Wings ({soc.wings?.reduce((a, b) => a + Number(b.floors || 0), 0)} Floors)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Switch
                        checked={soc.status === "enabled"}
                        onCheckedChange={() => handleToggleStatus(soc.id)}
                      />
                      <Badge variant={soc.status === "enabled" ? "success" : "destructive"}>
                        {soc.status === "enabled" ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingSociety(soc)}
                        title="View details"
                      >
                        <Eye className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditModal(soc)}
                        title="Edit society"
                      >
                        <Edit2 className="size-4 text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteSocietyId(soc.id)}
                        title="Delete society"
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add / Edit Society Modal (BRD p. 18 Layout) */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSociety ? "Edit Society" : "Add New Location & Society"}</DialogTitle>
            <DialogDescription>
              Define the residential location hierarchy for customer registration: City → Area → Society → Wings.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSociety} className="space-y-4 py-2">
            {/* City Details with Autocomplete Suggestions & Add Option */}
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border relative">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  City Name *
                </Label>
                <span className="text-[11px] text-primary font-medium">Auto-suggest or add new city</span>
              </div>
              <div className="relative">
                <Input
                  placeholder="e.g. Pune, Mumbai, Nagpur..."
                  value={formData.city}
                  onClick={() => setShowCitySuggestions(true)}
                  onChange={(e) => {
                    setFormData({ ...formData, city: toTitleCase(e.target.value) });
                    setShowCitySuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCitySuggestions(false), 250);
                  }}
                  required
                  autoComplete="off"
                  className="pr-9"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCitySuggestions((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                  title="Toggle city suggestions"
                >
                  <ChevronDown className={`size-4 transition-transform duration-200 ${showCitySuggestions ? "rotate-180" : ""}`} />
                </button>

                {/* Floating Interactive City Suggestions Dropdown */}
                {showCitySuggestions && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden py-1 max-h-52 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground border-b border-border bg-muted/50 flex items-center justify-between">
                      <span>Available Cities ({filteredCitySuggestions.length})</span>
                      <span className="text-[9px] lowercase font-normal">Click to select</span>
                    </div>

                    {filteredCitySuggestions.map((cityName) => (
                      <button
                        key={cityName}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between group cursor-pointer border-b border-border/40 last:border-0"
                        onMouseDown={() => {
                          setFormData({ ...formData, city: cityName });
                          setShowCitySuggestions(false);
                        }}
                      >
                        <span className="font-semibold text-foreground group-hover:text-primary">{cityName}</span>
                        <span className="text-[10px] text-muted-foreground group-hover:text-primary">Select</span>
                      </button>
                    ))}

                    {/* Option to Add New City if typed text doesn't match existing */}
                    {formData.city?.trim() &&
                      !allKnownCities.some((c) => c.toLowerCase() === formData.city.trim().toLowerCase()) && (
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2.5 text-xs bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors flex items-center gap-2 cursor-pointer border-t border-primary/20"
                          onMouseDown={() => {
                            const newCity = toTitleCase(formData.city.trim());
                            addCustomCity(newCity);
                            setFormData({ ...formData, city: newCity });
                            setShowCitySuggestions(false);
                            toast.success(`New city "${newCity}" added to suggestions!`);
                          }}
                        >
                          <Plus className="size-3.5" />
                          <span>Add "{toTitleCase(formData.city.trim())}" as new city</span>
                        </button>
                      )}
                  </div>
                )}
              </div>
            </div>

            {/* Area Details with Autocomplete Suggestions */}
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border border-border relative">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Area Name *
                </Label>
                <span className="text-[11px] text-primary font-medium">Type to search existing areas</span>
              </div>
              <div className="relative">
                <Input
                  placeholder="e.g. Wakad, Baner, Hinjewadi"
                  value={formData.area}
                  onClick={() => setShowAreaSuggestions(true)}
                  onChange={(e) => {
                    setFormData({ ...formData, area: toTitleCase(e.target.value) });
                    setShowAreaSuggestions(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowAreaSuggestions(false), 250);
                  }}
                  required
                  autoComplete="off"
                  className="pr-9"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowAreaSuggestions((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                  title="Toggle area suggestions"
                >
                  <ChevronDown className={`size-4 transition-transform duration-200 ${showAreaSuggestions ? "rotate-180" : ""}`} />
                </button>

                {/* Floating Interactive Suggestions Dropdown */}
                {showAreaSuggestions && filteredAreaSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl overflow-hidden py-1 max-h-48 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground border-b border-border bg-muted/50 flex items-center justify-between">
                      <span>Suggested Areas ({filteredAreaSuggestions.length})</span>
                      <span className="text-[9px] lowercase font-normal">Click to auto-fill</span>
                    </div>
                    {filteredAreaSuggestions.map((suggestion) => {
                      const count = societies.filter(
                        (s) => s.area?.toLowerCase() === suggestion.toLowerCase()
                      ).length;
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormData((prev) => ({ ...prev, area: suggestion }));
                            setShowAreaSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin className="size-3 text-muted-foreground group-hover:text-primary" />
                            <span className="font-semibold text-foreground group-hover:text-primary">
                              {suggestion}
                            </span>
                          </div>
                          {count > 0 && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-muted">
                              {count} {count === 1 ? "society" : "societies"}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Society In Area */}
            <div className="space-y-3 p-3 rounded-xl bg-muted/40 border border-border">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Society Name & Structure *
              </Label>
              <Input
                placeholder="e.g. Green Valley Society"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: toTitleCase(e.target.value) })}
                onBlur={() => setFormData((prev) => ({ ...prev, name: toTitleCase(prev.name.trim()) }))}
                required
                autoComplete="off"
              />
              {formData.name.trim() && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                  <span>Firestore Document ID:</span>
                  <Badge variant="outline" className="font-mono text-[10px] text-primary">
                    {generateSocietyId(formData.name)}
                  </Badge>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label htmlFor="numWings" className="text-xs font-semibold">Number of Wings</Label>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-xl cursor-pointer"
                      onClick={() => handleRemoveWing(formData.wings.length - 1)}
                      disabled={formData.wings.length <= 1}
                      title="Remove wing"
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <Input
                      id="numWings"
                      type="number"
                      min={1}
                      max={26}
                      value={formData.numberOfWings}
                      onChange={(e) => handleWingCountChange(e.target.value)}
                      className="h-9 text-center text-xs font-bold"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-xl cursor-pointer text-primary hover:bg-primary hover:text-white"
                      onClick={handleAddWing}
                      disabled={formData.wings.length >= 26}
                      title="Add wing (+)"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Initial Status</Label>
                  <div className="pt-2">
                    <Badge variant={formData.status === "enabled" ? "success" : "destructive"}>
                      {formData.status === "enabled" ? "Enabled by Default" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Dynamic Wings & Floor config with Add Wing (+) Button */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Floors Per Wing:
                    </Label>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {formData.wings.length} {formData.wings.length === 1 ? "Wing" : "Wings"}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddWing}
                    disabled={formData.wings.length >= 26}
                    className="h-7 px-2.5 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary hover:text-white cursor-pointer rounded-lg font-semibold"
                  >
                    <Plus className="size-3.5" />
                    <span>Add Wing</span>
                  </Button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {formData.wings.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border">
                      <div className="flex items-center gap-1.5 w-28 shrink-0">
                        <span className="text-[11px] text-muted-foreground font-semibold">Wing</span>
                        <Input
                          type="text"
                          value={w.name}
                          onChange={(e) => handleWingNameChange(idx, e.target.value)}
                          className="h-8 text-xs font-bold px-1.5 text-center"
                          placeholder="Name"
                        />
                      </div>
                      <div className="flex-1 flex items-center gap-1.5">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => handleFloorChange(idx, Math.max(1, Number(w.floors || 1) - 1))}
                            disabled={Number(w.floors) <= 1}
                            title="Decrease floors (-)"
                          >
                            <Minus className="size-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            max={60}
                            value={w.floors}
                            onChange={(e) => handleFloorChange(idx, e.target.value)}
                            className="h-8 w-16 text-xs font-semibold text-center"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 rounded-lg cursor-pointer text-primary hover:bg-primary hover:text-white"
                            onClick={() => handleFloorChange(idx, Math.min(60, Number(w.floors || 1) + 1))}
                            disabled={Number(w.floors) >= 60}
                            title="Increase floors (+)"
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">Floors</span>
                      </div>
                      {formData.wings.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveWing(idx)}
                          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer shrink-0"
                          title={`Remove Wing ${w.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick dashed button to add more wings */}
                <button
                  type="button"
                  onClick={handleAddWing}
                  disabled={formData.wings.length >= 26}
                  className="w-full py-2 border border-dashed border-primary/40 rounded-xl text-xs font-semibold text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
                >
                  <Plus className="size-3.5" />
                  <span>
                    Add More Wings{" "}
                    {formData.wings.length < 26
                      ? `(Wing ${String.fromCharCode(65 + formData.wings.length)})`
                      : "(Max 26 Wings)"}
                  </span>
                </button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    {editingSociety ? "Saving Changes..." : "Creating Society..."}
                  </>
                ) : (
                  editingSociety ? "Save Changes" : "Create Society"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(deleteSocietyId)} onOpenChange={(open) => !open && setDeleteSocietyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <span>Delete Society?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this society? Customers registered to this society will no longer be able to select it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSociety} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Details Dialog */}
      <Dialog open={Boolean(viewingSociety)} onOpenChange={(open) => !open && setViewingSociety(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              <span>{toTitleCase(viewingSociety?.name)}</span>
            </DialogTitle>
            <DialogDescription>
              {toTitleCase(viewingSociety?.area)}, {toTitleCase(viewingSociety?.city)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Operational Status:</span>
              <Badge variant={viewingSociety?.status === "enabled" ? "success" : "destructive"}>
                {viewingSociety?.status}
              </Badge>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Number of Wings:</span>
              <span className="font-bold">{viewingSociety?.wings?.length}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Total Floors:</span>
              <span className="font-bold">{viewingSociety?.wings?.reduce((a, b) => a + Number(b.floors), 0)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase">Wing Breakdown:</span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {viewingSociety?.wings?.map((w, i) => (
                  <div key={i} className="p-2 rounded-lg bg-muted/50 border text-xs flex justify-between">
                    <span className="font-bold">Wing {toTitleCase(w.name || "")}</span>
                    <span className="text-muted-foreground">{w.floors} Floors</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allocated Cooks in this Society */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Allocated Cooks ({getChefsForSociety(viewingSociety).length}):
                </span>
              </div>
              {getChefsForSociety(viewingSociety).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No cooks allocated to this society yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {getChefsForSociety(viewingSociety).map((c) => (
                    <div
                      key={c.id}
                      className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-xs flex justify-between items-center"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{c.fullName || c.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          {c.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{c.mobileNumber}</span>
                        <Badge variant={c.status === "enabled" ? "success" : "destructive"} className="text-[9px] py-0 px-1.5">
                          {c.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingSociety(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
