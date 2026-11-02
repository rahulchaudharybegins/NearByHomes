import { supabase } from "../lib/supabase";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Home, IndianRupee, MapPin, CheckCircle2 } from "lucide-react";

type ListingType = "rent" | "sale";
type PropertyType = "apartment" | "independent_house" | "pg";

type PropertyFormData = {
  title: string;
  listingType: ListingType;
  propertyType: PropertyType;
  bhk: string;
  price: string;
  address: string;
  locality: string;
  city: string;
  latitude: string;
  longitude: string;
  description: string;
  ownerPhone: string;
};

type PropertyToEdit = {
  id: string;
  title: string;
  listing_type: ListingType;
  property_type: PropertyType;
  bhk: number | null;
  price: number | string;
  address: string;
  locality: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  owner_phone: string | null;
  image_urls: string[] | null;
};

type SelectedPropertyLocation = {
  address: string;
  latitude: number;
  longitude: number;
  locality: string;
  city: string;
};

type PropertyListingFormProps = {
  propertyToEdit?: PropertyToEdit | null;
  onOpenMap: () => void;
  selectedLocation: SelectedPropertyLocation | null;
};

const initialForm: PropertyFormData = {
  title: "",
  listingType: "rent",
  propertyType: "apartment",
  bhk: "2",
  price: "",
  address: "",
  locality: "",
  city: "",
  latitude: "",
  longitude: "",
  description: "",
  ownerPhone: "",
};

export default function PropertyListingForm({
  propertyToEdit = null,
  onOpenMap,
  selectedLocation,
}: PropertyListingFormProps) {
  const [form, setForm] = useState<PropertyFormData>(() => {
    if (!propertyToEdit) return initialForm;

    return {
      title: propertyToEdit.title,
      listingType: propertyToEdit.listing_type,
      propertyType: propertyToEdit.property_type,
      bhk: propertyToEdit.bhk === null ? "" : String(propertyToEdit.bhk),
      price: String(propertyToEdit.price),
      address: propertyToEdit.address,
      locality: propertyToEdit.locality,
      city: propertyToEdit.city,
      latitude:
        propertyToEdit.latitude == null
          ? ""
          : String(propertyToEdit.latitude),
      longitude:
        propertyToEdit.longitude == null
          ? ""
          : String(propertyToEdit.longitude),
      description: propertyToEdit.description ?? "",
      ownerPhone: propertyToEdit.owner_phone ?? "",
    };
  });

  useEffect(() => {
    if (!propertyToEdit) {
      setForm(initialForm);
      setError("");
      setPreviewReady(false);
      setExistingImages([]);
      setExistingImageError("");
      setRemovedImagePaths([]);
      return;
    }

    setForm({
      title: propertyToEdit.title,
      listingType: propertyToEdit.listing_type,
      propertyType: propertyToEdit.property_type,
      bhk: propertyToEdit.bhk === null ? "" : String(propertyToEdit.bhk),
      price: String(propertyToEdit.price),
      address: propertyToEdit.address,
      locality: propertyToEdit.locality,
      city: propertyToEdit.city,
      latitude:
        propertyToEdit.latitude == null
          ? ""
          : String(propertyToEdit.latitude),
      longitude:
        propertyToEdit.longitude == null
          ? ""
          : String(propertyToEdit.longitude),
      description: propertyToEdit.description ?? "",
      ownerPhone: propertyToEdit.owner_phone ?? "",
    });

    setError("");
    setPreviewReady(false);

    setExistingImages([]);
    setExistingImageError("");
    setRemovedImagePaths([]);
  }, [propertyToEdit]);

  useEffect(() => {
    if (!selectedLocation) return;

    setForm((previous) => ({
      ...previous,
      address: selectedLocation.address,
      locality: selectedLocation.locality,
      city: selectedLocation.city,
      latitude: String(selectedLocation.latitude),
      longitude: String(selectedLocation.longitude),
    }));

    setLocationSuggestions([]);
    setLocationSearchError("");
    setError("");
    setPreviewReady(false);
  }, [selectedLocation]);

  useEffect(() => {
    let cancelled = false;

    async function loadExistingImages() {
      const paths = propertyToEdit?.image_urls ?? [];

      if (paths.length === 0) {
        setExistingImages([]);
        return;
      }

      const results = await Promise.all(
        paths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from("property-images")
            .createSignedUrl(path, 3600);

          if (error || !data?.signedUrl) {
            console.error(
              "Unable to load existing property image:",
              path,
              error
            );
            return null;
          }

          return { path, url: data.signedUrl };
        })
      );

      if (!cancelled) {
        setExistingImages(
          results.filter(
            (image): image is { path: string; url: string } =>
              image !== null
          )
        );
      }
    }

    void loadExistingImages();

    return () => {
      cancelled = true;
    };
  }, [propertyToEdit?.id, propertyToEdit?.image_urls]);

  const [error, setError] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<{ path: string; url: string }[]>([]);

  const [existingImageError, setExistingImageError] = useState("");
  const [removedImagePaths, setRemovedImagePaths] = useState<string[]>([]);
  const [imageError, setImageError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);

