"use client";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { useState, useEffect } from "react";
import ResultCard from "@/components/ResultCard";
import MapView from "@/components/MapView";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Search,
  Sparkles,
  AlertCircle,
  MapPin,
  Bell,
  ArrowRight,
  List,
  Map,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "@/components/ImageUpload";
import ScrollAnimation from "@/components/ScrollAnimation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SearchResult {
  id: string;
  image_urls: string[];
  auto_title: string;
  auto_description: string;
  location: string;
  created_at: string;
  tags: string[];
  similarity: number;
  distance?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export default function LostPage() {
  const { toast } = useToast();

  // Search State
  const [description, setDescription] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchCoordinates, setSearchCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<string>("any");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  // View Mode State
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Alert State
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [contactInfo, setContactInfo] = useState("");
  const [alertImages, setAlertImages] = useState<File[]>([]);
  const [alertCoordinates, setAlertCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Claim State
  const [claimStatus, setClaimStatus] = useState<{
    [key: string]: "success" | "error" | null;
  }>({});

  // Get user's current location when switching to map view
  useEffect(() => {
    if (viewMode === "map" && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Error getting location:", error);
        }
      );
    }
  }, [viewMode, userLocation]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setResults([]);

    const trimmedDescription = description.trim();

    if (!trimmedDescription) {
      toast({
        title: "Missing Description",
        description: "Please describe your lost item",
        variant: "destructive",
      });
      return;
    }

    // Security: Validate minimum length on frontend
    if (trimmedDescription.length < 5) {
      toast({
        title: "Description Too Short",
        description:
          "Please provide at least 5 characters with more details about your lost item.",
        variant: "destructive",
      });
      return;
    }

    if (alertEnabled && !contactInfo.trim()) {
      toast({
        title: "Missing Contact Information",
        description: "Please provide your contact info to enable alerts",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);

    try {
      // 1. Perform search
      const searchResponse = await fetch("/api/search-lost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description,
          location: searchLocation,
          latitude: searchCoordinates?.lat,
          longitude: searchCoordinates?.lng,
          radiusMiles: radiusMiles === "any" ? null : parseFloat(radiusMiles),
        }),
      });

      const searchData = await searchResponse.json();

      if (!searchResponse.ok) {
        throw new Error(searchData.error || "Search failed");
      }

      setResults(searchData.results || []);

      // 2. If alert is enabled, create a lost item report
      if (alertEnabled && contactInfo.trim()) {
        try {
          const formData = new FormData();
          formData.append("description", description);
          formData.append("location", searchLocation);
          formData.append("contact_info", contactInfo);
          formData.append("alert_enabled", "true");
          if (alertCoordinates) {
            formData.append("latitude", alertCoordinates.lat.toString());
            formData.append("longitude", alertCoordinates.lng.toString());
          }

          alertImages.forEach((image) => {
            formData.append("images", image);
          });

          const alertResponse = await fetch("/api/report-lost", {
            method: "POST",
            body: formData,
          });

          if (alertResponse.ok) {
            const alertData = await alertResponse.json();
            const notificationUrl = alertData.notificationUrl;

            if (notificationUrl) {
              const fullUrl = `${window.location.origin}${notificationUrl}`;
              navigator.clipboard.writeText(fullUrl).catch(() => {});

              toast({
                title: "Alert Set! 🔔",
                description: `We'll notify you if someone finds a matching item. Your notification link has been copied to clipboard - save it to check for matches!`,
                duration: 10000,
              });
            } else {
              toast({
                title: "Alert Set! 🔔",
                description:
                  "We'll notify you if someone finds a matching item.",
              });
            }
          }
        } catch (alertErr) {
          console.error("Failed to set alert:", alertErr);
        }
      }

      if (searchData.results?.length === 0) {
        toast({
          title: alertEnabled
            ? "No Matches Found - Alert Set"
            : "No Matches Found",
          description: alertEnabled
            ? "We'll notify you if a matching item is found."
            : "Try a more detailed description or enable alerts to get notified.",
          variant: "default",
        });
      } else {
        toast({
          title: "Search Complete",
          description: `Found ${
            searchData.results?.length || 0
          } potential match${searchData.results?.length !== 1 ? "es" : ""}${
            alertEnabled ? " - Alert also set!" : ""
          }`,
        });
      }
    } catch (err) {
      toast({
        title: "Search Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleClaim = async (itemId: string, claimerContact: string) => {
    try {
      const response = await fetch("/api/claim-item", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId,
          claimerContact,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Claim failed");
      }

      setClaimStatus({ ...claimStatus, [itemId]: "success" });
      toast({
        title: "Item Claimed!",
        description: `Contact the finder at: ${data.finderContact}`,
        duration: 999999999, // Persistent - requires manual dismissal
      });
    } catch (err) {
      setClaimStatus({ ...claimStatus, [itemId]: "error" });
      toast({
        title: "Claim Failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen py-8 sm:py-12 md:py-24">
      <div className="container max-w-4xl px-4 sm:px-6">
        {/* Header */}
        <ScrollAnimation>
          <div className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Search for Lost Item
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Describe what you lost and our AI will find matches
            </p>
          </div>
        </ScrollAnimation>

        {/* Search Form */}
        <ScrollAnimation delay={100}>
          <Card className="border bg-card mb-8 sm:mb-12 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl">Search Description</CardTitle>
              <CardDescription>
                Be as detailed as possible. Our AI will match your description
                to found items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="description">Describe Your Lost Item</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., A black leather wallet with a red stripe, containing a driver's license..."
                    rows={5}
                    className="resize-none bg-background border-border"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-location">
                    Location Lost (Optional)
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <LocationAutocomplete
                      value={searchLocation}
                      onChange={setSearchLocation}
                      onSelectCoordinates={(coords) => {
                        setSearchCoordinates(coords);
                        if (alertEnabled) {
                          setAlertCoordinates(coords);
                        }
                      }}
                    />
                  </div>
                </div>

                {searchCoordinates && (
                  <div className="space-y-2">
                    <Label htmlFor="radius">Search Within</Label>
                    <Select value={radiusMiles} onValueChange={setRadiusMiles}>
                      <SelectTrigger
                        id="radius"
                        className="bg-background border-border"
                      >
                        <SelectValue placeholder="Select radius" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any distance</SelectItem>
                        <SelectItem value="1">1 mile</SelectItem>
                        <SelectItem value="5">5 miles</SelectItem>
                        <SelectItem value="10">10 miles</SelectItem>
                        <SelectItem value="25">25 miles</SelectItem>
                        <SelectItem value="50">50 miles</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Filter results to items found within the selected radius
                    </p>
                  </div>
                )}

                {/* Alert Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="alert-toggle"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Bell className="h-4 w-4" />
                      Alert me if found
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified automatically when someone finds a matching
                      item
                    </p>
                  </div>
                  <Switch
                    id="alert-toggle"
                    checked={alertEnabled}
                    onCheckedChange={setAlertEnabled}
                  />
                </div>

                {/* Conditional fields when alert is enabled */}
                {alertEnabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                    <div className="space-y-2">
                      <Label htmlFor="contact">Contact Email/Phone *</Label>
                      <Input
                        id="contact"
                        placeholder="email@example.com or phone number"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        className="bg-background border-border"
                        required={alertEnabled}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="alert-images">Images (Optional)</Label>
                      <ImageUpload
                        onImageSelect={(files) => setAlertImages(files)}
                        currentImages={alertImages.map((file) =>
                          URL.createObjectURL(file)
                        )}
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSearching}
                  size="lg"
                  className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isSearching ? (
                    <>
                      <Search className="mr-2 h-4 w-4 animate-pulse" />
                      Searching with AI...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                      Search for Matches
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </ScrollAnimation>

        {/* Results */}
        {results.length > 0 && (
          <ScrollAnimation delay={200}>
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <h2 className="text-2xl sm:text-3xl font-bold">
                  {results.length} Potential Match
                  {results.length !== 1 ? "es" : ""} Found
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                    Ranked by similarity
                  </div>
                  {/* View Toggle */}
                  <div className="flex items-center gap-2 border rounded-lg p-1 bg-muted/30">
                    <Button
                      type="button"
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="gap-2"
                    >
                      <List className="h-4 w-4" />
                      List
                    </Button>
                    <Button
                      type="button"
                      variant={viewMode === "map" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("map")}
                      className="gap-2"
                    >
                      <Map className="h-4 w-4" />
                      Map
                    </Button>
                  </div>
                </div>
              </div>

              {/* List View */}
              {viewMode === "list" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {results.map((item, index) => (
                    <div
                      key={item.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <ResultCard
                        item={item}
                        onClaim={handleClaim}
                        distance={item.distance}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Map View */}
              {viewMode === "map" && (
                <>
                  {results.filter((r) => r.latitude && r.longitude).length ===
                    0 && (
                    <Card className="border bg-card mb-4">
                      <CardContent className="py-6">
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <MapPin className="h-5 w-5" />
                          <p className="text-sm">
                            No items with location coordinates found. Items need
                            GPS coordinates to appear on the map.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <MapView
                    items={(() => {
                      const mappedItems = results.map((item) => ({
                        id: item.id,
                        auto_title: item.auto_title,
                        auto_description: item.auto_description,
                        location: item.location,
                        latitude: item.latitude ?? null,
                        longitude: item.longitude ?? null,
                        image_urls: item.image_urls || [],
                        image_url: item.image_urls?.[0],
                        created_at: item.created_at,
                        distance: item.distance,
                      }));
                      console.log(
                        "LostPage: Passing items to MapView:",
                        mappedItems.length,
                        "items"
                      );
                      console.log(
                        "LostPage: Items with coords:",
                        mappedItems.filter((i) => i.latitude && i.longitude)
                          .length
                      );
                      mappedItems.forEach((item, idx) => {
                        console.log(`LostPage: Item ${idx + 1}:`, {
                          title: item.auto_title,
                          lat: item.latitude,
                          lng: item.longitude,
                          hasCoords: !!(item.latitude && item.longitude),
                        });
                      });
                      return mappedItems;
                    })()}
                    userLocation={userLocation}
                    height="600px"
                  />
                </>
              )}
            </div>
          </ScrollAnimation>
        )}

        {results.length === 0 && !isSearching && (
          <ScrollAnimation delay={300}>
            <Card className="border bg-card hover:border-primary/20 transition-colors duration-300">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                <div className="rounded-full bg-muted/50 p-6 mb-6">
                  <AlertCircle className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-3">
                  No search results yet
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
                  Enter a detailed description above and click search to find
                  matching items. Enable &quot;Alert me if found&quot; to get
                  notified when someone finds your item.
                </p>
              </CardContent>
            </Card>
          </ScrollAnimation>
        )}

        {/* Loading state during search */}
        {isSearching && (
          <ScrollAnimation delay={200}>
            <Card className="border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                <div className="relative mb-6">
                  <div className="h-16 w-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <Search className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  Searching with AI...
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Analyzing your description and matching it with found items
                </p>
              </CardContent>
            </Card>
          </ScrollAnimation>
        )}
      </div>
    </div>
  );
}
