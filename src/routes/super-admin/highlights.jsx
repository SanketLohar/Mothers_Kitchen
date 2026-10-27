import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { subscribeToHighlights, saveHighlightSlot } from "@/services/highlightService";

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

export function HighlightsPage() {
  const [highlights, setHighlights] = useState(EMPTY_SLOTS);
  const [previewCarouselOpen, setPreviewCarouselOpen] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [savingSlot, setSavingSlot] = useState(null);

  useEffect(() => {
    const unsub = subscribeToHighlights((list) => {
      if (list && list.length) {
        setHighlights(list);
      }
    });
    return () => unsub();
  }, []);

  const handleToggleActive = async (slotNumber) => {
    const target = highlights.find((h) => h.slotNumber === slotNumber);
    const next = !target?.isActive;

    setHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? { ...h, isActive: next } : h))
    );

    if (isFirebaseConfigured && target) {
      try {
        await saveHighlightSlot(slotNumber, { ...target, isActive: next });
      } catch (err) {
        console.error("Highlight toggle error:", err);
      }
    }

    toast.success(`Highlight Slot ${slotNumber} is now ${next ? "ACTIVE" : "INACTIVE"} on Customer App.`);
  };

  const handleSaveSlot = async (slotNumber) => {
    const target = highlights.find((h) => h.slotNumber === slotNumber);
    if (!target) return;

    setSavingSlot(slotNumber);
    if (isFirebaseConfigured) {
      try {
        await saveHighlightSlot(slotNumber, target);
        toast.success(`Slot ${slotNumber} successfully saved to Firestore!`);
      } catch (err) {
        toast.error("Failed to save slot: " + err.message);
      } finally {
        setSavingSlot(null);
      }
    } else {
      setTimeout(() => {
        setSavingSlot(null);
        toast.success(`Slot ${slotNumber} saved.`);
      }, 300);
    }
  };

  const handleUpdateText = (slotNumber, field, value) => {
    setHighlights((prev) =>
      prev.map((h) => (h.slotNumber === slotNumber ? { ...h, [field]: value } : h))
    );
  };

  const handleImageFileSelect = (slotNumber, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size exceeds the maximum limit of 5 MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setHighlights((prev) =>
      prev.map((h) =>
        h.slotNumber === slotNumber ? { ...h, imageUrl: objectUrl, updatedAt: new Date().toISOString() } : h
      )
    );
    toast.success(`Image selected for Slot ${slotNumber}. (Ready for Firebase Storage upload)`);
  };

  const handleRemoveImage = (slotNumber) => {
    setHighlights((prev) =>
      prev.map((h) =>
        h.slotNumber === slotNumber
          ? { ...h, imageUrl: "", title: "", subtitle: "", isActive: false }
          : h
      )
    );
    toast.info(`Slot ${slotNumber} cleared.`);
  };

  return (
    <Shell
      title="Customer App Highlights"
      subtitle="Manage the 4 promotional banner images displayed on the Customer Mobile App home carousel."
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
      {/* Information Banner (BRD p. 21) */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              Customer Home Screen Slider Configuration
            </h4>
            <p className="text-xs text-muted-foreground">
              Exactly 4 banner images are cycled sequentially on customer app launch. Recommended aspect ratio: 2:1 (1080 x 540 px).
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-semibold shrink-0">
          Max File Size: 5 MB
        </Badge>
      </div>

      {/* 4 Image Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {highlights.map((slot) => (
          <Card key={slot.slotNumber} className="border-border overflow-hidden flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground font-bold text-xs">
                    Slot #{slot.slotNumber}
                  </Badge>
                  <CardTitle className="text-base font-bold">
                    {slot.title || `Promotional Banner ${slot.slotNumber}`}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Active</span>
                  <Switch
                    checked={slot.isActive}
                    onCheckedChange={() => handleToggleActive(slot.slotNumber)}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4 flex-1">
              {/* Image Preview Box */}
              <div className="relative aspect-[2/1] w-full rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center group">
                {slot.imageUrl ? (
                  <>
                    <img
                      src={slot.imageUrl}
                      alt={slot.title}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-102"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageFileSelect(slot.slotNumber, e)}
                        />
                        <Button type="button" size="sm" variant="secondary" className="gap-1.5 pointer-events-none">
                          <Upload className="size-3.5" />
                          <span>Change Image</span>
                        </Button>
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveImage(slot.slotNumber)}
                        className="gap-1.5"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Remove</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center size-full cursor-pointer hover:bg-muted/80 transition-colors p-4 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileSelect(slot.slotNumber, e)}
                    />
                    <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                      <Upload className="size-5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">Click to Upload Banner</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">PNG, JPG, WebP up to 5MB (1080x540)</span>
                  </label>
                )}
              </div>

              {/* Text Fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor={`title-${slot.slotNumber}`} className="text-xs">Banner Title</Label>
                  <Input
                    id={`title-${slot.slotNumber}`}
                    placeholder="e.g. Freshly Cooked Homemade Breakfast"
                    value={slot.title}
                    onChange={(e) => handleUpdateText(slot.slotNumber, "title", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`sub-${slot.slotNumber}`} className="text-xs">Subtitle / Promo Description</Label>
                  <Input
                    id={`sub-${slot.slotNumber}`}
                    placeholder="e.g. Pure ghee sweets crafted with mother's touch"
                    value={slot.subtitle}
                    onChange={(e) => handleUpdateText(slot.slotNumber, "subtitle", e.target.value)}
                  />
                </div>
              </div>

              {/* Save Slot Button */}
              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingSlot === slot.slotNumber}
                  onClick={() => handleSaveSlot(slot.slotNumber)}
                  className="gap-1.5 text-xs rounded-xl hover:bg-primary/5 hover:text-primary"
                >
                  <Save className="size-3.5" />
                  <span>{savingSlot === slot.slotNumber ? "Saving..." : "Save Slot"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customer Mobile App Preview Modal */}
      <Dialog open={previewCarouselOpen} onOpenChange={setPreviewCarouselOpen}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Smartphone className="size-4 text-primary" />
              <span>Customer Mobile App Carousel</span>
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
                    src={highlights[activeSlideIndex]?.imageUrl || "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=1080&h=540&q=80"}
                    alt="Slider Preview"
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-2.5 text-white">
                    <span className="text-[11px] font-bold leading-tight line-clamp-1">
                      {highlights[activeSlideIndex]?.title}
                    </span>
                    <span className="text-[9px] text-white/80 line-clamp-1 mt-0.5">
                      {highlights[activeSlideIndex]?.subtitle}
                    </span>
                  </div>
                </div>

                {/* Dot Indicators */}
                <div className="flex items-center justify-center gap-1.5 mt-2.5">
                  {highlights.map((_, i) => (
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
                Slide {activeSlideIndex + 1} of 4 • {highlights[activeSlideIndex]?.isActive ? "Live" : "Inactive"}
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
