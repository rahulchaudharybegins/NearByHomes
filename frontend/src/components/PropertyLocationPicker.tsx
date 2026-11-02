
import { useCallback, useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapPin, ArrowLeft, LoaderCircle } from "lucide-react";

const propertyMarker = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type SelectedLocation = {
  address: string;
  latitude: number;
  longitude: number;
  locality: string;
  city: string;
};

type PropertyLocationPickerProps = {
  onConfirm: (location: SelectedLocation) => void;
  onCancel: () => void;
};

type MapClickHandlerProps = {
  onSelect: (latitude: number, longitude: number) => void;
};

function MapClickHandler({ onSelect }: MapClickHandlerProps) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function LocateUser({
  onLocate,
}: {
  onLocate: (latitude: number, longitude: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        map.flyTo([latitude, longitude], 15);
        onLocate(latitude, longitude);
      },
      () => {
        // Keep the default map view if location permission is denied.
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }, [map, onLocate]);

  return null;
}

export default function PropertyLocationPicker({
  onConfirm,
  onCancel,
}: PropertyLocationPickerProps) {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [locationError, setLocationError] = useState("");

  const selectLocation = useCallback((lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setAddress("");
    setLocality("");
    setCity("");
    setLocationError("");
  }, []);

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    let cancelled = false;

    async function fetchAddress() {
      setLoadingAddress(true);
      setLocationError("");

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          {
            headers: {
              "Accept-Language": "en",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Address lookup failed.");
        }

        const data = await response.json();

        if (cancelled) return;

        const parts = data.address ?? {};

        const detectedLocality =
          parts.neighbourhood ||
          parts.suburb ||
          parts.residential ||
          parts.quarter ||
          parts.village ||
          parts.town ||
          "";

        const detectedCity =
          parts.city ||
          parts.town ||
          parts.municipality ||
          parts.city_district ||
          parts.village ||
          "";

        setAddress(data.display_name || "");
        setLocality(detectedLocality);
        setCity(detectedCity);

        if (!data.display_name) {
          setLocationError(
            "No address was found. Try selecting another point."
          );
        }
      } catch {
        if (!cancelled) {
          setLocationError(
            "Could not retrieve the address. Please try again by selecting the location again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAddress(false);
        }
      }
    }

    fetchAddress();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={18} />
          Back to property form
        </button>

        <div className="flex items-center gap-3">
          <MapPin size={28} className="text-emerald-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Select Property Location
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Click the map or drag the marker to your property's location.
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            scrollWheelZoom
            className="h-[420px] w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <LocateUser onLocate={selectLocation} />
            <MapClickHandler onSelect={selectLocation} />

            {latitude !== null && longitude !== null && (
              <Marker
                position={[latitude, longitude]}
                icon={propertyMarker}
                draggable
                eventHandlers={{
                  dragend(event) {
                    const position = event.target.getLatLng();
                    selectLocation(position.lat, position.lng);
                  },
                }}
              />
            )}
          </MapContainer>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900">
            Selected location
          </h2>

          {loadingAddress ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <LoaderCircle size={16} className="animate-spin" />
              Finding address...
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-600">
              {address || "Click on the map to select a location."}
            </p>
          )}

          {locationError && (
            <p className="mt-3 text-sm text-red-600">
              {locationError}
            </p>
          )}

          {latitude !== null && longitude !== null && (
            <p className="mt-2 text-xs text-gray-500">
              Latitude: {latitude.toFixed(6)}, Longitude:{" "}
              {longitude.toFixed(6)}
            </p>
          )}

          <button
            type="button"
            disabled={
              !address.trim() ||
              latitude === null ||
              longitude === null ||
              loadingAddress
            }
            onClick={() => {
              if (latitude === null || longitude === null || !address.trim()) {
                return;
              }

              onConfirm({
                address,
                latitude,
                longitude,
                locality,
                city,
              });
            }}
            className="mt-5 w-full rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm Location
          </button>
        </div>
      </section>
    </main>
  );
}
