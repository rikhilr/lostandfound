/**
 * Geography utility functions for distance calculations and formatting
 * Uses the Haversine formula to calculate great-circle distances between two points
 */

/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param lat1 Latitude of first point in degrees
 * @param lng1 Longitude of first point in degrees
 * @param lat2 Latitude of second point in degrees
 * @param lng2 Longitude of second point in degrees
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Earth's radius in miles
  const R = 3958.8

  // Convert degrees to radians
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

/**
 * Convert miles to kilometers
 * @param miles Distance in miles
 * @returns Distance in kilometers
 */
export function milesToKm(miles: number): number {
  return miles * 1.60934
}

/**
 * Format distance as a human-readable string
 * @param miles Distance in miles
 * @param useKm If true, convert to kilometers; otherwise use miles
 * @returns Formatted string like "2.3 miles" or "3.7 km"
 */
export function formatDistance(miles: number, useKm: boolean = false): string {
  if (useKm) {
    const km = milesToKm(miles)
    if (km < 1) {
      return `${Math.round(km * 1000)} m away`
    }
    return `${km.toFixed(1)} km away`
  } else {
    if (miles < 0.1) {
      return `${Math.round(miles * 5280)} ft away`
    }
    return `${miles.toFixed(1)} miles away`
  }
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