type LocationSuggestion = {
  displayName: string;
  latitude: number;
  longitude: number;
  locality: string;
  city: string;
};

const [locationSuggestions, setLocationSuggestions] =
  useState<LocationSuggestion[]>([]);
const [locationSearchLoading, setLocationSearchLoading] =
  useState(false);
const [locationSearchError, setLocationSearchError] = useState("");


  function updateField<K extends keyof PropertyFormData>(
    field: K,
    value: PropertyFormData[K]
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setError("");
    setPreviewReady(false);
  }

  async function searchPropertyLocations(query: string) {
    if (query.trim().length < 3) {
      setLocationSuggestions([]);
      setLocationSearchError("");
      setLocationSearchLoading(false);
      return;
    }

    setLocationSearchLoading(true);
    setLocationSearchError("");

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        format: "jsonv2",
        addressdetails: "1",
        limit: "5",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Location search is temporarily unavailable.");
      }

      const results = (await response.json()) as Array<{
        display_name: string;
        lat: string;
        lon: string;
        address?: {
          suburb?: string;
          neighbourhood?: string;
          residential?: string;
          city?: string;
          town?: string;
          village?: string;
          municipality?: string;
          county?: string;
        };
      }>;

      const suggestions: LocationSuggestion[] = results.map((item) => ({
        displayName: item.display_name,
        latitude: Number(item.lat),
        longitude: Number(item.lon),
        locality:
          item.address?.suburb ??
          item.address?.neighbourhood ??
          item.address?.residential ??
          "",
        city:
          item.address?.city ??
          item.address?.town ??
          item.address?.village ??
          item.address?.municipality ??
          item.address?.county ??
          "",
      }));

      setLocationSuggestions(suggestions);
    } catch {
      setLocationSuggestions([]);
      setLocationSearchError(
        "Unable to search locations. Please try again."
      );
    } finally {
      setLocationSearchLoading(false);
    }
  }

  async function handleUsePropertyCurrentLocation() {
    setLocationSearchError("");
    setLocationSuggestions([]);

    if (!navigator.geolocation) {
      setLocationSearchError(
        "Your browser does not support location detection."
      );
      return;
    }

    setLocationSearchLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        updateField("latitude", String(latitude));
        updateField("longitude", String(longitude));

        try {
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
            address?: {
              suburb?: string;
              neighbourhood?: string;
              residential?: string;
              city?: string;
              town?: string;
              village?: string;
              municipality?: string;
              county?: string;
            };
          };

          if (!result.display_name) {
            throw new Error("No address was found.");
          }

          updateField("address", result.display_name);
          updateField(
            "locality",
            result.address?.suburb ??
              result.address?.neighbourhood ??
              result.address?.residential ??
              ""
          );
          updateField(
            "city",
            result.address?.city ??
              result.address?.town ??
              result.address?.village ??
              result.address?.municipality ??
              result.address?.county ??
              ""
          );
        } catch {
          setLocationSearchError(
            "Coordinates were detected, but the address could not be retrieved. You can enter the address manually."
          );
        } finally {
          setLocationSearchLoading(false);
        }
      },
      (error) => {
        setLocationSearchLoading(false);

        setLocationSearchError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Please allow location access or search manually."
            : "Unable to detect your location. Please try again or search manually."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }

  function handleImageSelection(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? []);
    setImageError("");

    if (selectedImages.length + files.length > 10) {
      setImageError("You can select a maximum of 10 images per property.");
      event.target.value = "";
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    const invalidFile = files.find(
      (file) => !validTypes.includes(file.type) || file.size > 5 * 1024 * 1024
    );

    if (invalidFile) {
      setImageError(
        "Use JPEG, PNG, or WebP images. Each image must be 5 MB or smaller."
      );
      event.target.value = "";
      return;
    }

    setSelectedImages((previous) => [...previous, ...files]);
    event.target.value = "";
  }

  function removeSelectedImage(index: number) {
    setSelectedImages((previous) =>
      previous.filter((_, imageIndex) => imageIndex !== index)
    );
    setImageError("");
  }

  async function uploadPropertyImages(
    files: File[],
    ownerId: string,
    propertyId: string
  ): Promise<string[]> {
    const uploadedPaths: string[] = [];

    try {
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase();

        const safeExtension =
          extension === "jpg" ||
          extension === "jpeg" ||
          extension === "png" ||
          extension === "webp"
            ? extension
            : null;

        if (!safeExtension) {
          throw new Error(`Unsupported image file: ${file.name}`);
        }

        const path = `${ownerId}/${propertyId}/${crypto.randomUUID()}.${safeExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("property-images")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(path);
      }

      return uploadedPaths;
    } catch (uploadError) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from("property-images")
          .remove(uploadedPaths);

        if (cleanupError) {
          console.error(
            "Image upload failed, and cleanup of previously uploaded images also failed:",
            cleanupError
          );

          throw new Error(
            `Image upload failed, and cleanup also failed. Some uploaded files may remain in Storage. Original error: ${
              uploadError instanceof Error
                ? uploadError.message
                : "Unknown upload error."
            }`
          );
        }
      }

      throw uploadError;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPreviewReady(false);

    if (form.title.trim().length < 5) {
      setError("Enter a title with at least 5 characters.");
      return;
    }

    if (!form.price || !Number.isFinite(Number(form.price)) ||
        Number(form.price) <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    if (
      form.propertyType !== "pg" &&
      (!form.bhk || !Number.isInteger(Number(form.bhk)) ||
        Number(form.bhk) < 1 || Number(form.bhk) > 20)
    ) {
      setError("Select a valid BHK count.");
      return;
    }

    if (
      !form.address.trim() ||
      !form.locality.trim() ||
      !form.city.trim()
    ) {
      setError("Complete the address, locality, and city fields.");
      return;
    }

    const normalizedPhone = form.ownerPhone.trim();

    if (!/^\+?[0-9\s()-]{10,20}$/.test(normalizedPhone)) {
      setError("Enter a valid contact phone number.");
      return;
    }

    const digitCount = normalizedPhone.replace(/\D/g, "").length;

    if (digitCount < 10 || digitCount > 15) {
      setError("The phone number must contain 10 to 15 digits.");
      return;
    }

    setSaving(true);
    setSaveMessage("");
    setPreviewReady(false);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        throw new Error("Please sign in before saving a property.");
      }

      const ownerId = session.user.id;

      const existingImages = propertyToEdit?.image_urls ?? [];
      const remainingImageCount =
        existingImages.filter((path) => !removedImagePaths.includes(path)).length;

      if (remainingImageCount + selectedImages.length > 10) {
        throw new Error("A property can have a maximum of 10 images.");
      }

      const propertyValues = {
  title: form.title.trim(),
  listing_type: form.listingType,
  property_type: form.propertyType,
  bhk: form.propertyType === "pg" ? null : Number(form.bhk),
  price: Number(form.price),
  address: form.address.trim(),
  locality: form.locality.trim(),
  city: form.city.trim(),
  latitude:
    form.latitude.trim() === "" ? null : Number(form.latitude),
  longitude:
    form.longitude.trim() === "" ? null : Number(form.longitude),
  description: form.description.trim() || null,
  owner_phone: normalizedPhone,
  is_published: false,
};
 
      let propertyId: string;

      if (propertyToEdit) {
        const { data, error: updateError } = await supabase
          .from("properties")
          .update(propertyValues)
          .eq("id", propertyToEdit.id)
          .eq("owner_id", ownerId)
          .eq("is_published", false)
          .select("id")
          .single();

        if (updateError) throw updateError;
        propertyId = data.id;
      } else {
        const { data, error: insertError } = await supabase
          .from("properties")
          .insert({
            owner_id: ownerId,
            ...propertyValues,
            image_urls: [],
          })
          .select("id")
          .single();

        if (insertError) throw insertError;
        propertyId = data.id;
      }

      let newImagePaths: string[] = [];
      let imageCleanupFailed = false;

      try {
        newImagePaths = await uploadPropertyImages(
          selectedImages,
          ownerId,
          propertyId
        );

        const remainingImagePaths = existingImages.filter(
          (path) => !removedImagePaths.includes(path)
        );

        const allImagePaths = [...remainingImagePaths, ...newImagePaths];

        if (
          selectedImages.length > 0 ||
          removedImagePaths.length > 0 ||
          !propertyToEdit
        ) {
          const { data: updatedRows, error: imageUpdateError } = await supabase
            .from("properties")
            .update({ image_urls: allImagePaths })
            .eq("id", propertyId)
            .eq("owner_id", ownerId)
            .eq("is_published", false)
            .select("id");

          if (imageUpdateError) throw imageUpdateError;

          if (!updatedRows || updatedRows.length === 0) {
            throw new Error("Unable to update the property's image list.");
          }
        }

        if (removedImagePaths.length > 0) {
          const { error: removeError } = await supabase.storage
            .from("property-images")
            .remove(removedImagePaths);

          if (removeError) {
            console.error(
              "Image list saved, but Storage cleanup failed:",
              removeError
            );
            imageCleanupFailed = true;
            setImageError(
              "The draft was saved, but some removed images may remain in Storage."
            );
          }
        }
      } catch (imageSaveError) {
        let cleanupWarning = "";

        if (newImagePaths.length > 0) {
          const { error: cleanupError } = await supabase.storage
            .from("property-images")
            .remove(newImagePaths);

          if (cleanupError) {
            console.error(
              "Failed to clean up newly uploaded images:",
              cleanupError
            );

            cleanupWarning =
              " Some newly uploaded files may remain in Storage.";
          }
        }

        throw new Error(
          `The draft was saved, but its images could not be saved. ${
            imageSaveError instanceof Error
              ? imageSaveError.message
              : "Please try again."
          }${cleanupWarning}`
        );
      }

      setPreviewReady(true);
      setSaveMessage(
        propertyToEdit
          ? "Draft updated successfully!"
          : "Draft saved successfully!"
      );

      setSelectedImages([]);
      setRemovedImagePaths([]);
      setImageError("");
      if (imageCleanupFailed) {
        setImageError(
          "The draft was saved, but some removed images may remain in Storage."
        );
      }
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save the property. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

  const labelClass = "block text-sm font-semibold text-gray-700";

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="mb-7">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
          <Home size={25} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          List your property
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Share the details of your property so people can discover their
          next home.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div>
          <span className={labelClass}>What would you like to do?</span>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["rent", "sale"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={form.listingType === type}
                onClick={() => updateField("listingType", type)}
                className={`rounded-xl border px-4 py-3 font-semibold capitalize transition ${
                  form.listingType === type
                    ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                    : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {type === "rent" ? "For Rent" : "For Sale"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="property-title">
            Property title *
          </label>
          <input
            id="property-title"
            className={inputClass}
            placeholder="e.g. Spacious 2 BHK near the metro"
            minLength={5}
            maxLength={120}
            required
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="property-type">
            Property type *
          </label>
          <select
            id="property-type"
            className={inputClass}
            value={form.propertyType}
            onChange={(e) =>
              updateField("propertyType", e.target.value as PropertyType)
            }
          >
            <option value="apartment">Apartment / Flat</option>
            <option value="independent_house">Independent House</option>
            <option value="pg">Paying Guest (PG)</option>
          </select>
        </div>

        {form.propertyType !== "pg" && (
          <div>
            <label className={labelClass} htmlFor="property-bhk">
              Bedrooms (BHK) *
            </label>
            <select
              id="property-bhk"
              className={inputClass}
              value={form.bhk}
              onChange={(e) => updateField("bhk", e.target.value)}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n} BHK
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="property-price">
            {form.listingType === "rent"
              ? "Monthly rent (₹) *"
              : "Sale price (₹) *"}
          </label>
          <div className="relative mt-1">
            <IndianRupee
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            />
            <input
              id="property-price"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              className={`${inputClass} mt-0 pl-11`}
              placeholder={form.listingType === "rent" ? "15000" : "6500000"}
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="flex items-center gap-2 font-bold text-gray-900">
            <MapPin size={19} className="text-emerald-700" />
            Property location
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Accurate location details help people find nearby homes.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={handleUsePropertyCurrentLocation}
            disabled={locationSearchLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MapPin size={18} />
            {locationSearchLoading
              ? "Getting location..."
              : "Use My Current Location"}
          </button>

          <p className="mt-2 text-xs text-gray-500">
            Use this option if you are currently at the property.
            Otherwise, search for the property's address manually.
          </p>

          {locationSearchError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {locationSearchError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenMap}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white transition hover:bg-emerald-900"
        >
          <MapPin size={18} />
          Select Location on Map
        </button>

        <div>
          <label className={labelClass} htmlFor="property-address">
            Full address *
          </label>
          <input
            id="property-address"
            className={inputClass}
            placeholder="Search an address, area, landmark, or building"
            required
            autoComplete="off"
            value={form.address}
            onChange={(e) => {
              const value = e.target.value;

              updateField("address", value);
              updateField("latitude", "");
              updateField("longitude", "");
              setLocationSuggestions([]);

              if (value.trim().length >= 3) {
                void searchPropertyLocations(value);
              } else {
                setLocationSearchError("");
                setLocationSearchLoading(false);
              }
            }}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="property-locality">
              Locality *
            </label>
            <input
              id="property-locality"
              className={inputClass}
              placeholder="e.g. Madhapur"
              required
              value={form.locality}
              onChange={(e) => updateField("locality", e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="property-city">
              City *
            </label>
            <input
              id="property-city"
              className={inputClass}
              placeholder="e.g. Hyderabad"
              required
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="owner-phone">
            Contact phone number *
          </label>
          <input
            id="owner-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            maxLength={20}
            className={inputClass}
            placeholder="e.g. +91 9876543210"
            value={form.ownerPhone}
            onChange={(event) => updateField("ownerPhone", event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Home Seekers may use this number to contact you about your property.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="font-bold text-gray-900">Property photos</h3>
          <p className="mt-1 text-sm text-gray-500">
            Select up to 10 photos. JPEG, PNG, and WebP; maximum 5 MB each.
          </p>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImageSelection}
            className="mt-4 block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-800 hover:file:bg-emerald-100"
          />

          {imageError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {imageError}
            </p>
          )}

          {existingImageError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              Unable to load existing photos: {existingImageError}
            </p>
          )}

          {existingImages.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {existingImages.map((image, index) => (
                <div
                  key={image.path}
                  className="overflow-hidden rounded-xl border border-gray-200"
                >
                  <img
                    src={image.url}
                    alt={`Existing property photo ${index + 1}`}
                    className="h-32 w-full object-cover"
                  />

                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRemovedImagePaths((previous) =>
                          previous.includes(image.path)
                            ? previous
                            : [...previous, image.path]
                        );

                        setExistingImages((previous) =>
                          previous.filter(
                            (existingImage) =>
                              existingImage.path !== image.path
                          )
                        );

                        setImageError("");
                      }}
                      className="text-sm font-semibold text-red-700 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedImages.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {selectedImages.map((file, index) => (
                <div
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="overflow-hidden rounded-xl border border-gray-200"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Selected property photo ${index + 1}`}
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-2">
                    <p className="truncate text-xs text-gray-600">{file.name}</p>
                    <button
                      type="button"
                      onClick={() => removeSelectedImage(index)}
                      className="mt-2 text-sm font-semibold text-red-700 hover:text-red-900"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500">
            {(propertyToEdit?.image_urls ?? []).filter(
  (path) => !removedImagePaths.includes(path)
).length + selectedImages.length}/10 images selected
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="property-description">
            Description (optional)
          </label>
          <textarea
            id="property-description"
            className={inputClass}
            rows={4}
            maxLength={2000}
            placeholder="Describe the property, amenities, furnishing, and other details."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-gray-500">
            {form.description.length}/2000 characters
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-emerald-800 px-5 py-3.5 font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving draft..." : "Save property draft"}
        </button>
      </form>

      {previewReady && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
        >
          <div className="flex items-center gap-2 font-bold text-emerald-900">
            <CheckCircle2 size={20} />
            Form validation passed
          </div>
          <p className="mt-2 text-sm text-emerald-900">
            {form.title.trim()}
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            {form.propertyType === "pg"
              ? "PG"
              : `${form.bhk} BHK`}{" "}
            · {form.listingType === "rent" ? "For rent" : "For sale"} · ₹
            {Number(form.price).toLocaleString("en-IN")}
            {form.listingType === "rent" ? " / month" : ""}
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            {form.locality}, {form.city}
          </p>
          <p className="mt-3 text-sm text-emerald-800">
            {saveMessage || "Draft preview"}
          </p>
        </div>
      )}
    </section>
  );
}
