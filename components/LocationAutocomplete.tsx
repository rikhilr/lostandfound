"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google: any;
  }
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelectCoordinates,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelectCoordinates?: (coords: { lat: number; lng: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autoRef = useRef<any>(null);
  //Inputs
  useEffect(() => {
    if (!window.google || !window.google.maps?.places) return;
    if (!inputRef.current) return;

    if (!autoRef.current) {
      autoRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        { types: ["geocode"], componentRestrictions: { country: "us" } }
      );
    }

    autoRef.current.addListener("place_changed", () => {
      const place = autoRef.current.getPlace();
      if (!place) return;

      if (place.formatted_address) onChange(place.formatted_address);

      if (place.geometry?.location && onSelectCoordinates) {
        onSelectCoordinates({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent form submission when Enter is pressed in the location input
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Enter a location..."
      className="border rounded-lg p-2 w-full pl-9 bg-background text-foreground"
    />
  );
}
