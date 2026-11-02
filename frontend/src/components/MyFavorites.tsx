
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
  image_urls: string[] | null;
  owner_phone: string | null;
  description: string | null;
};

type MyFavoritesProps = {
  onBack: () => void;
};

export default function MyFavorites({ onBack }: MyFavoritesProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [signedImageUrls, setSignedImageUrls] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      setLoading(true);
      setError(null);

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
          throw new Error("Please sign in to view your favorite properties.");
        }

        const { data: favorites, error: favoritesError } = await supabase
          .from("favorites")
          .select("property_id")
          .eq("user_id", user.id);

        if (favoritesError) throw favoritesError;

        const propertyIds = (favorites ?? []).map(
          (favorite) => favorite.property_id
        );

        if (propertyIds.length === 0) {
          if (active) setProperties([]);
          return;
        }

        const { data: propertyData, error: propertyError } = await supabase
          .from("properties")
          .select(
            "id, title, listing_type, property_type, bhk, price, address, locality, city, image_urls, owner_phone, description"
          )
          .in("id", propertyIds)
          .eq("is_published", true);

        if (propertyError) throw propertyError;

        const loadedProperties = (propertyData ?? []) as Property[];

        const imageEntries = await Promise.all(
          loadedProperties.map(async (property) => {
            const paths = property.image_urls ?? [];

            const results = await Promise.all(
              paths.map(async (path) => {
                const { data, error: imageError } = await supabase.storage
                  .from("property-images")
                  .createSignedUrl(path, 3600);

                if (imageError) {
                  console.error(
                    `Unable to load an image for ${property.id}:`,
                    imageError.message
                  );
                  return null;
                }

                return data.signedUrl;
              })
            );

            return [
              property.id,
              results.filter((url): url is string => url !== null),
            ] as const;
          })
        );

        if (active) {
          setProperties(loadedProperties);
          setSignedImageUrls(Object.fromEntries(imageEntries));
        }
      } catch (err) {
        console.error("Unable to load favorites:", err);

        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your favorite properties."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadFavorites();

    return () => {
      active = false;
    };
  }, []);

  async function handleRemoveFavorite(propertyId: string) {
    if (removingIds.includes(propertyId)) return;

    setRemovingIds((previous) => [...previous, propertyId]);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const user = sessionData.session?.user;

      if (!user) {
        throw new Error("Please sign in to manage your favorites.");
      }

      const { error: deleteError } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("property_id", propertyId);

      if (deleteError) throw deleteError;

      setProperties((previous) =>
        previous.filter((property) => property.id !== propertyId)
      );
    } catch (err) {
      console.error("Unable to remove favorite:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove this favorite. Please try again."
      );
    } finally {
      setRemovingIds((previous) =>
        previous.filter((id) => id !== propertyId)
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f8f5] px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1600px]">
        <header className="rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-7 text-white shadow-lg sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Nearby Homes
          </p>

          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            My Favorites <span aria-hidden="true">♥</span>
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50 sm:text-base">
            Your favorite places, collected in one place. Find the homes you
            love and revisit them whenever you're ready.
          </p>

          <button
            type="button"
            onClick={onBack}
            className="mt-6 rounded-xl bg-white px-5 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-50"
          >
            ← Back to Find a Home
          </button>
        </header>

        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                Your saved homes
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Keep the properties you're interested in close at hand.
              </p>
            </div>

            {!loading && !error && (
              <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">
                {properties.length}{" "}
                {properties.length === 1 ? "property" : "properties"}
              </span>
            )}
          </div>

          {loading ? (
            <div
              role="status"
              className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-600 shadow-sm"
            >
              Loading your favorite homes...
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
            >
              <p className="font-semibold text-red-700">{error}</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-emerald-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="text-5xl" aria-hidden="true">
                ♡
              </div>
              <h3 className="mt-4 text-xl font-bold text-gray-900">
                No favorite homes yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
                When you find a home you love, save it from Find a Home and
                it'll appear here.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-6 rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white transition hover:bg-emerald-900"
              >
                Explore Homes
              </button>
            </div>
          ) : selectedProperty ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
              <button
                type="button"
                onClick={() => {
                  setSelectedProperty(null);
                  setSelectedImageIndex(0);
                }}
                className="mb-6 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
              >
                ← Back to My Favorites
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
                            setSelectedImageIndex(
                              (current) =>
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
                    Image{" "}
                    {(selectedImageIndex %
                      signedImageUrls[selectedProperty.id].length) +
                      1}{" "}
                    / {signedImageUrls[selectedProperty.id].length}
                  </p>
                </div>
              )}

              <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
                {selectedProperty.title}
              </h2>

              <p className="mt-3 text-xl font-bold text-emerald-800">
                ₹{Number(selectedProperty.price).toLocaleString("en-IN")}
                {selectedProperty.listing_type === "rent" ? " / month" : ""}
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 text-sm text-gray-700 sm:grid-cols-2">
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
              </div>

              <div className="mt-6 border-t border-gray-100 pt-5">
                <h3 className="font-bold text-gray-900">Property description</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                  {selectedProperty.description || "No description provided."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {properties.map((property) => (
                <article
                  key={property.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative h-56 bg-gradient-to-br from-emerald-100 to-teal-50">
                    {signedImageUrls[property.id]?.[0] ? (
                      <img
                        src={signedImageUrls[property.id][0]}
                        alt={property.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-emerald-800">
                        <span className="text-4xl" aria-hidden="true">
                          ⌂
                        </span>
                        <span className="mt-2 text-sm font-medium">
                          No property image
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-900">
                      {property.title}
                    </h3>

                    <p className="mt-2 text-sm capitalize text-gray-600">
                      {property.property_type.replaceAll("_", " ")}
                      {property.bhk ? ` · ${property.bhk} BHK` : ""}
                    </p>

                    <p className="mt-2 text-sm text-gray-500">
                      {property.locality}, {property.city}
                    </p>

                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <p className="text-2xl font-extrabold text-emerald-900">
                        ₹{Number(property.price).toLocaleString("en-IN")}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {property.listing_type === "rent" ? "per month" : "sale price"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImageIndex(0);
                        setSelectedProperty(property);
                      }}
                      className="mt-4 w-full rounded-xl border border-emerald-800 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
                    >
                      View Details →
                    </button>

                    <button
                      type="button"
                      disabled={removingIds.includes(property.id)}
                      onClick={() => void handleRemoveFavorite(property.id)}
                      className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removingIds.includes(property.id)
                        ? "Removing..."
                        : "♥ Remove Favorite"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
