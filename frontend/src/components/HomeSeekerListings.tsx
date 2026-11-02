import { useEffect, useRef, useState, type MouseEvent } from "react";
import { supabase } from "../lib/supabase";
import HomeSeekerPropertyMap from "./HomeSeekerPropertyMap";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Property = {
  id: string;
  title: string;
  listing_type: "rent" | "sale";
  property_type: "apartment" | "independent_house" | "pg";
  bhk: number | null;
  price: number | string;
  address: string;
  locality: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  owner_phone: string | null;
  description: string | null;
  image_urls: string[] | null;
};

function PropertyPhotoCarousel({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-500">
        No photos available
      </div>
    );
  }

  const previousPhoto = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCurrentIndex((index) => (index - 1 + images.length) % images.length);
  };

  const nextPhoto = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setCurrentIndex((index) => (index + 1) % images.length);
  };

  return (
    <div className="relative mb-3 flex w-full items-center justify-center overflow-hidden rounded-lg bg-gray-50">
      <img
        src={images[currentIndex]}
        alt={`${title} — photo ${currentIndex + 1}`}
        loading="lazy"
        className="block h-auto max-h-[420px] w-full object-contain"
      />

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={previousPhoto}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white"
          >
            <ChevronLeft size={22} />
          </button>

          <button
            type="button"
            aria-label="Next photo"
            onClick={nextPhoto}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white"
          >
            <ChevronRight size={22} />
          </button>

          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
            {currentIndex + 1} / {images.length}
          </span>
        </>
      )}
    </div>
  );
}

type HomeSeekerListingsProps = {
  onBack: () => void;
  onShowResultsPage: () => void;
  onBackToFiltersPage: () => void;
};

async function getAddressFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: "jsonv2",
    addressdetails: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Unable to retrieve the address.");
  }

  const result = (await response.json()) as {
    display_name?: string;
  };

  if (!result.display_name) {
    throw new Error("No address was found for this location.");
  }

  return result.display_name;
}

async function getCoordinatesFromAddress(
  address: string
): Promise<{ latitude: number; longitude: number; displayName: string }> {
  const params = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Unable to search for this location. Please try again.");
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  if (results.length === 0) {
    throw new Error("Location not found. Try a more specific address.");
  }

  return {
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon),
    displayName: results[0].display_name,
  };
}

function getDistanceInKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const latitudeDifference = toRadians(latitude2 - latitude1);
  const longitudeDifference = toRadians(longitude2 - longitude1);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(latitude1)) *
      Math.cos(toRadians(latitude2)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    2 *
    earthRadiusKm *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
}

