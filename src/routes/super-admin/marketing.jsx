import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Shell } from "@/components/dashboard/Shell";
import {
  Megaphone,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { toTitleCase } from "@/lib/utils";
import { isFirebaseConfigured } from "@/lib/firebase";
import { subscribeToSocieties } from "@/services/societyService";
import { subscribeToCustomers } from "@/services/customerService";

export const Route = createFileRoute("/super-admin/marketing")({
  component: MarketingPage,
});

export function MarketingPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [societiesList, setSocietiesList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedSociety, setSelectedSociety] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsubSocs = subscribeToSocieties((list) => {
      setSocietiesList(list || []);
    });
    const unsubCusts = subscribeToCustomers((list) => {
      setCustomersList(list || []);
    });
    return () => {
      unsubSocs();
      unsubCusts();
    };
  }, []);

  // Customer Selection State
  const [selectedCustomerIds, setSelectedCustomerIds] = useState(new Set());
  const [viewingCampaign, setViewingCampaign] = useState(null);

  // Extract distinct locations cascading by selectedCity and selectedArea
  const filterOptions = useMemo(() => {
    const list = societiesList;
    const cities = Array.from(new Set(list.map((s) => s.city))).filter(Boolean).sort();

    // Cascading areas based on selectedCity
    const filteredForArea =
      selectedCity === "all"
        ? list
        : list.filter((s) => (s.city || "").toLowerCase() === selectedCity.toLowerCase());
    const areas = Array.from(new Set(filteredForArea.map((s) => s.area))).filter(Boolean).sort();

    // Cascading societies based on selectedCity AND selectedArea
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
  };

  const handleAreaChange = (area) => {
    setSelectedArea(area);
    setSelectedSociety("all");
  };

  // Auto-reset invalid selections when options change
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

  // Filtered customer pool
  const filteredCustomers = useMemo(() => {
    const pool = customersList;
    return pool.filter((cust) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (cust.fullName || cust.name || "").toLowerCase().includes(q) || (cust.mobileNumber || cust.mobile || "").includes(q);
      const matchesCity = selectedCity === "all" || cust.city === selectedCity;
      const matchesArea = selectedArea === "all" || cust.area === selectedArea;
      const matchesSociety = selectedSociety === "all" || cust.society === selectedSociety;
      return matchesSearch && matchesCity && matchesArea && matchesSociety;
    });
  }, [customersList, searchQuery, selectedCity, selectedArea, selectedSociety]);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedCustomerIds(new Set(filteredCustomers.map((c) => c.id)));
    } else {
      setSelectedCustomerIds(new Set());
    }
  };

  const handleToggleCustomer = (id) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Shell
      title="WhatsApp Marketing"
      subtitle="Send society-targeted promotional offers, weekly menus, and updates directly to customer WhatsApp numbers."
    >
      {/* Full Width Customer Selection Section */}
      <div className="space-y-6">
        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-primary" />
                <CardTitle className="text-base font-bold">Select Customers</CardTitle>
              </div>
              <Badge variant="outline" className="font-semibold text-xs">
                {selectedCustomerIds.size} of {filteredCustomers.length} Selected
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">City</label>
                <Select value={selectedCity} onValueChange={handleCityChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="City" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cities</SelectItem>
                    {filterOptions.cities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Area</label>
                <Select value={selectedArea} onValueChange={handleAreaChange}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Areas</SelectItem>
                    {filterOptions.areas.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">Society</label>
                <Select value={selectedSociety} onValueChange={setSelectedSociety}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Society" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Societies</SelectItem>
                    {filterOptions.societies.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search Customer Input */}
            <div className="relative">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filter selected customers by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8.5 h-9 text-xs"
              />
            </div>

            {/* Customers Checkbox Table (Full Width) */}
            <div className="border border-border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="h-9 text-xs bg-muted/40">
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={
                          filteredCustomers.length > 0 &&
                          filteredCustomers.every((c) => selectedCustomerIds.has(c.id))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Mobile Number</TableHead>
                    <TableHead>Society</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-xs text-muted-foreground">
                        No customers found in this society filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((c) => (
                      <TableRow key={c.id} className="h-10 text-xs hover:bg-muted/30">
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedCustomerIds.has(c.id)}
                            onCheckedChange={() => handleToggleCustomer(c.id)}
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{toTitleCase(c.name || c.fullName || "Resident")}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{c.mobileNumber || c.mobile || "—"}</TableCell>
                        <TableCell className="font-medium text-foreground">{toTitleCase(c.society || "—")}</TableCell>
                        <TableCell className="text-muted-foreground">{toTitleCase(c.area || "—")}</TableCell>
                        <TableCell className="text-muted-foreground">{toTitleCase(c.city || "—")}</TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[240px]" title={typeof c.address === "string" ? c.address : ""}>
                          {typeof c.address === "string" ? c.address : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Message History Table (BRD p. 24 Bottom) */}
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/70">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>Message History</span>
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Sent On</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-20 text-center">Image</TableHead>
                <TableHead>Target Society</TableHead>
                <TableHead className="text-center w-28">Customers</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-xs text-muted-foreground">
                    No past message campaigns recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((camp) => (
                  <TableRow key={camp.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {camp.sentOn}
                    </TableCell>
                    <TableCell className="text-xs text-foreground max-w-md truncate font-medium">
                      {camp.messageText}
                    </TableCell>
                    <TableCell className="text-center">
                      {camp.imageUrl ? (
                        <img
                          src={camp.imageUrl}
                          alt="Campaign Banner"
                          className="size-8 rounded-md object-cover border mx-auto"
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-primary">
                      {camp.targetSociety}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs text-foreground">
                      {camp.customerCount}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="success" className="text-[10px]">
                        <CheckCircle2 className="size-3 mr-1" />
                        {camp.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingCampaign(camp)}
                        title="View details"
                      >
                        <Eye className="size-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* View Campaign Details Modal */}
      <Dialog open={Boolean(viewingCampaign)} onOpenChange={(open) => !open && setViewingCampaign(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Campaign Details</DialogTitle>
            <DialogDescription>{viewingCampaign?.id} • {viewingCampaign?.sentOn}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Target Society:</span>
              <span className="font-bold text-primary">{viewingCampaign?.targetSociety}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Recipients:</span>
              <span className="font-bold">{viewingCampaign?.customerCount} customers</span>
            </div>
            <div className="space-y-1">
              <span className="font-bold text-muted-foreground uppercase">Broadcast Message:</span>
              <p className="p-3 rounded-lg bg-muted border leading-relaxed">{viewingCampaign?.messageText}</p>
            </div>
            {viewingCampaign?.imageUrl && (
              <div className="space-y-1">
                <span className="font-bold text-muted-foreground uppercase">Attached Image:</span>
                <img src={viewingCampaign?.imageUrl} alt="Banner" className="rounded-xl border max-h-48 w-full object-cover" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setViewingCampaign(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
