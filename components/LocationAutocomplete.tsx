"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google: any;
  }
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectCoordinates?: (coords: { lat: number; lng: number }) => void;
}

export default function LocationAutocomplete({
  value,
  onChange,
  onSelectCoordinates,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    // Wait until Google Places is fully available
    const interval = setInterval(() => {
      if (window.google?.maps?.places && inputRef.current) {
        clearInterval(interval);

        if (!autocompleteRef.current) {
          autocompleteRef.current = new window.google.maps.places.Autocomplete(
            inputRef.current,
            {
              types: ["geocode"],
              componentRestrictions: { country: "us" },
            }
          );
        }

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();
          if (!place) return;

          // Set input text
          if (place.formatted_address) {
            onChange(place.formatted_address);
          }

          // Coordinates
          if (place.geometry?.location && onSelectCoordinates) {
            onSelectCoordinates({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            });
          }
        });
      }
    }, 100); // retry every 100ms until Google API loads

    return () => clearInterval(interval);
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter a location..."
      className="border rounded-lg p-2 w-full pl-9 bg-background text-foreground"
      autoComplete="off"
    />
  );
}