export default function HomeSeekerListings({
  onBack,
  onShowResultsPage,
  onBackToFiltersPage,
}: HomeSeekerListingsProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [signedImageUrls, setSignedImageUrls] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listingTypeFilter, setListingTypeFilter] = useState<
    "all" | "rent" | "sale"
  >("all");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<
    "all" | "apartment" | "independent_house" | "pg"
  >("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [localityFilter, setLocalityFilter] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showMapView, setShowMapView] = useState(false);
  const [selectedMapPropertyId, setSelectedMapPropertyId] =
    useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [favoritePropertyIds, setFavoritePropertyIds] = useState<string[]>([]);
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<string[]>([]);
  const [searchLocation, setSearchLocation] = useState("");
  const [searchCoordinates, setSearchCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem(
        "nearby-homes-search-coordinates"
      );

      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [searchRadius, setSearchRadius] = useState<3 | 5 | 7 | 10>(3);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const propertyCardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!selectedMapPropertyId) return;

    propertyCardRefs.current[selectedMapPropertyId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedMapPropertyId]);

  useEffect(() => {
    if (searchCoordinates) {
      sessionStorage.setItem(
        "nearby-homes-search-coordinates",
        JSON.stringify(searchCoordinates)
      );
    } else {
      sessionStorage.removeItem("nearby-homes-search-coordinates");
    }
  }, [searchCoordinates]);

  useEffect(() => {
    let active = true;

    async function loadPublishedProperties() {
      setLoading(true);
      setError("");

      try {
        const { data, error: queryError } = await supabase
          .from("properties")
          .select(
            "id, title, listing_type, property_type, bhk, price, address, locality, owner_phone, city, latitude, longitude, image_urls, description"
          )
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;

        if (active) {
          const loadedProperties = (data ?? []) as Property[];
          setProperties(loadedProperties);

          const imageEntries = await Promise.all(
            loadedProperties.map(async (property) => {
              const paths = property.image_urls ?? [];

              const results = await Promise.all(
                paths.map(async (path) => {
                  const { data: signedData, error: signedError } =
                    await supabase.storage
                      .from("property-images")
                      .createSignedUrl(path, 3600);

                  if (signedError) {
                    console.error(
                      `Unable to load an image for property ${property.id}:`,
                      signedError.message
                    );
                    return null;
                  }

                  return signedData.signedUrl;
                })
              );

              return [
                property.id,
                results.filter((url): url is string => url !== null),
              ] as const;
            })
          );

          if (active) {
            setSignedImageUrls(Object.fromEntries(imageEntries));
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load properties."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPublishedProperties();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error("Unable to get the current session:", sessionError);
        return;
      }

      const user = sessionData.session?.user;

      if (!user) {
        if (active) setFavoritePropertyIds([]);
        return;
      }

      const { data, error: favoritesError } = await supabase
        .from("favorites")
        .select("property_id")
        .eq("user_id", user.id);

      if (favoritesError) {
        console.error("Unable to load favorites:", favoritesError.message);
        return;
      }

      if (active) {
        setFavoritePropertyIds(
          (data ?? []).map((favorite) => favorite.property_id)
        );
      }
    }

    void loadFavorites();

    return () => {
      active = false;
    };
  }, []);

  function setLocationCoordinatesError(errorCode: number) {
    const message =
      errorCode === 1
        ? "Location permission was denied. Enter a workplace, college, landmark, or address instead."
        : errorCode === 3
          ? "Location detection timed out. Please try again or enter a location manually."
          : "Unable to detect your location. Please enter it manually.";

    setLocationMessage(message);
    setLocationLoading(false);
  }

  async function handleSearchLocation() {
    const query = searchLocation.trim();

    if (!query) {
      setLocationMessage("Enter a location to search.");
      return;
    }

    setLocationLoading(true);
    setLocationMessage("");

    try {
      const result = await getCoordinatesFromAddress(query);

      setSearchCoordinates({
        latitude: result.latitude,
        longitude: result.longitude,
      });

      setSearchLocation(result.displayName);
      setLocationMessage("Search location found successfully.");
    } catch (error) {
      setLocationMessage(
        error instanceof Error
          ? error.message
          : "Unable to find this location."
      );
    } finally {
      setLocationLoading(false);
    }
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationMessage(
        "Location access is not supported by this browser. Enter a location manually."
      );
      return;
    }

    setLocationLoading(true);
    setLocationMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setSearchCoordinates({ latitude, longitude });
        setLocationMessage("Getting your address...");

        try {
          const address = await getAddressFromCoordinates(
            latitude,
            longitude
          );

          setSearchLocation(address);
          setLocationMessage("Your current address was detected.");
        } catch (error) {
          console.error("Reverse geocoding failed:", error);

          setSearchLocation(
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          );
          setLocationMessage(
            "Coordinates detected, but the address could not be retrieved."
          );
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationCoordinatesError(error.code);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }

  const filteredProperties = properties.filter((property) => {
    const matchesListingType =
      listingTypeFilter === "all" ||
      property.listing_type === listingTypeFilter;

    const matchesPropertyType =
      propertyTypeFilter === "all" ||
      property.property_type === propertyTypeFilter;

    const matchesCity =
      cityFilter === "all" || property.city.trim() === cityFilter;

    const matchesLocality =
      localityFilter === "all" ||
      property.locality.trim() === localityFilter;

    const matchesMinPrice =
      minPrice === "" || Number(property.price) >= Number(minPrice);

    const matchesMaxPrice =
      maxPrice === "" || Number(property.price) <= Number(maxPrice);

    const matchesRadius =
      !searchCoordinates ||
      (typeof property.latitude === "number" &&
        typeof property.longitude === "number" &&
        getDistanceInKm(
          searchCoordinates.latitude,
          searchCoordinates.longitude,
          property.latitude,
          property.longitude
        ) <= searchRadius);

    return (
      matchesListingType &&
      matchesPropertyType &&
      matchesCity &&
      matchesLocality &&
      matchesMinPrice &&
      matchesMaxPrice &&
      matchesRadius
    );
  });

  return (
    <section className="w-full">
      {showResults ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setShowResults(false);
              onBackToFiltersPage();
            }}
            className="mb-5 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            ← Back to Filters
          </button>

          <h2 className="text-2xl font-extrabold text-gray-900">
            {selectedProperty ? "Property Details" : "Available Properties"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {selectedProperty
              ? "View the full information about this property."
              : "Properties matching your selected filters."}
          </p>

          {!selectedProperty && (
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowMapView(false)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  !showMapView
                    ? "bg-emerald-800 text-white"
                    : "border border-gray-300 text-gray-700"
                }`}
              >
                List View
              </button>

              <button
                type="button"
                onClick={() => setShowMapView(true)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  showMapView
                    ? "bg-emerald-800 text-white"
                    : "border border-gray-300 text-gray-700"
                }`}
              >
                Map View
              </button>
            </div>
          )}

          {loading && (
            <p role="status" className="mt-6 rounded-xl bg-gray-50 p-4 text-sm">
              Loading properties...
            </p>
          )}

          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
              {error}
            </p>
          )}

          {selectedProperty ? (
            <div className="mt-6 rounded-2xl border border-gray-200 p-6">
              <button
                type="button"
                onClick={() => setSelectedProperty(null)}
                className="mb-5 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
              >
                ← Back to Properties
              </button>
              {(signedImageUrls[selectedProperty.id]?.length ?? 0) > 0 && (
  <div className="mb-6">
    <div className="relative rounded-xl bg-gray-100">
      <img
        src={
          signedImageUrls[selectedProperty.id][
            selectedImageIndex %
              signedImageUrls[selectedProperty.id].length
          ]
        }
        alt={`${selectedProperty.title} - Image ${selectedImageIndex + 1}`}
        className="block h-auto max-h-[75vh] w-full object-contain"
      />

      {signedImageUrls[selectedProperty.id].length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={() =>
              setSelectedImageIndex((current) =>
                (current - 1 +
                  signedImageUrls[selectedProperty.id].length) %
                signedImageUrls[selectedProperty.id].length
              )
            }
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
          >
            &#8592;
          </button>

          <button
            type="button"
            aria-label="Next image"
            onClick={() =>
              setSelectedImageIndex((current) =>
                (current + 1) %
                signedImageUrls[selectedProperty.id].length
              )
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-black/80"
          >
            &#8594;
          </button>
        </>
      )}
    </div>

    <p className="mt-2 text-center text-sm text-gray-500">
      Image {selectedImageIndex %
        signedImageUrls[selectedProperty.id].length + 1}
      {" / "}
      {signedImageUrls[selectedProperty.id].length}
    </p>
  </div>
)}

              <h3 className="text-2xl font-extrabold text-gray-900">
                {selectedProperty.title}
              </h3>

              <p className="mt-3 text-lg font-bold text-emerald-800">
                ₹{Number(selectedProperty.price).toLocaleString("en-IN")}
                {selectedProperty.listing_type === "rent" ? " / month" : ""}
              </p>

              <div className="mt-5 space-y-4 text-sm text-gray-700">
                <p>
                  <span className="font-semibold">Listing type:</span>{" "}
                  {selectedProperty.listing_type === "rent" ? "For rent" : "For sale"}
                </p>

                <p>
                  <span className="font-semibold">Property type:</span>{" "}
                  {selectedProperty.property_type.replaceAll("_", " ")}
                </p>

                {selectedProperty.bhk !== null && (
                  <p>
                    <span className="font-semibold">BHK:</span>{" "}
                    {selectedProperty.bhk} BHK
                  </p>
                )}

                <p>
                  <span className="font-semibold">City:</span>{" "}
                  {selectedProperty.city}
                </p>

                <p>
                  <span className="font-semibold">Locality:</span>{" "}
                  {selectedProperty.locality}
                </p>

                <p>
                  <span className="font-semibold">Address:</span>{" "}
                  {selectedProperty.address}
                </p>
                <p>
                  <span className="font-semibold">Owner Phone:</span>{" "}
                  {selectedProperty.owner_phone || "Not provided"}
                </p>

                <div>
                  <p className="font-semibold">Description</p>
                  <p className="mt-2 whitespace-pre-wrap">
                    {selectedProperty.description || "No description provided."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {showMapView ? (
                <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
                  <div className="lg:col-span-2">
                    {selectedMapPropertyId ? (
                      (() => {
                        const property = filteredProperties.find(
                          (item) => item.id === selectedMapPropertyId
                        );

                        if (!property) {
                          return (
                            <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                              Select a property marker on the map to view its
                              details.
                            </div>
                          );
                        }

                        return (
                        <article
                          ref={(element) => {
                            propertyCardRefs.current[property.id] = element;
                          }}
                          className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm"
                        >
                          <PropertyPhotoCarousel
                            images={signedImageUrls[property.id] ?? []}
                            title={property.title}
                          />

                          <h4 className="mt-3 text-lg font-semibold text-gray-900">
                            {property.title}
                          </h4>

                          <p className="mt-1 font-bold text-emerald-800">
                            ₹{Number(property.price).toLocaleString("en-IN")}
                            {property.listing_type === "rent" ? "/month" : ""}
                          </p>

                          <p className="mt-1 text-sm text-gray-600">
                            {property.bhk ? `${property.bhk} BHK · ` : ""}
                            {property.locality}, {property.city}
                          </p>

                          <p className="mt-2 text-sm text-gray-500">
                            {property.address}
                          </p>

                          <p className="mt-3 text-sm text-gray-700">
                            <strong>Property type:</strong>{" "}
                            {property.property_type.replaceAll("_", " ")}
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                            <strong>Description:</strong>{" "}
                            {property.description || "No description provided."}
                          </p>

                          <p className="mt-2 text-sm text-gray-700">
                            <strong>Owner phone:</strong>{" "}
                            {property.owner_phone || "Not provided"}
                          </p>
                        </article>
                        );
                      })()
                    ) : (
                      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
                        <div>
                          <p className="font-medium text-gray-700">
                            No property selected
                          </p>
                          <p className="mt-2 text-sm">
                            Click a marker on the map to view property details
                            and photos here.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-3">
                    <HomeSeekerPropertyMap
                      properties={filteredProperties}
                      onPropertySelect={setSelectedMapPropertyId}
                    />
                    <p className="mt-3 text-sm text-gray-600">
                      Showing{" "}
                      {
                        filteredProperties.filter(
                          (property) =>
                            typeof property.latitude === "number" &&
                            typeof property.longitude === "number"
                        ).length
                      }{" "}
                      properties with map locations.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProperties.map((property) => (
                    <article
                      key={property.id}
                      className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                      <PropertyPhotoCarousel
                        images={signedImageUrls[property.id] ?? []}
                        title={property.title}
                      />

<h3 className="font-bold text-gray-900">
  {property.title}
</h3>

                      <p className="mt-2 text-sm text-gray-600">
                        {property.property_type.replaceAll("_", " ")}
                        {property.bhk ? ` · ${property.bhk} BHK` : ""}
                        {" · "}
                        {property.locality}, {property.city}
                      </p>

                      <p className="mt-3 text-lg font-extrabold text-gray-900">
                        ₹{Number(property.price).toLocaleString("en-IN")}
                        {property.listing_type === "rent" ? " / month" : ""}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImageIndex(0);
                            setSelectedProperty(property);
                          }}
                          className="rounded-lg border border-emerald-800 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                        >
                          View Details
                        </button>

                        <button
                          type="button"
                          disabled={favoriteLoadingIds.includes(property.id)}
                          onClick={async () => {
                            const { data: sessionData, error: sessionError } =
                              await supabase.auth.getSession();

                            if (sessionError) {
                              setError(
                                "Unable to check your sign-in status. Please try again."
                              );
                              return;
                            }

                            const user = sessionData.session?.user;

                            if (!user) {
                              setError("Please sign in to save favorite properties.");
                              return;
                            }

                            setFavoriteLoadingIds((previous) => [
                              ...previous,
                              property.id,
                            ]);
                            setError("");

                            try {
                              if (favoritePropertyIds.includes(property.id)) {
                                const { error: deleteError } = await supabase
                                  .from("favorites")
                                  .delete()
                                  .eq("user_id", user.id)
                                  .eq("property_id", property.id);

                                if (deleteError) throw deleteError;

                                setFavoritePropertyIds((previous) =>
                                  previous.filter((id) => id !== property.id)
                                );
                              } else {
                                const { error: insertError } = await supabase
                                  .from("favorites")
                                  .insert({
                                    user_id: user.id,
                                    property_id: property.id,
                                  });

                                if (insertError) throw insertError;

                                setFavoritePropertyIds((previous) =>
                                  previous.includes(property.id)
                                    ? previous
                                    : [...previous, property.id]
                                );
                              }
                            } catch (err) {
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Unable to update favorites. Please try again."
                              );
                            } finally {
                              setFavoriteLoadingIds((previous) =>
                                previous.filter((id) => id !== property.id)
                              );
                            }
                          }}
                          className="rounded-lg border border-rose-600 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {favoriteLoadingIds.includes(property.id)
                            ? "Saving..."
                            : favoritePropertyIds.includes(property.id)
                              ? "♥ Remove Favorite"
                              : "♡ Add to Favorites"}
                        </button>
                      </div>
                    </article>
                  ))}

                {filteredProperties.length === 0 && (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                    No properties match your filters. Try changing your search criteria.
                  </p>
                )}
              </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onBack}
            className="mb-6 text-sm font-semibold text-gray-600 hover:text-emerald-800"
          >
            ← Back to welcome
          </button>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-extrabold text-gray-900">
              Find a Home
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Set your preferences to find a suitable property.
            </p>

            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
              <h3 className="text-lg font-bold text-gray-900">
                Find homes near your destination
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                Choose your workplace, college, landmark, address, or current location.
              </p>

              <label
                htmlFor="search-location"
                className="mb-2 mt-4 block text-sm font-semibold text-gray-700"
              >
                Search location
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="search-location"
                  type="text"
                  value={searchLocation}
                  onChange={(event) => {
                    setSearchLocation(event.target.value);
                    setSearchCoordinates(null);
                    setLocationMessage("");
                  }}
                  placeholder="e.g. NIT Trichy or your workplace"
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />

                <button
                  type="button"
                  onClick={handleSearchLocation}
                  disabled={locationLoading}
                  className="rounded-xl border border-emerald-800 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-60"
                >
                  {locationLoading ? "Searching..." : "Find Location"}
                </button>

                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locationLoading}
                  className="rounded-xl bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
                >
                  {locationLoading ? "Detecting..." : "◎ Use My Location"}
                </button>
              </div>

              <label
                htmlFor="search-radius"
                className="mb-2 mt-5 block text-sm font-semibold text-gray-700"
              >
                Search radius
              </label>

              <select
                id="search-radius"
                value={searchRadius}
                onChange={(event) =>
                  setSearchRadius(Number(event.target.value) as 3 | 5 | 7 | 10)
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 sm:max-w-xs"
              >
                <option value={3}>Within 3 km (Default)</option>
                <option value={5}>Within 5 km</option>
                <option value={7}>Within 7 km</option>
                <option value={10}>Within 10 km</option>
              </select>

              {locationMessage && (
                <p role="status" className="mt-3 text-sm text-gray-700">
                  {locationMessage}
                </p>
              )}
            </div>

            <div className="mt-5">
              <label
                htmlFor="listing-type-filter"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Listing type
              </label>
              <select
                id="listing-type-filter"
                value={listingTypeFilter}
                onChange={(event) =>
                  setListingTypeFilter(
                    event.target.value as "all" | "rent" | "sale"
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">All properties</option>
                <option value="rent">For rent</option>
                <option value="sale">For sale</option>
              </select>
            </div>

            <div className="mt-4">
              <label
                htmlFor="property-type-filter"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Property type
              </label>
              <select
                id="property-type-filter"
                value={propertyTypeFilter}
                onChange={(event) =>
                  setPropertyTypeFilter(
                    event.target.value as
                      | "all"
                      | "apartment"
                      | "independent_house"
                      | "pg"
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">All property types</option>
                <option value="apartment">Apartment</option>
                <option value="independent_house">Independent house</option>
                <option value="pg">PG</option>
              </select>
            </div>

            <div className="mt-4">
              <label
                htmlFor="city-filter"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                City
              </label>
              <select
                id="city-filter"
                value={cityFilter}
                onChange={(event) => {
                  setCityFilter(event.target.value);
                  setLocalityFilter("all");
                }}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">All cities</option>
                {[...new Set(
                  properties
                    .map((property) => property.city.trim())
                    .filter(Boolean)
                )]
                  .sort((a, b) => a.localeCompare(b))
                  .map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-4">
              <label
                htmlFor="locality-filter"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Locality
              </label>
              <select
                id="locality-filter"
                value={localityFilter}
                onChange={(event) => setLocalityFilter(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="all">All localities</option>
                {[...new Set(
                  properties
                    .filter(
                      (property) =>
                        cityFilter === "all" ||
                        property.city.trim() === cityFilter
                    )
                    .map((property) => property.locality.trim())
                    .filter(Boolean)
                )]
                  .sort((a, b) => a.localeCompare(b))
                  .map((locality) => (
                    <option key={locality} value={locality}>
                      {locality}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="min-price"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Minimum price (₹)
                </label>
                <input
                  id="min-price"
                  type="number"
                  min="0"
                  step="any"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="max-price"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Maximum price (₹)
                </label>
                <input
                  id="max-price"
                  type="number"
                  min="0"
                  step="any"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            {loading && (
              <p role="status" className="mt-4 text-sm text-gray-500">
                Loading available filter options...
              </p>
            )}

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={loading || Boolean(error)}
              onClick={() => {
                setShowResults(true);
                onShowResultsPage();
              }}
              className="mt-6 w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Show Properties
            </button>
          </div>
        </>
      )}
    </section>
  );
}
