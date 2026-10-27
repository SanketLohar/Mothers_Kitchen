import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Shell } from "@/components/dashboard/Shell";
import {
  Megaphone,
  Search,
  Filter,
  Send,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  CheckCheck,
  ShieldCheck,
  Smartphone,
  Eye,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

  // Message Composer State
  const [messageText, setMessageText] = useState(
    "Hello! Check out our special homemade meal menu on Mother's Kitchen today!"
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
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
      const matchesSearch = !q || (cust.fullName || cust.name || "").toLowerCase().includes(q) || cust.mobileNumber.includes(q);
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

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size exceeds the 5 MB limit.");
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    toast.success("Promotional image attached.");
  };

  const handleRemoveAttachedImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
  };

  const handleInitiateSend = (e) => {
    e.preventDefault();
    if (!messageText.trim()) {
      toast.error("Please enter a WhatsApp message.");
      return;
    }
    if (selectedCustomerIds.size === 0) {
      toast.error("Please select at least one recipient customer.");
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleConfirmSend = async () => {
    setIsSending(true);
    setConfirmModalOpen(false);

    // Simulated / live Cloud Function dispatch
    setTimeout(() => {
      const newCampaign = {
        id: `CMP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`,
        sentOn: new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        messageText: messageText.trim(),
        imageUrl: imagePreviewUrl,
        targetSociety: selectedSociety === "all" ? "Multiple Societies" : selectedSociety,
        customerCount: selectedCustomerIds.size,
        status: isFirebaseConfigured ? "Dispatched" : "Delivered (Demo)",
      };

      setCampaigns((prev) => [newCampaign, ...prev]);
      setIsSending(false);
      toast.success(
        `WhatsApp broadcast queued for ${selectedCustomerIds.size} customers!`
      );
    }, 1200);
  };

  return (
    <Shell
      title="WhatsApp Marketing"
      subtitle="Send society-targeted promotional offers, weekly menus, and updates directly to customer WhatsApp numbers."
    >
      {/* 2-Column Composer Grid (BRD p. 24) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Step 1: Select Customers (Left Column) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                    1
                  </div>
                  <CardTitle className="text-base font-bold">Select Customers</CardTitle>
                </div>
                <Badge variant="outline" className="font-semibold text-xs">
                  {selectedCustomerIds.size} of {filteredCustomers.length} Selected
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {/* Filter Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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

              {/* Customers Checkbox Table (BRD p. 24) */}
              <div className="border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="h-9 text-xs">
                      <TableHead className="w-10 text-center">
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
                      <TableHead>Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                          No customers found in this society filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((c) => (
                        <TableRow key={c.id} className="h-10 text-xs">
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedCustomerIds.has(c.id)}
                              onCheckedChange={() => handleToggleCustomer(c.id)}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{c.name}</TableCell>
                          <TableCell className="font-mono">{c.mobileNumber}</TableCell>
                          <TableCell className="text-muted-foreground truncate max-w-[140px]" title={c.address}>
                            {c.address}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Step 2: Create WhatsApp Message & Live Preview (Right Column) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-[#E76F51] text-white text-xs font-bold flex items-center justify-center">
                  2
                </div>
                <CardTitle className="text-base font-bold">Create WhatsApp Message</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Message Composer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-foreground">Message Text *</label>
                  <span className="text-muted-foreground text-[11px]">{messageText.length} characters</span>
                </div>
                <Textarea
                  rows={4}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type promotional message..."
                  className="text-xs resize-none"
                  required
                />
              </div>

              {/* Image Attachment (Optional) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-muted-foreground">Attach Promotional Image (Optional)</label>
                  {imagePreviewUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAttachedImage}
                      className="text-destructive text-[11px] hover:underline"
                    >
                      Remove Image
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <div className="h-10 border border-dashed border-border rounded-xl bg-muted/40 hover:bg-muted flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground transition-colors">
                      <Upload className="size-3.5" />
                      <span>{imagePreviewUrl ? "Replace Image (PNG, JPG)" : "Upload Banner Image"}</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* WhatsApp Mobile Bubble Preview Frame (BRD p. 24) */}
              <div className="rounded-2xl bg-[#EFEAE2] p-3 border border-border shadow-inner space-y-2 relative">
                {/* WhatsApp Chat Header */}
                <div className="flex items-center gap-2 pb-2 border-b border-[#D8D2C2] text-xs">
                  <div className="size-6 rounded-full bg-[#1B4332] text-white text-[10px] font-bold flex items-center justify-center">
                    MK
                  </div>
                  <div className="font-bold text-[#1B4332] text-[11px] flex items-center gap-1">
                    Mother's Kitchen Official
                    <ShieldCheck className="size-3 text-emerald-600 inline" />
                  </div>
                </div>

                {/* Chat Bubble */}
                <div className="bg-white rounded-xl p-2.5 shadow-xs max-w-[92%] ml-auto space-y-1.5 border border-[#DFDAD0]">
                  {imagePreviewUrl && (
                    <div className="rounded-lg overflow-hidden aspect-[2/1] bg-muted">
                      <img src={imagePreviewUrl} alt="Attached" className="size-full object-cover" />
                    </div>
                  )}
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {messageText || "Enter message text above to see live preview..."}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[9px] text-muted-foreground pt-0.5">
                    <span>10:30 AM</span>
                    <CheckCheck className="size-3 text-sky-500" />
                  </div>
                </div>
              </div>

              {/* Send Button */}
              <Button
                type="button"
                onClick={handleInitiateSend}
                disabled={isSending}
                className="w-full h-11 text-sm font-bold bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-sm gap-2"
              >
                <Send className="size-4" />
                <span>{isSending ? "Dispatching Broadcast..." : `Send WhatsApp Message (${selectedCustomerIds.size} recipients)`}</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
            {campaigns.map((camp) => (
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
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Broadcast Confirmation Dialog */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-5 text-[#E76F51]" />
              <span>Confirm WhatsApp Broadcast</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to broadcast this message to{" "}
              <strong>{selectedCustomerIds.size}</strong> verified customers in{" "}
              <strong>{selectedSociety === "all" ? "All Societies" : selectedSociety}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-muted/50 border text-xs text-muted-foreground space-y-2">
            <p>• Only customers who have opted in and registered will receive this broadcast.</p>
            <p>• Rate limits will be applied automatically via Cloud Functions.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSend} className="bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold">
              Confirm & Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
