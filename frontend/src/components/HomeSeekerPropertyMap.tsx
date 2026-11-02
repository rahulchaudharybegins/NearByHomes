import {
  MapContainer,
  Marker,
  TileLayer,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

type MapProperty = {
  id: string;
  latitude: number | null;
  longitude: number | null;
};

type HomeSeekerPropertyMapProps = {
  properties: MapProperty[];
  onPropertySelect?: (propertyId: string) => void;
};

const propertyMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

export default function HomeSeekerPropertyMap({
  properties,
  onPropertySelect,
}: HomeSeekerPropertyMapProps) {
  const mappedProperties = properties.filter(
    (property) =>
      typeof property.latitude === "number" &&
      typeof property.longitude === "number"
  );

  const defaultCenter: [number, number] =
    mappedProperties.length > 0
      ? [
          mappedProperties[0].latitude as number,
          mappedProperties[0].longitude as number,
        ]
      : [20.5937, 78.9629];

  return (
    <div className="h-[70vh] min-h-[500px] w-full overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      {mappedProperties.length === 0 && (
        <p className="p-4 text-sm text-gray-600">
          No properties with saved map locations are available yet.
        </p>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={mappedProperties.length > 0 ? 12 : 5}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappedProperties.map((property) => (
          <Marker
            key={property.id}
            position={[
              property.latitude as number,
              property.longitude as number,
            ]}
            icon={propertyMarkerIcon}
            eventHandlers={{
              click: () => onPropertySelect?.(property.id),
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
