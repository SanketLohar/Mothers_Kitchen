import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { Shell } from "@/components/dashboard/Shell";
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Smartphone,
  Eye,
  Info,
  RefreshCw,
  Sliders,
  Save,
  Globe,
  Building2,
  MapPin,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";
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
import {
  subscribeToHighlights,
  saveHighlightSlot,
  subscribeToSocietyHighlights,
  saveSocietyHighlightSlot,
  subscribeToAllSocietyHighlights,
} from "@/services/highlightService";
import { subscribeToSocieties } from "@/services/societyService";

export const Route = createFileRoute("/super-admin/highlights")({
  component: HighlightsPage,
});

const EMPTY_SLOTS = [1, 2, 3, 4].map((slot) => ({
  slotNumber: slot,
  title: "",
  subtitle: "",
  imageUrl: "",
  isActive: false,
}));

const LOCAL_STORAGE_KEY = "mk_last_selected_society_highlights";

export function HighlightsPage() {
  // Tabs: "global" | "society"
  const [activeScopeTab, setActiveScopeTab] = useState("global");

  // Global highlights state
  const [highlights, setHighlights] = useState(EMPTY_SLOTS);
  const [savingSlot, setSavingSlot] = useState(null);

  // Society cascading selectors & state
  const [societiesList, setSocietiesList] = useState([]);
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedArea, setSelectedArea] = useState("all");
  const [selectedSocietyId, setSelectedSocietyId] = useState("");
  const [societyHighlights, setSocietyHighlights] = useState(EMPTY_SLOTS);
  const [savingSocietySlot, setSavingSocietySlot] = useState(null);

  // Map of all configured society highlights across the system: { [societyId]: [slot1..4] }
  const [configuredSocietiesMap, setConfiguredSocietiesMap] = useState({});
  const autoSelectedRef = useRef(false);

  // Mobile preview carousel dialog
  const [previewCarouselOpen, setPreviewCarouselOpen] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Subscribe to Global highlights from Firestore
  useEffect(() => {
    const unsub = subscribeToHighlights((list) => {
      if (list && list.length) {
        setHighlights((prev) => {
          return list.map((remote) => {
            const local = prev.find((p) => p.slotNumber === remote.slotNumber);
            if (local?.isDirty) {
              return {
                ...remote,
                ...local,
              };
            }
            return {
              ...remote,
              isDirty: false,
            };
          });
        });
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to societies for cascading filter dropdowns
  useEffect(() => {
    const unsubSocieties = subscribeToSocieties((list) => {
      setSocietiesList(list || []);
    });
    return () => unsubSocieties();
  }, []);

  // Subscribe to all society highlights system-wide
  useEffect(() => {
    const unsubAll = subscribeToAllSocietyHighlights((map) => {
      setConfiguredSocietiesMap(map || {});
    });
    return () => unsubAll();
  }, []);

  // Distinct cities from registered societies
  const availableCities = useMemo(() => {
    return Array.from(new Set(societiesList.map((s) => s.city).filter(Boolean))).sort();
  }, [societiesList]);

  // Distinct areas filtered by selected city
  const availableAreas = useMemo(() => {
    const filtered = selectedCity === "all"
      ? societiesList
      : societiesList.filter((s) => s.city === selectedCity);
    return Array.from(new Set(filtered.map((s) => s.area).filter(Boolean))).sort();
  }, [societiesList, selectedCity]);

  // Societies filtered by city and area
  const availableSocieties = useMemo(() => {
    return societiesList
      .filter((s) => {
        const matchCity = selectedCity === "all" || s.city === selectedCity;
        const matchArea = selectedArea === "all" || s.area === selectedArea;
        return matchCity && matchArea;
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [societiesList, selectedCity, selectedArea]);

  // Separate available societies into those with configured highlights vs others
  const { configuredSocieties, otherSocieties } = useMemo(() => {
    const configured = [];
    const others = [];
    availableSocieties.forEach((s) => {
      const slots = configuredSocietiesMap[s.id];
      const hasConfig = slots && slots.some((x) => x.imageUrl || x.title || x.isActive);
      if (hasConfig) {
        configured.push(s);
      } else {
        others.push(s);
      }
    });
    return { configuredSocieties: configured, otherSocieties: others };
  }, [availableSocieties, configuredSocietiesMap]);

  // Currently selected society object
  const activeSociety = useMemo(() => {
    return societiesList.find((s) => s.id === selectedSocietyId);
  }, [societiesList, selectedSocietyId]);

  // Auto-Select Logic: Preload last viewed society or first configured society (e.g. ITPL)
  useEffect(() => {
    if (autoSelectedRef.current || !societiesList.length) return;

    // Check localStorage first
    const savedId = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedId && societiesList.some((s) => s.id === savedId)) {
      handleSocietyChange(savedId);
      autoSelectedRef.current = true;
      return;
    }

    // Otherwise, auto-select the first configured society if available
    const configuredIds = Object.keys(configuredSocietiesMap);
    if (configuredIds.length > 0) {
      const matchSoc = societiesList.find((s) => configuredIds.includes(s.id));
      if (matchSoc) {
        handleSocietyChange(matchSoc.id);
        autoSelectedRef.current = true;
      }
    }
  }, [societiesList, configuredSocietiesMap]);

  // Subscribe to selected society's highlights when chosen
  useEffect(() => {
    if (!selectedSocietyId) {
      setSocietyHighlights(EMPTY_SLOTS);
      return;
    }

    const unsub = subscribeToSocietyHighlights(selectedSocietyId, (list) => {
      if (list && list.length) {
        setSocietyHighlights((prev) => {
          return list.map((remote) => {
            const local = prev.find((p) => p.slotNumber === remote.slotNumber);
            if (local?.isDirty) {
              return {
                ...remote,
                ...local,
              };
            }
            return {
              ...remote,
              isDirty: false,
            };
          });
        });
      } else {
        setSocietyHighlights(EMPTY_SLOTS);
      }
    });

    return () => unsub();
  }, [selectedSocietyId]);

  // Cascading change handlers
  const handleCityChange = (city) => {
    setSelectedCity(city);
    setSelectedArea("all");
    setSelectedSocietyId("");
  };

  const handleAreaChange = (area) => {
    setSelectedArea(area);
    setSelectedSocietyId("");
  };

  const handleSocietyChange = (societyId) => {
    setSelectedSocietyId(societyId);
    if (societyId) {
      localStorage.setItem(LOCAL_STORAGE_KEY, societyId);
    }
    const target = societiesList.find((s) => s.id === societyId);
    if (target) {
      if (target.city) setSelectedCity(target.city);
      if (target.area) setSelectedArea(target.area);
    }
  };

  // Compresses banner to high-quality persistent data URL (JPEG max 1080x540 ~50KB)
  const compressBanner = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxW = 1080;
          const maxH = 540;
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // --- GLOBAL HIGHLIGHT HANDLERS ---
  const handleToggleGlobalActive = async (slotNumber) => {
    const target = highlights.find((h) => h.slotNumber === slotNumber);
    if (!target) return;
    const next = !target.isActive;
    const updated = { ...target, isActive: next };

    setHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? updated : h))
    );

    if (isFirebaseConfigured) {
      try {
        await saveHighlightSlot(slotNumber, updated);
        toast.success(`Global Slot #${slotNumber} is now ${next ? "ACTIVE" : "INACTIVE"} on Customer App.`);
      } catch (err) {
        console.error("Highlight toggle error:", err);
        toast.error("Failed to update status: " + err.message);
      }
    }
  };

  const handleSaveGlobalSlot = async (slotNumber) => {
    const target = highlights.find((h) => h.slotNumber === slotNumber);
    if (!target) return;

    setSavingSlot(slotNumber);
    if (isFirebaseConfigured) {
      try {
        await saveHighlightSlot(slotNumber, target);
        setHighlights((prev) =>
          prev.map((h) => (h.slotNumber === slotNumber ? { ...h, isDirty: false } : h))
        );
        toast.success(`Global Slot #${slotNumber} saved to Firestore! Status: ${target.isActive ? "ACTIVE (Live on App)" : "INACTIVE"}`);
      } catch (err) {
        toast.error("Failed to save slot: " + err.message);
      } finally {
        setSavingSlot(null);
      }
    } else {
      setTimeout(() => {
        setHighlights((prev) =>
          prev.map((h) => (h.slotNumber === slotNumber ? { ...h, isDirty: false } : h))
        );
        setSavingSlot(null);
        toast.success(`Global Slot #${slotNumber} saved.`);
      }, 300);
    }
  };

  const handleUpdateGlobalText = (slotNumber, field, value) => {
    setHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? { ...h, [field]: value, isDirty: true } : h))
    );
  };

  const handleGlobalImageFileSelect = async (slotNumber, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image file size exceeds the 15 MB limit.");
      return;
    }

    try {
      const dataUrl = await compressBanner(file);
      const target = highlights.find((h) => h.slotNumber === slotNumber) || { slotNumber };
      const updatedSlot = {
        ...target,
        slotNumber,
        imageUrl: dataUrl,
        isActive: true, // Automatically set switch to Active so user sees it will be active on save
        isDirty: true,
        updatedAt: new Date().toISOString(),
      };

      // Only update local state — DO NOT save to DB until "Save Changes" is clicked!
      setHighlights((prev) =>
        prev.map((h) => (h.slotNumber === slotNumber ? updatedSlot : h))
      );

      toast.info(`Photo selected for Slot #${slotNumber}. Click "Save Changes" below to commit to database.`);
    } catch (err) {
      console.error("Banner upload error:", err);
      toast.error("Failed to process image: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  const handleRemoveGlobalImage = (slotNumber) => {
    const target = highlights.find((h) => h.slotNumber === slotNumber) || { slotNumber };
    const updated = { ...target, imageUrl: "", isDirty: true };
    setHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? updated : h))
    );
    toast.info(`Photo removed for Slot #${slotNumber}. Click "Save Changes" below to save.`);
  };

  // --- SOCIETY SPECIFIC HIGHLIGHT HANDLERS ---
  const handleToggleSocietyActive = async (slotNumber) => {
    if (!selectedSocietyId) return;
    const target = societyHighlights.find((h) => h.slotNumber === slotNumber);
    if (!target) return;
    const next = !target.isActive;
    const updated = { ...target, isActive: next };

    setSocietyHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? updated : h))
    );

    if (isFirebaseConfigured) {
      try {
        await saveSocietyHighlightSlot(selectedSocietyId, slotNumber, updated);
        toast.success(`Slot #${slotNumber} for "${activeSociety?.name || 'Society'}" is now ${next ? "ACTIVE" : "INACTIVE"} on Customer App.`);
      } catch (err) {
        console.error("Society highlight toggle error:", err);
        toast.error("Failed to update status: " + err.message);
      }
    }
  };

  const handleSaveSocietySlot = async (slotNumber) => {
    if (!selectedSocietyId) {
      toast.error("Please select a society first.");
      return;
    }

    const target = societyHighlights.find((h) => h.slotNumber === slotNumber);
    if (!target) return;

    setSavingSocietySlot(slotNumber);
    if (isFirebaseConfigured) {
      try {
        await saveSocietyHighlightSlot(selectedSocietyId, slotNumber, target);
        setSocietyHighlights((prev) =>
          prev.map((h) => (h.slotNumber === slotNumber ? { ...h, isDirty: false } : h))
        );
        toast.success(`Slot #${slotNumber} for "${activeSociety?.name}" saved to Firestore! Status: ${target.isActive ? "ACTIVE (Live)" : "INACTIVE"}`);
      } catch (err) {
        toast.error("Failed to save society slot: " + err.message);
      } finally {
        setSavingSocietySlot(null);
      }
    } else {
      setTimeout(() => {
        setSocietyHighlights((prev) =>
          prev.map((h) => (h.slotNumber === slotNumber ? { ...h, isDirty: false } : h))
        );
        setSavingSocietySlot(null);
        toast.success(`Slot #${slotNumber} saved.`);
      }, 300);
    }
  };

  const handleUpdateSocietyText = (slotNumber, field, value) => {
    setSocietyHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? { ...h, [field]: value, isDirty: true } : h))
    );
  };

  const handleSocietyImageFileSelect = async (slotNumber, e) => {
    if (!selectedSocietyId) {
      toast.error("Please select a society first.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image file size exceeds the 15 MB limit.");
      return;
    }

    try {
      const dataUrl = await compressBanner(file);
      const target = societyHighlights.find((h) => h.slotNumber === slotNumber) || { slotNumber };
      const updatedSlot = {
        ...target,
        slotNumber,
        societyId: selectedSocietyId,
        imageUrl: dataUrl,
        isActive: true, // Automatically set switch to Active so user sees it will be active on save
        isDirty: true,
        updatedAt: new Date().toISOString(),
      };

      // Only update local state — DO NOT save to DB until "Save Changes" is clicked!
      setSocietyHighlights((prev) =>
        prev.map((h) => (h.slotNumber === slotNumber ? updatedSlot : h))
      );

      toast.info(`Photo selected for Slot #${slotNumber}. Click "Save Changes" below to commit to database.`);
    } catch (err) {
      console.error("Society banner upload error:", err);
      toast.error("Failed to process image: " + err.message);
    } finally {
      e.target.value = "";
    }
  };

  const handleRemoveSocietyImage = (slotNumber) => {
    if (!selectedSocietyId) return;
    const target = societyHighlights.find((h) => h.slotNumber === slotNumber) || { slotNumber };
    const updated = { ...target, imageUrl: "", isDirty: true };
    setSocietyHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? updated : h))
    );
    toast.info(`Photo removed for Slot #${slotNumber}. Click "Save Changes" below to save.`);
  };

  // Active highlights list for mobile preview based on selected scope
  const activePreviewList = activeScopeTab === "society" && selectedSocietyId
    ? societyHighlights
    : highlights;

  return (
    <Shell
      title="Customer App Highlights"
      subtitle="Manage promotional banners displayed on the Customer Mobile App home carousel (Global & Society-targeted)."
      headerAction={
        <Button
          onClick={() => setPreviewCarouselOpen(true)}
          variant="outline"
          className="gap-2 rounded-xl"
        >
          <Smartphone className="size-4 text-primary" />
          <span>Preview Mobile Slider</span>
        </Button>
      }
    >
      {/* Top Scope Tabs: Global | Society Specific */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-2xl border border-border/60">
          <button
            type="button"
            onClick={() => setActiveScopeTab("global")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeScopeTab === "global"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Globe className="size-4" />
            <span>Global Highlights</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveScopeTab("society")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeScopeTab === "society"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Building2 className="size-4" />
            <span>Society Specific Highlights</span>
          </button>
        </div>
      </div>

      {/* ======================= TAB 1: GLOBAL HIGHLIGHTS ======================= */}
      {activeScopeTab === "global" && (
        <div className="space-y-6">
          {/* Information Banner (BRD p. 21) */}
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Globe className="size-4.5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-foreground">
                  Global Customer Home Slider Configuration
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  These 4 banners cycle globally for all customers across all societies. Recommended ratio: 2:1 (1080 x 540 px).
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-semibold shrink-0">
              Max File Size: 15 MB
            </Badge>
          </div>

          {/* 4 Image Slots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {highlights.map((slot) => (
              <Card key={slot.slotNumber} className="border-border overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                <CardHeader className="p-4 pb-3 border-b border-border/70 bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge className="bg-primary text-primary-foreground font-bold text-xs py-0.5 px-2">
                        Slot #{slot.slotNumber}
                      </Badge>
                      <CardTitle className="text-sm font-bold truncate text-foreground">
                        {slot.title || `Global Banner ${slot.slotNumber}`}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-muted-foreground">Active</span>
                      <Switch
                        checked={slot.isActive}
                        onCheckedChange={() => handleToggleGlobalActive(slot.slotNumber)}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Image Preview Box — 2:1 Aspect Ratio (1080 x 540) */}
                  <div className="relative aspect-[2/1] w-full rounded-xl overflow-hidden border border-border bg-muted/60 flex items-center justify-center group shrink-0 shadow-inner">
                    {slot.imageUrl ? (
                      <>
                        <img
                          src={slot.imageUrl}
                          alt={slot.title}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-102"
                        />
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleGlobalImageFileSelect(slot.slotNumber, e)}
                            />
                            <Button type="button" size="sm" variant="secondary" className="h-8 text-xs px-3 gap-1.5 pointer-events-none shadow-sm">
                              <Upload className="size-3.5" />
                              <span>Change Photo</span>
                            </Button>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveGlobalImage(slot.slotNumber)}
                            className="h-8 text-xs px-3 gap-1.5 shadow-sm"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Clear</span>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <label className="flex flex-col items-center justify-center size-full cursor-pointer hover:bg-muted/80 transition-colors p-4 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleGlobalImageFileSelect(slot.slotNumber, e)}
                        />
                        <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 shadow-2xs">
                          <Upload className="size-5" />
                        </div>
                        <span className="text-sm font-bold text-foreground">Upload Promotional Banner</span>
                        <span className="text-xs text-muted-foreground mt-1">Recommended: 1080 x 540 px (PNG, JPG, WebP)</span>
                      </label>
                    )}
                  </div>

                  {/* Text Fields */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`global-title-${slot.slotNumber}`} className="text-xs font-semibold text-muted-foreground">Banner Title</Label>
                      <Input
                        id={`global-title-${slot.slotNumber}`}
                        placeholder="e.g. Fresh Homemade Breakfast"
                        value={slot.title}
                        onChange={(e) => handleUpdateGlobalText(slot.slotNumber, "title", e.target.value)}
                        className="h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`global-sub-${slot.slotNumber}`} className="text-xs font-semibold text-muted-foreground">Subtitle / Promotional Caption</Label>
                      <Input
                        id={`global-sub-${slot.slotNumber}`}
                        placeholder="e.g. Crafted with mother's touch & daily fresh ingredients"
                        value={slot.subtitle}
                        onChange={(e) => handleUpdateGlobalText(slot.slotNumber, "subtitle", e.target.value)}
                        className="h-9 text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Save Slot Button */}
                  <div className="pt-2">
                    <Button
                      size="default"
                      variant={slot.isDirty ? "default" : "outline"}
                      disabled={savingSlot === slot.slotNumber}
                      onClick={() => handleSaveGlobalSlot(slot.slotNumber)}
                      className={`h-9 text-xs font-bold px-3 gap-2 rounded-xl cursor-pointer w-full justify-center transition-all shadow-2xs ${
                        slot.isDirty
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                          : "hover:border-primary hover:text-primary"
                      }`}
                    >
                      <Save className="size-3.5" />
                      <span>
                        {savingSlot === slot.slotNumber
                          ? "Saving Slot..."
                          : slot.isDirty
                          ? "Save Changes *"
                          : "Save Banner Changes"}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ======================= TAB 2: SOCIETY SPECIFIC HIGHLIGHTS ======================= */}
      {activeScopeTab === "society" && (
        <div className="space-y-6">
          {/* Cascading Filter Bar: City -> Area -> Society */}
          <Card className="border-border shadow-xs bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Filter className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">Select Society to Manage Highlights</CardTitle>
                  <CardDescription className="text-xs">
                    Choose a society from the dropdown below to view, edit, or configure its 4 promotional highlight banners.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. City Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">1. City</Label>
                  <Select value={selectedCity} onValueChange={handleCityChange}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {availableCities.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Area Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">2. Area</Label>
                  <Select value={selectedArea} onValueChange={handleAreaChange}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {availableAreas.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 3. Target Society Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-primary">3. Target Society *</Label>
                  <Select
                    value={selectedSocietyId || "none"}
                    onValueChange={(val) => {
                      if (val !== "none") handleSocietyChange(val);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs border-primary/40 bg-primary/5 font-semibold">
                      <SelectValue placeholder="-- Choose Society --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" disabled>
                        -- Choose Society ({availableSocieties.length} available) --
                      </SelectItem>
                      
                      {/* Group 1: Societies that currently have configured highlights */}
                      {configuredSocieties.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Configured Society Highlights</SelectLabel>
                          {configuredSocieties.map((s) => {
                            const slots = configuredSocietiesMap[s.id] || [];
                            const liveCount = slots.filter((x) => x.isActive).length;
                            return (
                              <SelectItem key={s.id} value={s.id} className="font-semibold text-primary">
                                ⭐ {s.name} ({s.area || s.city}) — {liveCount}/4 Live
                              </SelectItem>
                            );
                          })}
                        </SelectGroup>
                      )}

                      {/* Group 2: All Other Societies */}
                      <SelectGroup>
                        {configuredSocieties.length > 0 && (
                          <SelectLabel>All Other Societies</SelectLabel>
                        )}
                        {otherSocieties.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.area || s.city})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conditional Display: Prompt when none selected, or Slot Cards when selected */}
          {!selectedSocietyId ? (
            <Card className="border-dashed border-2 border-border/80 bg-muted/20 py-12 text-center">
              <CardContent className="flex flex-col items-center justify-center space-y-3">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
                  <Building2 className="size-7" />
                </div>
                <div className="space-y-1 max-w-md">
                  <h3 className="text-sm sm:text-base font-bold text-foreground">
                    Select a Society to Manage Highlights
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Choose any society from the dropdown above to view, edit, or configure its 4 promotional highlight banners.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Active Society Header Banner */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 className="size-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground">
                        Managing Highlights for: {activeSociety?.name}
                      </h4>
                      <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                        Society Active
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Located in {activeSociety?.area}, {activeSociety?.city}. Residents of this society will see these 4 banners in their home carousel.
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="text-[11px] font-semibold shrink-0">
                  Ratio: 2:1 (1080 x 540 px)
                </Badge>
              </div>

              {/* 4 Society Image Slots Grid with full managing options */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {societyHighlights.map((slot) => (
                  <Card key={slot.slotNumber} className="border-border overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 pb-3 border-b border-border/70 bg-card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge className="bg-primary text-primary-foreground font-bold text-xs py-0.5 px-2">
                            Slot #{slot.slotNumber}
                          </Badge>
                          <CardTitle className="text-sm font-bold truncate text-foreground">
                            {slot.title || `Society Banner ${slot.slotNumber}`}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-muted-foreground">Active</span>
                          <Switch
                            checked={slot.isActive}
                            onCheckedChange={() => handleToggleSocietyActive(slot.slotNumber)}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col justify-between">
                      {/* Image Preview Box — 2:1 Aspect Ratio (1080 x 540) */}
                      <div className="relative aspect-[2/1] w-full rounded-xl overflow-hidden border border-border bg-muted/60 flex items-center justify-center group shrink-0 shadow-inner">
                        {slot.imageUrl ? (
                          <>
                            <img
                              src={slot.imageUrl}
                              alt={slot.title}
                              className="size-full object-cover transition-transform duration-300 group-hover:scale-102"
                            />
                            <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleSocietyImageFileSelect(slot.slotNumber, e)}
                                />
                                <Button type="button" size="sm" variant="secondary" className="h-8 text-xs px-3 gap-1.5 pointer-events-none shadow-sm">
                                  <Upload className="size-3.5" />
                                  <span>Change Photo</span>
                                </Button>
                              </label>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveSocietyImage(slot.slotNumber)}
                                className="h-8 text-xs px-3 gap-1.5 shadow-sm"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Clear</span>
                              </Button>
                            </div>
                          </>
                        ) : (
                          <label className="flex flex-col items-center justify-center size-full cursor-pointer hover:bg-muted/80 transition-colors p-4 text-center">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleSocietyImageFileSelect(slot.slotNumber, e)}
                            />
                            <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2 shadow-2xs">
                              <Upload className="size-5" />
                            </div>
                            <span className="text-sm font-bold text-foreground">Upload Society Banner</span>
                            <span className="text-xs text-muted-foreground mt-1">Recommended: 1080 x 540 px (PNG, JPG, WebP)</span>
                          </label>
                        )}
                      </div>

                      {/* Text Fields */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor={`soc-title-${slot.slotNumber}`} className="text-xs font-semibold text-muted-foreground">Banner Title</Label>
                          <Input
                            id={`soc-title-${slot.slotNumber}`}
                            placeholder="e.g. Society Special Festival Offer"
                            value={slot.title}
                            onChange={(e) => handleUpdateSocietyText(slot.slotNumber, "title", e.target.value)}
                            className="h-9 text-xs sm:text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`soc-sub-${slot.slotNumber}`} className="text-xs font-semibold text-muted-foreground">Subtitle / Promotional Caption</Label>
                          <Input
                            id={`soc-sub-${slot.slotNumber}`}
                            placeholder="e.g. Exclusive homemade delicacies from your neighbors"
                            value={slot.subtitle}
                            onChange={(e) => handleUpdateSocietyText(slot.slotNumber, "subtitle", e.target.value)}
                            className="h-9 text-xs sm:text-sm"
                          />
                        </div>
                      </div>

                      {/* Save Slot Button */}
                      <div className="pt-2">
                        <Button
                          size="default"
                          variant={slot.isDirty ? "default" : "outline"}
                          disabled={savingSocietySlot === slot.slotNumber}
                          onClick={() => handleSaveSocietySlot(slot.slotNumber)}
                          className={`h-9 text-xs font-bold px-3 gap-2 rounded-xl cursor-pointer w-full justify-center transition-all shadow-2xs ${
                            slot.isDirty
                              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                              : "hover:border-primary hover:text-primary"
                          }`}
                        >
                          <Save className="size-3.5" />
                          <span>
                            {savingSocietySlot === slot.slotNumber
                              ? "Saving Slot..."
                              : slot.isDirty
                              ? "Save Changes *"
                              : "Save Banner Changes"}
                          </span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer Mobile App Preview Modal */}
      <Dialog open={previewCarouselOpen} onOpenChange={setPreviewCarouselOpen}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Smartphone className="size-4 text-primary" />
              <span>
                {activeScopeTab === "society" && activeSociety
                  ? `Customer App: ${activeSociety.name}`
                  : "Customer App: Global Carousel"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preview of how active promotional banners render on the customer home screen.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="rounded-2xl border-4 border-slate-800 bg-background overflow-hidden shadow-xl">
              {/* Fake status bar */}
              <div className="h-6 bg-slate-900 text-white flex items-center justify-between px-4 text-[10px]">
                <span>9:41</span>
                <span>5G</span>
              </div>

              {/* Mobile Home Carousel Frame */}
              <div className="p-3 bg-muted/30">
                <div className="relative aspect-[2/1] rounded-xl overflow-hidden shadow-sm">
                  <img
                    src={
                      activePreviewList[activeSlideIndex]?.imageUrl ||
                      "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1080&h=540&q=80"
                    }
                    alt="Slider Preview"
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-2.5 text-white">
                    <span className="text-[11px] font-bold leading-tight line-clamp-1">
                      {activePreviewList[activeSlideIndex]?.title || "Promotional Title"}
                    </span>
                    <span className="text-[9px] text-white/80 line-clamp-1 mt-0.5">
                      {activePreviewList[activeSlideIndex]?.subtitle || "Promotional subtitle caption"}
                    </span>
                  </div>
                </div>

                {/* Dot Indicators */}
                <div className="flex items-center justify-center gap-1.5 mt-2.5">
                  {activePreviewList.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSlideIndex(i)}
                      className={`size-2 rounded-full transition-all cursor-pointer ${
                        activeSlideIndex === i ? "bg-primary w-5" : "bg-muted-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="p-3 text-center text-xs text-muted-foreground bg-card">
                Slide {activeSlideIndex + 1} of 4 •{" "}
                {activePreviewList[activeSlideIndex]?.isActive ? (
                  <span className="text-primary font-semibold">Live</span>
                ) : (
                  <span className="text-muted-foreground">Inactive</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewCarouselOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
