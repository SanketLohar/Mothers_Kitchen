import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Shell } from "@/components/dashboard/Shell";
import {
  Users,
  Search,
  Filter,
  Download,
  Eye,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileSpreadsheet,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/excel-export";
import { toTitleCase } from "@/lib/utils";
import { subscribeToCustomers } from "@/services/customerService";
import { subscribeToSocieties } from "@/services/societyService";

export const Route = createFileRoute("/super-admin/customers")({
  component: CustomersPage,
});

export function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [societiesList, setSocietiesList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedSociety, setSelectedSociety] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const pageSize = 8;

  useEffect(() => {
    const unsubCust = subscribeToCustomers((list) => {
      setCustomers(list || []);
    });

    const unsubSocs = subscribeToSocieties((list) => {
      setSocietiesList(list || []);
    });

    return () => {
      unsubCust();
      unsubSocs();
    };
  }, []);

  // Extract distinct dynamic filter options from live societies
  // Extract distinct locations cascading by selectedCity and selectedArea
  const filterOptions = useMemo(() => {
    const list = societiesList;
    const cities = Array.from(new Set(list.map((s) => s.city))).filter(Boolean).sort();

    const filteredForArea =
      selectedCity === "all"
        ? list
        : list.filter((s) => (s.city || "").toLowerCase() === selectedCity.toLowerCase());
    const areas = Array.from(new Set(filteredForArea.map((s) => s.area))).filter(Boolean).sort();

    const filteredForSociety = list.filter((s) => {
      const matchCity =
        selectedCity === "all" || (s.city || "").toLowerCase() === selectedCity.toLowerCase();
      const matchArea =
        selectedArea === "all" || (s.area || "").toLowerCase() === selectedArea.toLowerCase();
      return matchCity && matchArea;
    });
    const societies = Array.from(new Set(filteredForSociety.map((s) => s.name))).filter(Boolean).sort();

    return { cities, areas, societies };
  }, [societiesList, selectedCity, selectedArea]);

  const handleCityChange = (city) => {
    setSelectedCity(city);
    setSelectedArea("all");
    setSelectedSociety("all");
    setCurrentPage(1);
  };

  const handleAreaChange = (area) => {
    setSelectedArea(area);
    setSelectedSociety("all");
    setCurrentPage(1);
  };

  useEffect(() => {
    if (selectedArea !== "all" && !filterOptions.areas.includes(selectedArea)) {
      setSelectedArea("all");
    }
  }, [filterOptions.areas, selectedArea]);

  useEffect(() => {
    if (selectedSociety !== "all" && !filterOptions.societies.includes(selectedSociety)) {
      setSelectedSociety("all");
    }
  }, [filterOptions.societies, selectedSociety]);

  // Filtered customer set matching active criteria
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        cust.name.toLowerCase().includes(q) ||
        cust.mobileNumber.toLowerCase().includes(q) ||
        cust.address.toLowerCase().includes(q);

      const matchesCity = selectedCity === "all" || cust.city === selectedCity;
      const matchesArea = selectedArea === "all" || cust.area === selectedArea;
      const matchesSociety = selectedSociety === "all" || cust.society === selectedSociety;

      return matchesSearch && matchesCity && matchesArea && matchesSociety;
    });
  }, [customers, searchQuery, selectedCity, selectedArea, selectedSociety]);

  // Pagination calculation
  const totalItems = filteredCustomers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCity("all");
    setSelectedArea("all");
    setSelectedSociety("all");
    setCurrentPage(1);
    toast.info("Customer filters reset.");
  };

  // SheetJS Genuine Excel (.xlsx) Export (BRD p. 22)
  const handleExportExcel = () => {
    if (!filteredCustomers.length) {
      toast.error("No customer records match the active filter criteria.");
      return;
    }

    try {
      const exportRows = filteredCustomers.map((c, i) => ({
        "Sr No": i + 1,
        "Customer Name": toTitleCase(c.name),
        "Mobile Number": c.mobileNumber,
        "Email ID": c.email || "N/A",
        "Delivery Address": c.address,
        "Society": toTitleCase(c.society),
        "Area": toTitleCase(c.area),
        "City": toTitleCase(c.city),
      }));

      const dateStr = new Date().toISOString().slice(0, 10);
      exportToExcel(exportRows, `Mothers_Kitchen_Customers_${dateStr}`, "Customers");
      toast.success(`Exported ${exportRows.length} customer records to genuine Excel (.xlsx) file!`);
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to generate Excel file: " + err.message);
    }
  };

  return (
    <Shell
      title="Customer Database"
      subtitle="View all registered customers with verified society addresses, filter by location and export to Excel."
    >
      {/* Filters Bar matching BRD p. 22 */}
      <Card className="border-border">
        <CardContent className="p-4 space-y-3">
          {/* Location Dropdowns (Cascading) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* City Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">City</label>
              <Select value={selectedCity} onValueChange={handleCityChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {filterOptions.cities.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Area Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Area</label>
              <Select value={selectedArea} onValueChange={handleAreaChange}>
                <SelectTrigger>
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Areas</SelectItem>
                  {filterOptions.areas.map((area) => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Society Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Society</label>
              <Select value={selectedSociety} onValueChange={(val) => { setSelectedSociety(val); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All Societies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Societies</SelectItem>
                  {filterOptions.societies.map((soc) => (
                    <SelectItem key={soc} value={soc}>{soc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Box & Actions (Reset + Export Excel) */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <div className="relative flex-1 w-full">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by customer name, mobile number or address..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-10 w-full rounded-xl bg-card border-border"
              />
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="gap-2 h-10 rounded-xl cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Filters</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleExportExcel}
                className="gap-2 h-10 rounded-xl cursor-pointer hover:border-emerald-600 hover:text-emerald-700 transition-colors"
              >
                <FileSpreadsheet className="size-4 text-emerald-600" />
                <span>Export to Excel</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table (BRD p. 22 Layout) */}
      <Card className="border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Mobile Number</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Society</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No customers found matching the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((cust, idx) => (
                <TableRow key={cust.id}>
                  <TableCell className="text-center font-bold text-muted-foreground">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </TableCell>
                  <TableCell className="font-bold text-foreground">
                    {toTitleCase(cust.name)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-foreground">
                    {cust.mobileNumber}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={cust.address}>
                    {cust.address}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{toTitleCase(cust.city)}</TableCell>
                  <TableCell className="font-medium text-foreground text-sm">{toTitleCase(cust.area)}</TableCell>
                  <TableCell className="text-sm font-semibold text-primary">{toTitleCase(cust.society)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewingCustomer(cust)}
                      title="View Customer Profile"
                    >
                      <Eye className="size-4 text-muted-foreground hover:text-primary" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar (BRD p. 22) */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-bold text-foreground">{paginatedCustomers.length ? (currentPage - 1) * pageSize + 1 : 0}</span> to{" "}
            <span className="font-bold text-foreground">{Math.min(currentPage * pageSize, totalItems)}</span> of{" "}
            <span className="font-bold text-foreground">{totalItems}</span> filtered customers
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2.5 rounded-lg"
            >
              Previous
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`size-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  currentPage === page
                    ? "bg-primary text-primary-foreground"
                    : "border border-border hover:bg-muted text-foreground"
                }`}
              >
                {page}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2.5 rounded-lg"
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Customer Profile Modal */}
      <Dialog open={Boolean(viewingCustomer)} onOpenChange={(open) => !open && setViewingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <span>{toTitleCase(viewingCustomer?.name)}</span>
            </DialogTitle>
            <DialogDescription>
              Registered Resident • {toTitleCase(viewingCustomer?.society)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Mobile Number:</span>
              <span className="font-mono font-bold">{viewingCustomer?.mobileNumber}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Email:</span>
              <span>{viewingCustomer?.email || "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Society:</span>
              <span className="font-semibold text-primary">{toTitleCase(viewingCustomer?.society)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Area & City:</span>
              <span>{toTitleCase(viewingCustomer?.area)}, {toTitleCase(viewingCustomer?.city)}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground uppercase">Complete Flat Address:</span>
              <p className="p-3 rounded-lg bg-muted/50 border text-xs leading-relaxed font-medium">
                {viewingCustomer?.address}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingCustomer(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
