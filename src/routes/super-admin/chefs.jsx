import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Shell } from "@/components/dashboard/Shell";
import {
  ChefHat,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Shield,
  Eye,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Lock,
  CloudUpload,
  Copy,
  Loader2,
  Building2,
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isFirebaseConfigured } from "@/lib/firebase";
import { exportToExcel } from "@/lib/excel-export";
import { formatCurrency, toTitleCase } from "@/lib/utils";
import {
  subscribeToChefs,
  createChef,
  updateChef,
  toggleAdminDeactivation,
  deleteChef,
} from "@/services/chefService";
import { subscribeToSocieties } from "@/services/societyService";

export const Route = createFileRoute("/super-admin/chefs")({
  component: ChefManagementPage,
});

function ChefAvatar({ photoUrl, name, size = "size-11", textSize = "text-xs" }) {
  const [hasError, setHasError] = useState(false);
  const initials = (name || "C")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isValidUrl = Boolean(
    photoUrl &&
    typeof photoUrl === "string" &&
    photoUrl.trim() &&
    !hasError
  );

  if (isValidUrl) {
    return (
      <img
        src={photoUrl.trim()}
        alt={name || "Chef"}
        className={`${size} rounded-full object-cover border border-border bg-muted`}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full border border-primary/25 bg-primary/10 text-primary font-bold ${textSize} flex items-center justify-center shrink-0 uppercase tracking-wider select-none shadow-2xs`}
    >
      {initials || <ChefHat className="size-4" />}
    </div>
  );
}

export function ChefManagementPage() {
  const [chefs, setChefs] = useState([]);
  const [societiesList, setSocietiesList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedSociety, setSelectedSociety] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Subscribe to live Firestore Chefs and Societies
  useEffect(() => {
    const unsubChefs = subscribeToChefs((list) => {
      setChefs(list || []);
      setLoading(false);
    });

    const unsubSocieties = subscribeToSocieties((socs) => {
      setSocietiesList(socs || []);
    });

    return () => {
      unsubChefs();
      unsubSocieties();
    };
  }, []);

  // Filter Popover Distinct Options
  const availableCities = useMemo(() => {
    return Array.from(new Set(societiesList.map((s) => s.city).filter(Boolean)));
  }, [societiesList]);

  const availableAreas = useMemo(() => {
    const relevant = selectedCity === "all"
      ? societiesList
      : societiesList.filter((s) => s.city === selectedCity);
    return Array.from(new Set(relevant.map((s) => s.area).filter(Boolean)));
  }, [societiesList, selectedCity]);

  const availableSocieties = useMemo(() => {
    return societiesList.filter((s) => {
      const matchCity = selectedCity === "all" || s.city === selectedCity;
      const matchArea = selectedArea === "all" || s.area === selectedArea;
      return matchCity && matchArea;
    });
  }, [societiesList, selectedCity, selectedArea]);

  const activeFilterCount =
    (selectedCity !== "all" ? 1 : 0) +
    (selectedArea !== "all" ? 1 : 0) +
    (selectedSociety !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingChef, setEditingChef] = useState(null);
  const [deleteChefId, setDeleteChefId] = useState(null);
  const [viewingChef, setViewingChef] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Add / Edit Chef (BRD p. 20)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
    photoUrl: "",
    idCardNumber: "",
    city: "",
    area: "",
    baseSociety: "",
    flatNumber: "",
    wing: "",
    street: "",
    address: "",
    assignedSocieties: [],
    defaultPassword: "123456",
  });

  // Delivery Societies Allocation Filters
  const [assignFilterCity, setAssignFilterCity] = useState("all");
  const [assignFilterArea, setAssignFilterArea] = useState("all");

  const assignAvailableCities = useMemo(() => {
    return Array.from(new Set(societiesList.map((s) => s.city).filter(Boolean))).sort();
  }, [societiesList]);

  const assignAvailableAreas = useMemo(() => {
    const list = assignFilterCity === "all"
      ? societiesList
      : societiesList.filter((s) => (s.city || "").toLowerCase() === assignFilterCity.toLowerCase());
    return Array.from(new Set(list.map((s) => s.area).filter(Boolean))).sort();
  }, [societiesList, assignFilterCity]);

  const filteredAssignableSocieties = useMemo(() => {
    return societiesList.filter((s) => {
      const matchCity = assignFilterCity === "all" || (s.city || "").toLowerCase() === assignFilterCity.toLowerCase();
      const matchArea = assignFilterArea === "all" || (s.area || "").toLowerCase() === assignFilterArea.toLowerCase();
      return matchCity && matchArea;
    });
  }, [societiesList, assignFilterCity, assignFilterArea]);

  // Modal Form Location Options (cascading)
  const formAvailableCities = useMemo(() => {
    let extra = [];
    try {
      const stored = localStorage.getItem("mk_custom_cities");
      if (stored) extra = JSON.parse(stored);
    } catch {
      // ignore
    }
    const combined = [...societiesList.map((s) => s.city), ...extra].filter(Boolean);
    return Array.from(new Set(combined.map((c) => toTitleCase(c))));
  }, [societiesList]);

  const formAvailableAreas = useMemo(() => {
    const list = formData.city
      ? societiesList.filter((s) => (s.city || "").toLowerCase() === (formData.city || "").toLowerCase())
      : societiesList;
    return Array.from(new Set(list.map((s) => toTitleCase(s.area)).filter(Boolean)));
  }, [societiesList, formData.city]);

  const formAvailableSocieties = useMemo(() => {
    return societiesList.filter((s) => {
      const matchCity = !formData.city || (s.city || "").toLowerCase() === (formData.city || "").toLowerCase();
      const matchArea = !formData.area || (s.area || "").toLowerCase() === (formData.area || "").toLowerCase();
      return matchCity && matchArea;
    });
  }, [societiesList, formData.city, formData.area]);

  // Selected base society object from store
  const currentBaseSocietyObj = useMemo(() => {
    return societiesList.find(
      (s) =>
        (s.name || "").toLowerCase() === (formData.baseSociety || "").toLowerCase() ||
        (s.id || "").toLowerCase() === (formData.baseSociety || "").toLowerCase()
    );
  }, [societiesList, formData.baseSociety]);

  // Available wings under selected society
  const availableWingsForSociety = useMemo(() => {
    if (!currentBaseSocietyObj) return [];
    if (currentBaseSocietyObj.wings && currentBaseSocietyObj.wings.length > 0) {
      return currentBaseSocietyObj.wings;
    }
    return [{ name: "A", floors: 10 }];
  }, [currentBaseSocietyObj]);

  // Available floors for selected wing
  const availableFloorsForWing = useMemo(() => {
    if (!formData.baseSociety || !availableWingsForSociety.length) return [];
    const selectedWing = availableWingsForSociety.find(
      (w) =>
        w.name === formData.wing ||
        `Wing ${w.name}` === formData.wing ||
        toTitleCase(w.name) === toTitleCase(formData.wing)
    );
    const count = Number(selectedWing?.floors || availableWingsForSociety[0]?.floors || 10);
    return Array.from({ length: Math.max(1, count) }, (_, i) => i + 1);
  }, [formData.baseSociety, availableWingsForSociety, formData.wing]);

  const updateFormattedAddress = (flat, floor, wing, soc, area, city) => {
    const flatStr = flat ? `Flat ${flat}` : "";
    const floorStr = floor ? `Floor ${floor}` : "";
    const wingStr = wing ? (String(wing).toLowerCase().startsWith("wing") ? wing : `Wing ${wing}`) : "";
    const internalUnit = [flatStr, floorStr, wingStr].filter(Boolean).join(", ");
    return [internalUnit, soc, area, city].filter(Boolean).join(", ");
  };

  const handleFormCityChange = (newCity) => {
    setFormData((prev) => ({
      ...prev,
      city: newCity,
      area: "",
      baseSociety: "",
      floor: "",
      wing: "",
      address: updateFormattedAddress(prev.flatNumber, "", "", "", "", newCity),
      assignedSocieties: [],
    }));
  };

  const handleFormAreaChange = (newArea) => {
    setFormData((prev) => ({
      ...prev,
      area: newArea,
      baseSociety: "",
      floor: "",
      wing: "",
      address: updateFormattedAddress(prev.flatNumber, "", "", "", newArea, prev.city),
      assignedSocieties: [],
    }));
  };

  const handleFormSocietyChange = (newSoc) => {
    const found = societiesList.find((s) => s.name === newSoc || s.id === newSoc);
    const city = found?.city || formData.city;
    const area = found?.area || formData.area;

    setFormData((prev) => ({
      ...prev,
      city,
      area,
      baseSociety: newSoc,
      wing: "",
      floor: "",
      address: updateFormattedAddress(prev.flatNumber, "", "", newSoc, area, city),
      // ONLY base society should be selected!
      assignedSocieties: newSoc ? [newSoc] : [],
    }));
  };

  const handleFormFlatChange = (flatNumber) => {
    const cleanNumber = flatNumber.replace(/\D/g, "");
    setFormData((prev) => ({
      ...prev,
      flatNumber: cleanNumber,
      address: updateFormattedAddress(cleanNumber, prev.floor, prev.wing, prev.baseSociety, prev.area, prev.city),
    }));
  };

  const handleFormFloorChange = (floor) => {
    setFormData((prev) => ({
      ...prev,
      floor,
      address: updateFormattedAddress(prev.flatNumber, floor, prev.wing, prev.baseSociety, prev.area, prev.city),
    }));
  };

  const handleFormWingChange = (wing) => {
    setFormData((prev) => ({
      ...prev,
      wing,
      address: updateFormattedAddress(prev.flatNumber, prev.floor, wing, prev.baseSociety, prev.area, prev.city),
    }));
  };

  const handleFormStreetChange = (street) => {
    setFormData((prev) => ({
      ...prev,
      street,
      address: updateFormattedAddress(prev.flatNumber, prev.floor, prev.wing, prev.baseSociety, prev.area, prev.city),
    }));
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxDim = 480;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // 0.8 JPEG quality gives crisp avatar quality with typical size ~25-45 KB
          const compressed = canvas.toDataURL("image/jpeg", 0.8);
          resolve(compressed);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size exceeds the 10 MB limit.");
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setFormData((prev) => ({ ...prev, photoUrl: compressedDataUrl }));
      toast.success("Photo attached and optimized!");
    } catch (err) {
      console.error("Error processing photo:", err);
      toast.error("Failed to process photo. Please try a different image.");
    } finally {
      e.target.value = "";
    }
  };

  const initialChefFormData = {
    fullName: "",
    email: "",
    mobileNumber: "",
    photoUrl: "",
    idCardNumber: "",
    city: "",
    area: "",
    baseSociety: "",
    flatNumber: "",
    floor: "",
    wing: "",
    street: "",
    address: "",
    assignedSocieties: [],
    defaultPassword: "123456",
    isDeactivatedByAdmin: false,
    isActive: true,
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingChef(null);
    setFormData({ ...initialChefFormData });
    setAssignFilterCity("all");
    setAssignFilterArea("all");
  };

  const handleOpenAddModal = () => {
    setEditingChef(null);
    setFormData({ ...initialChefFormData });
    setAssignFilterCity("all");
    setAssignFilterArea("all");
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (chef) => {
    setEditingChef(chef);
    const foundSoc = societiesList.find(
      (s) => s.name === chef.baseSociety || s.id === chef.baseSociety
    );
    const chefCity = toTitleCase(foundSoc?.city || chef.city || formAvailableCities[0] || "");
    const chefArea = toTitleCase(foundSoc?.area || chef.area || "");
    const chefBaseSoc = toTitleCase(chef.baseSociety || foundSoc?.name || "");
    const chefWing = chef.wing || (foundSoc?.wings?.[0]?.name ? toTitleCase(foundSoc.wings[0].name) : "A");
    const chefFloor = chef.floor || "1";

    setFormData({
      fullName: toTitleCase(chef.fullName || chef.name || ""),
      email: chef.email || "",
      mobileNumber: chef.mobileNumber || "",
      photoUrl: chef.photoUrl || "",
      idCardNumber: chef.idCardNumber || chef.aadharNumber || "",
      city: chefCity,
      area: chefArea,
      baseSociety: chefBaseSoc,
      flatNumber: chef.flatNumber || "",
      floor: chefFloor,
      wing: chefWing,
      street: chef.street || "",
      address: chef.address || updateFormattedAddress(chef.flatNumber, chefFloor, chefWing, chefBaseSoc, chefArea, chefCity),
      assignedSocieties: chef.assignedSocieties || (chefBaseSoc ? [chefBaseSoc] : []),
      defaultPassword: "••••••••",
      isDeactivatedByAdmin: Boolean(chef.isDeactivatedByAdmin),
      isActive: chef.isActive !== undefined ? Boolean(chef.isActive) : true,
    });
    setAssignFilterCity("all");
    setAssignFilterArea("all");
    setIsAddModalOpen(true);
  };

  const handleToggleSocietyAssignment = (societyName) => {
    setFormData((prev) => {
      const exists = prev.assignedSocieties.includes(societyName);
      if (exists) {
        return {
          ...prev,
          assignedSocieties: prev.assignedSocieties.filter((s) => s !== societyName),
        };
      } else {
        return {
          ...prev,
          assignedSocieties: [...prev.assignedSocieties, societyName],
        };
      }
    });
  };

  const handleToggleAdminDeactivation = async (chefId) => {
    const target = chefs.find((c) => c.id === chefId);
    if (!target) return;

    const deactivate = !target.isDeactivatedByAdmin;

    // Optimistic UI update
    setChefs((prev) =>
      prev.map((c) => (c.id === chefId ? { ...c, isDeactivatedByAdmin: deactivate } : c))
    );

    if (isFirebaseConfigured && !chefId.startsWith("chef-")) {
      try {
        await toggleAdminDeactivation(chefId, deactivate);
      } catch (err) {
        console.error("Toggle error:", err);
        toast.error("Failed to update status in database.");
        // revert
        setChefs((prev) =>
          prev.map((c) => (c.id === chefId ? { ...c, isDeactivatedByAdmin: !deactivate } : c))
        );
        return;
      }
    }

    toast.success(
      deactivate
        ? `${target.fullName} has been Admin-Deactivated. They cannot log in until you re-enable them.`
        : `${target.fullName} has been re-enabled by Admin. Chef can now self-manage login.`
    );
  };

  const handleSaveChef = async (e) => {
    e.preventDefault();

    const chefName = String(formData.fullName || "").trim();
    const chefMob = String(formData.mobileNumber || "").trim();

    if (!chefName || !chefMob) {
      toast.error("Please fill in Chef Full Name and Mobile Number.");
      return;
    }

    if (!formData.photoUrl || !formData.photoUrl.trim()) {
      toast.error("Chef photograph is mandatory for registration. Please upload a photo.");
      return;
    }

    if (!formData.baseSociety) {
      toast.error("Please select a Base Residence Society.");
      return;
    }

    if (!formData.flatNumber) {
      toast.error("Please enter Flat Number.");
      return;
    }

    if (!formData.floor) {
      toast.error("Please select a Floor.");
      return;
    }

    if (!formData.wing) {
      toast.error("Please select a Wing / Building.");
      return;
    }

    if (!formData.assignedSocieties.length) {
      toast.error("Please assign at least one deliverable society.");
      return;
    }

    const payload = {
      ...formData,
      fullName: toTitleCase(chefName),
      city: toTitleCase(formData.city),
      area: toTitleCase(formData.area),
      baseSociety: toTitleCase(formData.baseSociety),
      flatNumber: String(formData.flatNumber || "").trim(),
      floor: String(formData.floor || "").trim(),
      wing: String(formData.wing || "").trim(),
      street: toTitleCase(formData.street || ""),
      idCardNumber: (formData.idCardNumber || "").trim(),
      aadharNumber: (formData.idCardNumber || "").trim(),
    };

    setIsSubmitting(true);
    try {
      if (editingChef) {
        if (isFirebaseConfigured && !editingChef.id.startsWith("chef-")) {
          await updateChef(editingChef.id, payload);
          toast.success(`Chef "${payload.fullName}" profile updated in Firestore!`);
        } else {
          setChefs((prev) =>
            prev.map((c) =>
              c.id === editingChef.id
                ? {
                    ...c,
                    ...payload,
                    idCardNumber: payload.idCardNumber,
                    aadharNumber: payload.aadharNumber,
                  }
                : c
            )
          );
          toast.success(`Chef "${payload.fullName}" profile updated.`);
        }
      } else {
        if (isFirebaseConfigured) {
          const created = await createChef(payload);
          toast.success(`Chef "${payload.fullName}" registered successfully with ID ${created.id}!`);
        } else {
          const cleanM = chefMob.replace(/\D/g, "");
          const newChef = {
            id: `chef-${Date.now()}`,
            ...payload,
            email: payload.email.trim() || `${cleanM}@motherskitchen.com`,
            status: "enabled",
            isDailyActive: true,
          };
          setChefs((prev) => [newChef, ...prev]);
          toast.success(
            `Chef "${payload.fullName}" registered. Credentials: ${chefMob} / ${formData.defaultPassword}`
          );
        }
      }
      handleCloseModal();
    } catch (err) {
      console.error("Save chef error:", err);
      toast.error("Failed to save chef: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteChef = async () => {
    if (!deleteChefId) return;
    const target = chefs.find((c) => c.id === deleteChefId);
    setChefs((prev) => prev.filter((c) => c.id !== deleteChefId));

    if (isFirebaseConfigured && !deleteChefId.startsWith("chef-")) {
      try {
        await deleteChef(deleteChefId);
      } catch (err) {
        console.error("Delete error:", err);
      }
    }

    toast.success(`Chef "${target?.fullName || ""}" deleted.`);
    setDeleteChefId(null);
  };

  // SheetJS Genuine Excel (.xlsx) Export
  const handleExportExcel = () => {
    if (!filteredChefs.length) {
      toast.error("No chef records match the active filter criteria.");
      return;
    }

    try {
      const exportRows = filteredChefs.map((c, i) => ({
        "Sr No": i + 1,
        "Chef ID": c.id,
        "Chef Name": toTitleCase(c.fullName || c.name || "Chef"),
        "Mobile Number": c.mobileNumber,
        "Auth Email": c.authEmail || c.email || "N/A",
        "Default Password": c.defaultPassword || c.password || "N/A",
        "Base Society": toTitleCase(c.baseSociety || "Not Set"),
        "Address": c.address || "",
        "Aadhar Card Number": c.idCardNumber || c.aadharNumber || "",
        "Admin Login Status": c.isDeactivatedByAdmin ? "Blocked by Admin" : "Enabled by Admin",
        "Chef Mobile App Status": c.isActive ? "Active (Taking Orders)" : "Inactive (Offline)",
        "Rating": Number(c.rating || 5.0),
        "Total Orders": Number(c.totalOrders || 0),
      }));

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeSoc = selectedSociety !== "all" ? `_${String(selectedSociety || "").replace(/\s+/g, "_")}` : "";
      exportToExcel(exportRows, `Mothers_Kitchen_Chefs${safeSoc}_${dateStr}`, "Chefs");
      toast.success(`Exported ${exportRows.length} chef records to Excel (.xlsx)!`);
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to generate Excel file: " + err.message);
    }
  };

  const filteredChefs = useMemo(() => {
    return chefs.map((c) => ({
      ...c,
      fullName: toTitleCase(c.fullName || c.name || "Chef"),
      baseSociety: toTitleCase(c.baseSociety || ""),
    })).filter((c) => {
      const query = String(searchQuery || "").toLowerCase().trim();
      const cName = String(c.fullName || "").toLowerCase();
      const cMob = String(c.mobileNumber || "").toLowerCase();
      const cAddr = String(c.address || "").toLowerCase();
      const cBaseSoc = String(c.baseSociety || "").toLowerCase();
      const cId = String(c.id || "").toLowerCase();

      const matchesSearch =
        !query ||
        cName.includes(query) ||
        cMob.includes(query) ||
        cAddr.includes(query) ||
        cBaseSoc.includes(query) ||
        cId.includes(query);

      // Filter by admin status
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "enabled" && !c.isDeactivatedByAdmin) ||
        (statusFilter === "disabled" && c.isDeactivatedByAdmin);

      // Get all society names linked to this chef
      const chefSocietyNames = Array.from(
        new Set([...(c.assignedSocieties || []), c.baseSociety].filter(Boolean))
      );

      // Find society objects from societiesList for city and area checks
      const matchedSocs = societiesList.filter(
        (s) => chefSocietyNames.includes(s.name) || chefSocietyNames.includes(s.id)
      );

      // Check City match
      const matchesCity =
        selectedCity === "all" ||
        matchedSocs.some((s) => String(s.city || "").toLowerCase() === selectedCity.toLowerCase()) ||
        cAddr.includes(selectedCity.toLowerCase());

      // Check Area match
      const matchesArea =
        selectedArea === "all" ||
        matchedSocs.some((s) => String(s.area || "").toLowerCase() === selectedArea.toLowerCase()) ||
        cAddr.includes(selectedArea.toLowerCase());

      // Check Society match
      const matchesSociety =
        selectedSociety === "all" ||
        chefSocietyNames.some((sn) => sn.toLowerCase() === selectedSociety.toLowerCase());

      return matchesSearch && matchesStatus && matchesCity && matchesArea && matchesSociety;
    });
  }, [chefs, searchQuery, statusFilter, selectedCity, selectedArea, selectedSociety, societiesList]);

  return (
    <Shell
      title="Chef Management"
      subtitle="Register chefs, provision mobile logins, manage deliverable society allotments and enable/disable access."
      headerAction={
        <Button onClick={handleOpenAddModal} className="gap-2 rounded-xl cursor-pointer">
          <Plus className="size-4" />
          <span>Add Chef</span>
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
              placeholder="Search By Phone, Name Or Email..."
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
                    <span>Filter Chefs</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCity("all");
                        setSelectedArea("all");
                        setSelectedSociety("all");
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
                  <Select
                    value={selectedCity}
                    onValueChange={(val) => {
                      setSelectedCity(val);
                      setSelectedArea("all");
                      setSelectedSociety("all");
                    }}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {availableCities.map((ct, idx) => (
                        <SelectItem key={`filter-city-${ct}-${idx}`} value={ct}>
                          {toTitleCase(ct)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Area Dropdown (Cascading from City) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Area
                  </Label>
                  <Select
                    value={selectedArea}
                    onValueChange={(val) => {
                      setSelectedArea(val);
                      setSelectedSociety("all");
                    }}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {availableAreas.map((ar, idx) => (
                        <SelectItem key={`filter-area-${ar}-${idx}`} value={ar}>
                          {toTitleCase(ar)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Society Dropdown (Cascading from Area & City) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Society Name
                  </Label>
                  <Select
                    value={selectedSociety}
                    onValueChange={(val) => setSelectedSociety(val)}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold">
                      <SelectValue placeholder="All Societies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Societies</SelectItem>
                      {availableSocieties.map((soc, idx) => (
                        <SelectItem key={`filter-soc-${soc.id || soc.name}-${idx}`} value={soc.name}>
                          {toTitleCase(soc.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Admin Status Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Admin Status
                  </Label>
                  <Select
                    value={statusFilter}
                    onValueChange={(val) => setStatusFilter(val)}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="enabled">Admin Enabled</SelectItem>
                      <SelectItem value="disabled">Admin Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Matched Count & Apply Button */}
                <div className="pt-2 flex items-center justify-between border-t border-border">
                  <span className="text-xs text-muted-foreground font-medium">
                    {filteredChefs.length} {filteredChefs.length === 1 ? "chef" : "chefs"} matched
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setIsFilterOpen(false)}
                    className="px-5 rounded-xl cursor-pointer"
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Export Excel Button (Laundrysta placement) */}
            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="gap-2 h-10 rounded-xl cursor-pointer font-semibold border-border hover:bg-muted"
              title="Download filtered chefs list as genuine Excel (.xlsx) file"
            >
              <FileSpreadsheet className="size-4 text-primary" />
              <span>Export Excel</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chefs Table (BRD p. 20) */}
      <Card className="border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Chef</TableHead>
              <TableHead>Mobile Number</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredChefs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No chefs match your search criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredChefs.map((chef, idx) => (
                <TableRow
                  key={chef.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/60 ${
                    chef.isDeactivatedByAdmin ? "bg-rose-50/30" : ""
                  }`}
                  onClick={() => setViewingChef(chef)}
                >
                  <TableCell className="text-center font-bold text-muted-foreground">
                    {idx + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 group/chef">
                      <div className="relative shrink-0 transition-transform group-hover/chef:scale-105">
                        <ChefAvatar
                          photoUrl={chef.photoUrl}
                          name={chef.fullName}
                          size="size-11"
                        />
                        {/* Live Avatar Presence Badge */}
                        <span
                          className={`absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-white shadow-xs ${
                            chef.isActive ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                          title={chef.isActive ? "Chef is Active (Taking orders on app)" : "Chef is Offline on app"}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground group-hover/chef:text-primary group-hover/chef:underline underline-offset-2 transition-colors">
                            {toTitleCase(chef.fullName)}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                            {chef.id}
                          </span>
                          {chef.isDeactivatedByAdmin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 font-semibold border border-rose-200">
                              Blocked
                            </span>
                          )}
                        </div>
                        {/* Active on App Pill directly below Chef Name */}
                        <div className="flex items-center gap-2 mt-1">
                          {chef.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold shadow-2xs">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active on App</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-300 text-zinc-700 text-[10px] font-medium">
                              <span className="size-1.5 rounded-full bg-zinc-400" />
                              <span>Offline on App</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="size-3" />
                          {toTitleCase(chef.baseSociety) || "No base society"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="size-3 text-muted-foreground" />
                      <span>{chef.mobileNumber}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                      {chef.authEmail || chef.email || "No email"}
                    </div>
                    {(chef.defaultPassword || chef.password) && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          PW: {chef.defaultPassword || chef.password}
                        </span>
                        <button
                          type="button"
                          title="Copy Mobile & Password"
                          className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            const cred = `Chef Login:\nMobile: ${chef.mobileNumber}\nPassword: ${chef.defaultPassword || chef.password}`;
                            navigator.clipboard.writeText(cred);
                            toast.success("Credentials copied for WhatsApp!");
                          }}
                        >
                          <Copy className="size-3" />
                        </button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-muted-foreground truncate" title={chef.address}>
                    {chef.address || "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewingChef(chef)}
                        title="View profile"
                      >
                        <Eye className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEditModal(chef)}
                        title="Edit chef"
                      >
                        <Edit2 className="size-4 text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteChefId(chef.id)}
                        title="Delete chef"
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

      {/* Add / Edit Chef Modal (BRD p. 20) */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseModal();
          else setIsAddModalOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <DialogTitle>{editingChef ? "Edit Chef Profile" : "Add Chef & Provision Login"}</DialogTitle>
                <DialogDescription>
                  Register a cook, allocate deliverable societies from the society directory, and configure login credentials.
                </DialogDescription>
              </div>
              {editingChef && (
                <div className="shrink-0 pt-0.5">
                  {formData.isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-2xs">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active on App
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-300 text-zinc-700 text-xs font-semibold">
                      <span className="size-2 rounded-full bg-zinc-400" />
                      Offline on App
                    </span>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveChef} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="chefName">Full Name *</Label>
                <Input
                  id="chefName"
                  placeholder="e.g. Sunita Patil"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: toTitleCase(e.target.value) })}
                  onBlur={() => setFormData((prev) => ({ ...prev, fullName: toTitleCase(prev.fullName.trim()) }))}
                  required
                  autoComplete="off"
                />
                {editingChef && (
                  <div className="flex items-center gap-2 pt-0.5">
                    {formData.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-bold">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Active on App</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-300 text-zinc-700 text-[11px] font-medium">
                        <span className="size-1.5 rounded-full bg-zinc-400" />
                        <span>Offline on App</span>
                      </span>
                    )}
                    {formData.isDeactivatedByAdmin && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-[11px] font-semibold">
                        Admin Blocked
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="chefEmail">Email ID</Label>
                <Input
                  id="chefEmail"
                  type="email"
                  placeholder="sunita.patil@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="chefMobile">Mobile Number (Login ID) *</Label>
                <Input
                  id="chefMobile"
                  placeholder="98765 43210"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="chefIdCard">Aadhar Card Number</Label>
                <Input
                  id="chefIdCard"
                  placeholder="e.g. 1234 5678 9012"
                  value={formData.idCardNumber}
                  onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value })}
                />
              </div>
            </div>

            {/* Photo Upload Option with Live Preview (Mandatory) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Chef Photograph *</Label>
                <span className="text-[10px] text-destructive font-bold uppercase tracking-wider">
                  Mandatory for Registration
                </span>
              </div>
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  !formData.photoUrl
                    ? "bg-amber-500/5 border-amber-500/30"
                    : "bg-muted/40 border-border"
                }`}
              >
                <div className="relative size-14 rounded-full overflow-hidden border-2 border-primary/25 bg-card flex items-center justify-center shrink-0 shadow-2xs">
                  {formData.photoUrl && formData.photoUrl.trim() ? (
                    <img
                      src={formData.photoUrl}
                      alt="Chef Preview"
                      className="size-full object-cover"
                    />
                  ) : (
                    <ChefHat className="size-6 text-muted-foreground/60" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5 pointer-events-none rounded-lg"
                      >
                        <Upload className="size-3.5" />
                        <span>{formData.photoUrl ? "Change Photo" : "Upload Photo *"}</span>
                      </Button>
                    </label>
                    {formData.photoUrl && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setFormData((prev) => ({ ...prev, photoUrl: "" }))}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, or WebP up to 5 MB</p>
                </div>
              </div>
            </div>

            {/* Location & Complete Address Hierarchy (Laundrysta Style) */}
            <div className="space-y-3 p-3.5 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-primary" />
                  <span>Base Location & Society Selection</span>
                </Label>
                <span className="text-[11px] text-primary font-medium">Auto-populates complete address</span>
              </div>

              {/* City & Area Cascading Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">City *</Label>
                  <Select
                    value={formData.city || undefined}
                    onValueChange={(val) => handleFormCityChange(val)}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold">
                      <SelectValue placeholder="Select City" />
                    </SelectTrigger>
                    <SelectContent>
                      {formAvailableCities.map((ct, idx) => (
                        <SelectItem key={`opt-city-${ct}-${idx}`} value={ct}>
                          {toTitleCase(ct)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Area *</Label>
                  <Select
                    value={formData.area || undefined}
                    onValueChange={(val) => handleFormAreaChange(val)}
                    disabled={!formData.city}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                      <SelectValue placeholder={formData.city ? "Select Area" : "Select City First"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formAvailableAreas.map((ar, idx) => (
                        <SelectItem key={`opt-area-${ar}-${idx}`} value={ar}>
                          {toTitleCase(ar)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Base Society & Separate Flat Number / Floor / Wing/Building Fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Base Residence Society *</Label>
                  <Select
                    value={formData.baseSociety || undefined}
                    onValueChange={(val) => handleFormSocietyChange(val)}
                    disabled={!formData.area}
                  >
                    <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                      <SelectValue placeholder={formData.area ? "Select Base Society" : "Select Area First"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formAvailableSocieties.map((soc, idx) => (
                        <SelectItem key={`opt-soc-${soc.id || soc.name}-${idx}`} value={soc.name}>
                          {toTitleCase(soc.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Flat Number | Floor | Wing/Building Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Flat Number : Text box accepting number */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Flat Number *</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 402"
                      value={formData.flatNumber || ""}
                      onChange={(e) => handleFormFlatChange(e.target.value)}
                      className="h-10 text-xs font-semibold"
                      required
                    />
                  </div>

                  {/* Floor : Dropdown from data stored under society option */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Floor *</Label>
                    <Select
                      value={formData.floor ? String(formData.floor) : undefined}
                      onValueChange={(val) => handleFormFloorChange(val)}
                      disabled={!formData.baseSociety}
                    >
                      <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                        <SelectValue placeholder="Select Floor" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFloorsForWing.map((fl, idx) => (
                          <SelectItem key={`opt-floor-${fl}-${idx}`} value={String(fl)}>
                            Floor {fl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Wing/Building : Dropdown from data stored under society option */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Wing / Building *</Label>
                    <Select
                      value={formData.wing || undefined}
                      onValueChange={(val) => handleFormWingChange(val)}
                      disabled={!formData.baseSociety}
                    >
                      <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-input bg-card text-foreground text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                        <SelectValue placeholder="Select Wing" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableWingsForSociety.map((w, idx) => (
                          <SelectItem key={`opt-wing-${w.name || idx}-${idx}`} value={toTitleCase(w.name)}>
                            Wing {toTitleCase(w.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Formatted Complete Address Preview */}
              <div className="space-y-1 pt-1">
                <Label htmlFor="chefAddress" className="text-xs text-muted-foreground font-semibold">
                  Complete Address (Auto-Formatted)
                </Label>
                <Input
                  id="chefAddress"
                  placeholder="e.g. Flat 402, Floor 4, Wing A, Green Valley Society, Wakad, Pune"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="text-xs bg-muted/50 font-medium"
                  required
                />
              </div>
            </div>

            {/* Allocate Delivery Societies with City & Area Filter Suggestions */}
            <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Allocate Delivery Societies *
                </Label>
                <span className="text-xs text-primary font-bold">
                  {formData.assignedSocieties.length} Societies Selected
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Filter by City & Area below to select societies where this cook is approved to deliver.
              </p>

              {/* City and Area Filter Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pb-1">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Select City</Label>
                  <Select
                    value={assignFilterCity}
                    onValueChange={(val) => {
                      setAssignFilterCity(val);
                      setAssignFilterArea("all");
                    }}
                  >
                    <SelectTrigger className="w-full h-9 px-2.5 rounded-xl border border-input bg-card text-foreground text-xs font-medium cursor-pointer">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {assignAvailableCities.map((c, idx) => (
                        <SelectItem key={`alloc-city-${c}-${idx}`} value={c}>{toTitleCase(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Select Area</Label>
                  <Select
                    value={assignFilterArea}
                    onValueChange={(val) => setAssignFilterArea(val)}
                  >
                    <SelectTrigger className="w-full h-9 px-2.5 rounded-xl border border-input bg-card text-foreground text-xs font-medium cursor-pointer">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {assignAvailableAreas.map((a, idx) => (
                        <SelectItem key={`alloc-area-${a}-${idx}`} value={a}>{toTitleCase(a)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Select / Deselect Filtered Buttons */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-[11px] text-muted-foreground">
                  Showing {filteredAssignableSocieties.length} societies
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const names = filteredAssignableSocieties.map((s) => s.name);
                      setFormData((prev) => ({
                        ...prev,
                        assignedSocieties: Array.from(new Set([...prev.assignedSocieties, ...names])),
                      }));
                    }}
                    className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
                  >
                    Select All Filtered
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      const names = filteredAssignableSocieties.map((s) => s.name);
                      setFormData((prev) => ({
                        ...prev,
                        assignedSocieties: prev.assignedSocieties.filter((name) => !names.includes(name)),
                      }));
                    }}
                    className="text-[11px] text-muted-foreground hover:underline cursor-pointer"
                  >
                    Deselect Filtered
                  </button>
                </div>
              </div>

              {/* Filtered Societies Multi-Select Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pt-1 pr-1">
                {filteredAssignableSocieties.map((soc) => {
                  const isChecked = formData.assignedSocieties.includes(soc.name);
                  const isBase = formData.baseSociety === soc.name;
                  return (
                    <button
                      key={soc.id}
                      type="button"
                      onClick={() => handleToggleSocietyAssignment(soc.name)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs text-left transition-colors cursor-pointer ${
                        isChecked
                          ? "bg-primary/10 border-primary text-primary font-bold"
                          : "bg-card border-border hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{toTitleCase(soc.name)}</span>
                        {isBase && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 bg-background shrink-0">
                            Base
                          </Badge>
                        )}
                      </div>
                      {isChecked && <CheckCircle2 className="size-3.5 text-primary shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Status & App Availability (BRD Login Control) */}
            <div className="p-3.5 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider">
                  <Shield className="size-4 text-primary" />
                  <span>Account Access & App Availability</span>
                </div>
                {editingChef && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ID: {editingChef.id}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {/* 1. Admin Login Access Toggle */}
                <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">Admin Login Access</Label>
                    <Badge variant={formData.isDeactivatedByAdmin ? "destructive" : "success"} className="text-[10px]">
                      {formData.isDeactivatedByAdmin ? "Admin Blocked" : "Admin Enabled"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground max-w-[180px] leading-tight">
                      {formData.isDeactivatedByAdmin
                        ? "Chef is blocked from logging in to mobile app."
                        : "Chef can log in and fulfill society orders."}
                    </span>
                    <Switch
                      checked={!formData.isDeactivatedByAdmin}
                      onCheckedChange={(enabled) =>
                        setFormData((prev) => ({ ...prev, isDeactivatedByAdmin: !enabled }))
                      }
                    />
                  </div>
                </div>

                {/* 2. Active App Status Toggle */}
                <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">Chef App Availability</Label>
                    <Badge
                      variant={formData.isActive ? "success" : "secondary"}
                      className={`text-[10px] gap-1 ${formData.isActive ? "bg-emerald-500/15 text-emerald-800 border-emerald-300" : ""}`}
                    >
                      <span className={`size-1.5 rounded-full ${formData.isActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
                      {formData.isActive ? "Active on App" : "Offline on App"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground max-w-[180px] leading-tight">
                      {formData.isActive
                        ? "Chef is active and taking orders on customer app."
                        : "Chef is offline and unavailable for orders."}
                    </span>
                    <Switch
                      checked={Boolean(formData.isActive)}
                      onCheckedChange={(active) =>
                        setFormData((prev) => ({ ...prev, isActive: active }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Initial Login Credentials (BRD p. 20) */}
            {(() => {
              const displayMobile = formData?.mobileNumber ? String(formData.mobileNumber).trim() : "";

              return (
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                      <Lock className="size-3.5" />
                      <span>Chef Mobile App Login Credentials</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-background font-semibold">
                      Mobile Login
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Chef Mobile Login ID</Label>
                        <span className="text-[10px] text-primary font-semibold">
                          Mobile Number
                        </span>
                      </div>
                      <Input
                        value={displayMobile || "Enter mobile number above"}
                        disabled
                        className="text-xs bg-muted font-mono font-semibold"
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        Chef logs into mobile app directly using their registered Mobile Number.
                      </span>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{editingChef ? "Reset / Update Password" : "Default Password *"}</Label>
                      <Input
                        value={formData.defaultPassword}
                        onChange={(e) => setFormData({ ...formData, defaultPassword: e.target.value })}
                        className="text-xs font-mono"
                        placeholder="Min 6 characters"
                        required={!editingChef}
                      />
                      <span className="text-[10px] text-muted-foreground block">
                        Chef enters this in the mobile app.
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-background/80 border p-2 text-[11px] text-muted-foreground space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <Shield className="size-3 text-primary" />
                      Chef Mobile Login Flow:
                    </div>
                    <p>
                      The chef logs in directly using their registered <strong>Mobile Number</strong> and this <strong>Password</strong>.
                      The Super Admin session remains 100% active while credentials are saved in Firestore and provisioned in Firebase Auth.
                    </p>
                  </div>
                </div>
              );
            })()}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    {editingChef ? "Saving Profile..." : "Registering Chef..."}
                  </>
                ) : (
                  editingChef ? "Save Profile" : "Register Chef"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(deleteChefId)} onOpenChange={(open) => !open && setDeleteChefId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <span>Delete Chef?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chef? Their listed items will be removed from all associated societies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChef} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Chef Profile Modal */}
      <Dialog open={Boolean(viewingChef)} onOpenChange={(open) => !open && setViewingChef(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <ChefAvatar
                photoUrl={viewingChef?.photoUrl}
                name={viewingChef?.fullName}
                size="size-12"
                textSize="text-sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">{toTitleCase(viewingChef?.fullName)}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                    {viewingChef?.id}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-normal">
                  Aadhar / ID: {viewingChef?.aadharNumber || viewingChef?.idCardNumber || "—"}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            {/* Credentials Callout Card */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Lock className="size-3.5" />
                  <span>Chef Mobile App Credentials</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    const text = `Hello ${viewingChef?.fullName || "Chef"}! Welcome to Mother's Kitchen.\n\nYour Chef Mobile App Login:\n• Mobile Number: ${viewingChef?.mobileNumber}\n• Password: ${viewingChef?.defaultPassword || viewingChef?.password || "—"}\n\nPlease keep your credentials safe.`;
                    navigator.clipboard.writeText(text);
                    toast.success("Login details copied for WhatsApp!");
                  }}
                >
                  <Copy className="size-3" />
                  Copy for WhatsApp
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Login Mobile</span>
                  <span className="font-mono font-bold text-foreground">{viewingChef?.mobileNumber}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Password</span>
                  <span className="font-mono font-bold text-primary">
                    {viewingChef?.defaultPassword || viewingChef?.password || "—"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Auth Email ID</span>
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {viewingChef?.authEmail || `${(viewingChef?.mobileNumber || "").replace(/\D/g, "")}@motherskitchen.com`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Mobile:</span>
              <span className="font-semibold">{viewingChef?.mobileNumber}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-semibold">{viewingChef?.email || "—"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Status:</span>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={viewingChef?.isDeactivatedByAdmin ? "destructive" : "success"}>
                  {viewingChef?.isDeactivatedByAdmin ? "Admin Blocked" : "Admin Enabled"}
                </Badge>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className={`size-1.5 rounded-full inline-block ${viewingChef?.isActive ? "bg-emerald-500" : "bg-zinc-400"}`} />
                  {viewingChef?.isActive ? "Chef Self-Active" : "Chef Self-Inactive (via Mobile App)"}
                </span>
              </div>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Base Society:</span>
              <span className="font-semibold">{toTitleCase(viewingChef?.baseSociety)}</span>
            </div>
            {(viewingChef?.flatNumber || viewingChef?.wing || viewingChef?.floor) && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Residence Flat / Wing:</span>
                <span className="font-semibold text-right">
                  {viewingChef?.flatNumber ? `Flat ${viewingChef.flatNumber}` : ""}
                  {viewingChef?.wing ? `, Wing ${toTitleCase(viewingChef.wing)}` : ""}
                  {viewingChef?.floor ? `, Floor ${viewingChef.floor}` : ""}
                </span>
              </div>
            )}
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Location (City / Area):</span>
              <span className="font-semibold">
                {toTitleCase(viewingChef?.city || "")}{viewingChef?.area ? ` / ${toTitleCase(viewingChef?.area)}` : ""}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Complete Address:</span>
              <span className="text-xs text-right max-w-xs">{viewingChef?.address}</span>
            </div>
            <div className="space-y-1 pt-1">
              <span className="text-xs font-bold text-muted-foreground uppercase">
                Admin Allocated Delivery Societies ({viewingChef?.assignedSocieties?.length || 0}):
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {viewingChef?.assignedSocieties?.length ? (
                  viewingChef.assignedSocieties.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs py-1 px-2 font-medium">
                      {toTitleCase(s)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">None allocated</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const target = viewingChef;
                setViewingChef(null);
                handleOpenEditModal(target);
              }}
              className="gap-1.5 rounded-xl text-xs font-semibold cursor-pointer"
            >
              <Edit2 className="size-3.5" />
              Edit Profile
            </Button>
            <Button
              variant="default"
              onClick={() => setViewingChef(null)}
              className="rounded-xl text-xs font-semibold px-5 cursor-pointer"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
