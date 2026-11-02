
import { ArrowLeft, Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";


type MyListingsProps = {
  onBack: () => void;
  onCreateListing: () => void;
  onEditDraft: (property: Property) => void;
  onPublishDraft: (property: Property) => Promise<boolean>;
  onDraftPublished: (propertyId: string) => void;
};

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
  description: string | null;
  owner_phone: string | null;
  image_urls: string[] | null;
  is_published: boolean;
  created_at: string;
};

async function deletePropertyImages(
  imagePaths: string[],
  ownerId: string,
  propertyId: string
) {
  if (imagePaths.length === 0) return;

  // Only allow paths belonging to this owner and property.
  const validPrefix = `${ownerId}/${propertyId}/`;

  const safePaths = imagePaths.filter((path) =>
    path.startsWith(validPrefix)
  );

  if (safePaths.length !== imagePaths.length) {
    throw new Error(
      "Image deletion stopped because a path does not match this property."
    );
  }

  const { error } = await supabase.storage
    .from("property-images")
    .remove(safePaths);

  if (error) {
    throw new Error(`Unable to delete property images: ${error.message}`);
  }
}

export default function MyListings({
  onBack,
  onCreateListing,
  onEditDraft,
  onPublishDraft,
  onDraftPublished,
 }: MyListingsProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleDraftPublished(propertyId: string) {
    setProperties((current) =>
      current.map((property) =>
        property.id === propertyId
          ? { ...property, is_published: true }
          : property
      )
    );

    onDraftPublished(propertyId);
  }

  async function publishDraft(property: Property) {
    try {
      const published = await onPublishDraft(property);

      if (published) handleDraftPublished(property.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to publish this draft."
      );
    }
  }

  async function deleteDraft(property: Property) {
    const confirmed = window.confirm(
      `Delete the draft "${property.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(property.id);
    setDeleteMessage("");
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        throw new Error("Please sign in to delete a draft.");
      }

      if (property.is_published) {
        throw new Error("Published listings cannot be deleted here.");
      }

      const { data, error: deleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", property.id)
        .eq("owner_id", session.user.id)
        .eq("is_published", false)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data || data.length === 0) {
        throw new Error(
          "Draft was not deleted. Check your permissions and refresh the page."
        );
      }

      try {
        await deletePropertyImages(
          property.image_urls ?? [],
          session.user.id,
          property.id
        );
      } catch (imageError) {
        console.error(
          "Draft deleted, but image cleanup failed:",
          imageError
        );

        setDeleteMessage(
          `Draft "${property.title}" was deleted, but some images may remain in Storage.`
        );
      }

      setProperties((current) =>
        current.filter((item) => item.id !== property.id)
      );

      if (!property.image_urls?.length) {
        setDeleteMessage(`Draft "${property.title}" was deleted.`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete this draft."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function deletePublishedListing(property: Property) {
    const confirmed = window.confirm(
      `Delete the published listing "${property.title}"? Home Seekers will no longer see it. This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(property.id);
    setDeleteMessage("");
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        throw new Error("Please sign in to delete this listing.");
      }

      if (!property.is_published) {
        throw new Error("This listing is not published.");
      }

      const { data, error: deleteError } = await supabase
        .from("properties")
        .delete()
        .eq("id", property.id)
        .eq("owner_id", session.user.id)
        .eq("is_published", true)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data || data.length === 0) {
        throw new Error(
          "Listing was not deleted. Check your permissions and refresh the page."
        );
      }

      try {
        await deletePropertyImages(
          property.image_urls ?? [],
          session.user.id,
          property.id
        );
      } catch (imageError) {
        console.error(
          "Published listing deleted, but image cleanup failed:",
          imageError
        );

        setDeleteMessage(
          `Published listing "${property.title}" was deleted, but some images may remain in Storage.`
        );
      }

      setProperties((current) =>
        current.filter((item) => item.id !== property.id)
      );

      if (!property.image_urls?.length) {
        setDeleteMessage(
          `Published listing "${property.title}" was deleted.`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete this published listing."
      );
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadProperties() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.user) {
          throw new Error("Please sign in to view your listings.");
        }

        const { data, error: queryError } = await supabase
          .from("properties")
          .select(
            "id, title, listing_type, property_type, bhk, price, address, locality, city, description, owner_phone, image_urls, is_published, created_at"
          )
          .eq("owner_id", session.user.id)
          .order("created_at", { ascending: false });

        if (queryError) throw queryError;

        if (active) setProperties((data ?? []) as Property[]);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your listings."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProperties();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="w-full overflow-y-auto pr-2">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-800"
      >
        <ArrowLeft size={18} />
        Back to welcome
      </button>

      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          <Building2 size={25} />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">
            My Listings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your property listings in one place.
          </p>
        </div>
      </div>

      <div className="mt-7 max-h-[60vh] space-y-4 overflow-y-auto pr-2">
        {loading && (
          <p role="status" className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
            Loading your listings...
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        )}

        {deleteMessage && (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            {deleteMessage}
          </p>
        )}

        {!loading && !error && properties.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center">
            <h3 className="font-bold text-gray-900">No listings yet</h3>
            <p className="mt-2 text-sm text-gray-600">
              Create your first property listing to see it here.
            </p>
          </div>
        )}

        {!loading && !error && properties.map((property) => (
          <article
            key={property.id}
            className="rounded-2xl border border-gray-200 bg-white p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900">{property.title}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {property.property_type === "pg"
                    ? "PG"
                    : property.property_type === "apartment"
                      ? "Apartment"
                      : "Independent house"}
                  {property.bhk ? ` · ${property.bhk} BHK` : ""}
                  {" · "}
                  {property.locality}, {property.city}
                </p>
              </div>

              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                property.is_published
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-amber-50 text-amber-800"
              }`}>
                {property.is_published ? "Published" : "Draft"}
              </span>
            </div>

            <p className="mt-4 text-lg font-extrabold text-gray-900">
              ₹{Number(property.price).toLocaleString("en-IN")}
              {property.listing_type === "rent" ? " / month" : ""}
            </p>

            <button
              type="button"
              onClick={() =>
                setExpandedId((current) =>
                  current === property.id ? null : property.id
                )
              }
              className="mt-4 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              {expandedId === property.id ? "Hide details" : "View details"}
            </button>

            {expandedId === property.id && (
              <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
                <p>
                  <strong>Full address:</strong> {property.address}
                </p>
                <p>
                  <strong>Locality:</strong> {property.locality}
                </p>
                <p>
                  <strong>City:</strong> {property.city}
                </p>
                <p>
                  <strong>Listing type:</strong>{" "}
                  {property.listing_type === "rent" ? "For Rent" : "For Sale"}
                </p>
                <p>
                  <strong>Property type:</strong>{" "}
                  {property.property_type.replaceAll("_", " ")}
                </p>
                {property.bhk !== null && (
                  <p>
                    <strong>BHK:</strong> {property.bhk}
                  </p>
                )}
                {property.owner_phone !== null && (
                  <p>
                    <strong>Owner Phone:</strong> {property.owner_phone}
                  </p>
                )}
                <p>
                  <strong>Description:</strong>{" "}
                  {property.description?.trim() || "No description provided."}
                </p>
              </div>
            )}

            {!property.is_published && (
              <button
                type="button"
                onClick={() => void publishDraft(property)}
                className="mt-4 mr-2 inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Publish
              </button>
            )}

            {!property.is_published && (
              <button
                type="button"
                onClick={() => onEditDraft(property)}
                className="mt-4 mr-2 inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                <Pencil size={16} />
                Edit draft
              </button>
            )}

            {!property.is_published && (
              <button
                type="button"
                disabled={deletingId === property.id}
                onClick={() => void deleteDraft(property)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={16} />
                {deletingId === property.id ? "Deleting..." : "Delete draft"}
              </button>
            )}

            {property.is_published && (
              <button
                type="button"
                disabled={deletingId === property.id}
                onClick={() => void deletePublishedListing(property)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={16} />
                {deletingId === property.id ? "Deleting..." : "Delete listing"}
              </button>
            )}
          </article>
        ))}

        <button
          type="button"
          onClick={onCreateListing}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white hover:bg-emerald-900"
        >
          <Plus size={18} />
          List a property
        </button>
      </div>
    </section>
  );
}
