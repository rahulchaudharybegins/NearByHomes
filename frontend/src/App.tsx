import { useEffect, useState } from "react";
import MyFavorites from "./components/MyFavorites";
import type { FormEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Compass,
  KeyRound,
  LogOut,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import PropertyListingForm from "./components/PropertyListingForm";
import PropertyLocationPicker from "./components/PropertyLocationPicker";
import MyListings from "./components/MyListings";
import HomeSeekerListings from "./components/HomeSeekerListings";


type EntryOption = {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: string;
};

type UserRole = "owner" | "seeker";

const API_URL = "http://localhost:3000";

const iconMap = {
  key: KeyRound,
  search: Search,
  user: UserRound,
};

function App() {
  const [options, setOptions] = useState<EntryOption[]>([]);
  const [selected, setSelected] = useState<string | null>(() => {
    return sessionStorage.getItem("nearby-homes-selected");
  });

  useEffect(() => {
    if (selected) {
      sessionStorage.setItem("nearby-homes-selected", selected);
    } else {
      sessionStorage.removeItem("nearby-homes-selected");
    }
  }, [selected]);

  const [draftToEdit, setDraftToEdit] = useState<any>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [showHomeSearchResults, setShowHomeSearchResults] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<{
    address: string;
    latitude: number;
    longitude: number;
    locality: string;
    city: string;
  } | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authRole, setAuthRole] = useState<UserRole>("seeker");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");

  const [showAuth, setShowAuth] = useState(false);
  const [protectedResult, setProtectedResult] = useState("");
  const [protectedLoading, setProtectedLoading] = useState(false);
  


  async function testProtectedEndpoint() {
  setProtectedLoading(true);
  setProtectedResult("");

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;

    if (!session?.access_token) {
      throw new Error("Please log in first.");
    }

    const response = await fetch(`${API_URL}/api/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Protected request failed.");
    }

    setProtectedResult(
      `Verified by backend: ${data.user.email} (ID: ${data.user.id})`
    );
  } catch (error) {
    setProtectedResult(
      error instanceof Error ? error.message : "Request failed."
    );
  } finally {
    setProtectedLoading(false);
  }
}

  useEffect(() => {
    let active = true;

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        setOptionsError("");

        const response = await fetch(`${API_URL}/api/entry-options`);

        if (!response.ok) {
          throw new Error("Unable to load the entry options.");
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.options)) {
          throw new Error("The server returned an invalid response.");
        }

        if (active) setOptions(data.options);
      } catch {
        if (active) {
          setOptionsError(
            "Unable to connect to the backend. Check that it is running."
          );
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    }

    loadOptions();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setAuthReady(true);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;

        if (error) {
          setAuthError(error.message);
        } else {
          setUser(data.session?.user ?? null);
        }

        setAuthReady(true);
      })
      .catch(() => {
        if (active) {
          setAuthError("Unable to check your session. Please refresh.");
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  function chooseOption(action: string) {
    setSelected(action);
    setAuthError("");
    setAuthMessage("");

    if (action === "guest") {
      setGuestMode(true);
      setShowAuth(false);
      return;
    }

    setGuestMode(false);
    setAuthRole(action === "owner" ? "owner" : "seeker");
    setAuthMode("signup");
    setShowAuth(!user);
  }

  function openOwnerListing() {
    setDraftToEdit(null);
    setSelectedLocation(null);
    setSelected("owner");
    setGuestMode(false);
    setShowAuth(false);
    setAuthError("");
    setAuthMessage("");
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setAuthError("");
    setAuthMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setAuthError("Please enter your email and password.");
      return;
    }

    if (authMode === "signup" && password.length < 8) {
      setAuthError("Your password must be at least 8 characters.");
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              role: authRole,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setUser(data.user);
          setShowAuth(false);
          setSelected(
            data.user?.user_metadata?.role === "seeker" ? "seeker" : null
          );
          setAuthMessage("Your account has been created successfully.");
        } else {
          setAuthMessage(
            "Registration submitted. Check your email to confirm your account before signing in."
          );
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (error) throw error;

        setUser(data.user);
        setShowAuth(false);
        setGuestMode(false);
        setSelected(
          data.user?.user_metadata?.role === "seeker" ? "seeker" : null
        );
        setAuthMessage("You are signed in successfully.");
      }
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again."
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    setAuthError("");
    setAuthMessage("");

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setUser(null);
    setGuestMode(false);
    setSelected(null);
    setShowAuth(false);
    setAuthMessage("You have signed out.");
  }

  const selectedOption = options.find(
    (option) => option.action === selected
  );

  const roleLabel =
    user?.user_metadata?.role === "owner"
      ? "Owner"
      : user?.user_metadata?.role === "seeker"
        ? "Home seeker"
        : "Registered user";

  const isMyFavoritesPage =
    Boolean(user) &&
    user?.user_metadata?.role === "seeker" &&
    selected === "my-favorites";

  const isHomeSearchResultsPage =
    Boolean(user) &&
    user?.user_metadata?.role === "seeker" &&
    selected === "seeker" &&
    showHomeSearchResults;

  if (showMapPicker) {
    return (
      <PropertyLocationPicker
        onCancel={() => setShowMapPicker(false)}
        onConfirm={(location) => {
          setSelectedLocation(location);
          setShowMapPicker(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf8] text-[#17251f]">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white">
              <Building2 size={24} />
            </div>

            <div>
              <p className="text-lg font-extrabold tracking-tight">
                Nearby Homes
              </p>
              <p className="text-xs text-gray-500">
                Find your place.
              </p>
            </div>
          </a>

          {authReady && user ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              <LogOut size={17} />
              Sign out
            </button>
          ) : (
            <div className="hidden items-center gap-2 text-sm font-medium text-emerald-900 sm:flex">
              <ShieldCheck size={18} />
              Property trust starts here
            </div>
          )}
        </div>
      </header>

      <main
        className={
          isMyFavoritesPage
            ? "w-full"
            : isHomeSearchResultsPage
              ? "mx-auto w-full max-w-none px-4 py-6 sm:px-6"
              : "mx-auto grid max-w-7xl items-start gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-16"
        }
      >
        {isMyFavoritesPage ? (
          <MyFavorites onBack={() => setSelected("seeker")} />
        ) : (
          <>
        <section className={isHomeSearchResultsPage ? "hidden" : ""}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm">
            <MapPin size={16} />
            Your next home, closer to you
          </div>

          <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            A better home.
            <span className="mt-2 block text-emerald-800">
              A shorter journey.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
            Discover flats, BHK apartments and PGs near your
            workplace or college. Find properties by distance,
            compare options and look for verified listings.
          </p>

          <div className="mt-8 space-y-3 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-700" />
              Location-first discovery
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-700" />
              Property verification signals
            </div>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
              <MapPin className="mb-3 text-emerald-800" size={22} />
              <p className="text-sm font-bold">Nearby</p>
              <p className="mt-1 text-xs text-gray-500">Search by location</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
              <Compass className="mb-3 text-emerald-800" size={22} />
              <p className="text-sm font-bold">Better routes</p>
              <p className="mt-1 text-xs text-gray-500">Compare journeys</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
              <BadgeCheck className="mb-3 text-emerald-800" size={22} />
              <p className="text-sm font-bold">More trust</p>
              <p className="mt-1 text-xs text-gray-500">Check listings</p>
            </div>
          </div>
        </section>

        <section
          className={
            isHomeSearchResultsPage
              ? "w-full"
              : "rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-xl shadow-emerald-950/5 sm:p-8"
          }
        >
          {user &&
          user.user_metadata?.role === "owner" &&
          selected === "my-listings" ? (
            <MyListings
              onBack={() => setSelected(null)}
              onCreateListing={() => setSelected("owner")}
              onEditDraft={(property) => {
                setDraftToEdit(property);
                setSelected("owner");
              }}
              onPublishDraft={async (property) => {
                const confirmed = window.confirm(
                  `Publish "${property.title}"? Home Seekers will be able to see this listing.`
                );

                if (!confirmed) return false;

                const {
                  data: { session },
                  error: sessionError,
                } = await supabase.auth.getSession();

                if (sessionError || !session?.user) {
                  window.alert("Please sign in again before publishing.");
                  return false;
                }

                const { data, error } = await supabase
                  .from("properties")
                  .update({ is_published: true })
                  .eq("id", property.id)
                  .eq("owner_id", session.user.id)
                  .eq("is_published", false)
                  .select("id")
                  .maybeSingle();

                if (error) {
                  window.alert(`Unable to publish listing: ${error.message}`);
                  return false;
                }

                if (!data) {
                  window.alert(
                    "This draft could not be published. It may already be published or you may not have permission."
                  );
                  return false;
                }

                window.alert("Property published successfully!");
                return true;
              }}
              onDraftPublished={() => {
                setDraftToEdit(null);
                setSelected("my-listings");
              }}
            />
          ) : user &&
          user.user_metadata?.role === "owner" &&
          selected === "owner" ? (
            <div>
              <PropertyListingForm
                propertyToEdit={draftToEdit}
                onOpenMap={() => {
                  setSelectedLocation(null);
                  setShowMapPicker(true);
                }}
                selectedLocation={selectedLocation}
              />

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-4 w-full rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50"
              >
                Back to welcome
              </button>
            </div>
          ) : user &&
          user.user_metadata?.role === "seeker" &&
          selected === "seeker" ? (
            <HomeSeekerListings
              onBack={() => {
                setShowHomeSearchResults(false);
                setSelected(null);
              }}
              onShowResultsPage={() => setShowHomeSearchResults(true)}
              onBackToFiltersPage={() => setShowHomeSearchResults(false)}
            />
          ) : user ? (
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                <UserRound size={28} />
              </div>

              <h2 className="mt-5 text-2xl font-extrabold">
                Welcome to Nearby Homes!
              </h2>

              <p className="mt-2 text-gray-600">
                You are signed in as {roleLabel}.
              </p>

              <p className="mt-2 break-all text-sm text-gray-500">
                {user.email}
              </p>

              <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                Your authentication is working. Property listing and
                location-based search will be implemented in later steps.
              </div>

              {user.user_metadata?.role === "seeker" && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected("seeker")}
                    className="rounded-xl bg-emerald-800 px-6 py-3 font-bold text-white transition hover:bg-emerald-900"
                  >
                    Find a Home
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected("my-favorites")}
                    className="rounded-xl border border-emerald-200 bg-white px-6 py-3 font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                  >
                    ♥ My Favorites
                  </button>
                </div>
              )}

              {user.user_metadata?.role === "owner" && (
                <>
                  <button
                    type="button"
                    onClick={openOwnerListing}
                    className="mt-4 w-full rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white transition hover:bg-emerald-900"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      List a property <ArrowRight size={18} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected("my-listings")}
                    className="mt-3 w-full rounded-xl border border-emerald-800 px-5 py-3 font-bold text-emerald-900 hover:bg-emerald-50"
                  >
                    My Listings
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={testProtectedEndpoint}
                disabled={protectedLoading}
                className="mt-4 w-full rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white hover:bg-emerald-900 disabled:opacity-50"
              >
                {protectedLoading ? "Verifying..." : "Test protected API"}
              </button>

              {protectedResult && (
                <p
                  role="status"
                  className="mt-3 break-words rounded-xl bg-gray-50 p-3 text-sm leading-6"
                >
                  {protectedResult}
                </p>
              )}
            </div>
          ) : guestMode ? (
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                <Compass size={28} />
              </div>

              <h2 className="mt-5 text-2xl font-extrabold">
                Welcome, Guest!
              </h2>

              <p className="mt-2 leading-6 text-gray-600">
                You can explore Nearby Homes without an account.
                Saved searches and personalized alerts will require
                an account when those features are added.
              </p>

              <button
                onClick={() => {
                  setGuestMode(false);
                  setSelected(null);
                }}
                className="mt-6 w-full rounded-xl border border-gray-200 px-5 py-3 font-semibold hover:bg-gray-50"
              >
                Back to options
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-emerald-800">
                GET STARTED
              </p>

              <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                How would you like to continue?
              </h2>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                Choose an option to get started. Guests can explore
                without registering.
              </p>

              {loadingOptions && (
                <p className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                  Loading options...
                </p>
              )}

              {optionsError && (
                <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
                  {optionsError}
                  <button
                    onClick={() => window.location.reload()}
                    className="ml-2 font-bold underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loadingOptions && !optionsError && (
                <div className="mt-6 space-y-3">
                  {options.map((option) => {
                    const Icon =
                      iconMap[option.icon as keyof typeof iconMap] ??
                      UserRound;

                    const active = selected === option.action;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => chooseOption(option.action)}
                        className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition sm:p-5 ${
                          active
                            ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/10"
                            : "border-gray-200 hover:border-emerald-600 hover:bg-emerald-50/40"
                        }`}
                      >
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                            active
                              ? "bg-emerald-800 text-white"
                              : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          <Icon size={23} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">
                            {option.title}
                          </span>
                          <span className="mt-1 block text-sm leading-5 text-gray-500">
                            {option.description}
                          </span>
                        </span>

                        <ArrowRight
                          size={20}
                          className="shrink-0 text-gray-400 transition group-hover:translate-x-1"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {!showAuth && !guestMode && (
                <button
                  type="button"
                  disabled={!selected || loadingOptions || !!optionsError}
                  onClick={() => {
                    if (selected === "owner" || selected === "seeker") {
                      setAuthRole(selected);
                      setAuthMode("signup");
                      setAuthError("");
                      setAuthMessage("");
                      setShowAuth(true);
                    } else if (selected === "guest") {
                      setGuestMode(true);
                    }
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-4 font-bold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue <ArrowRight size={19} />
                </button>
              )}

              {showAuth && (
                <div className="mt-7 border-t border-gray-100 pt-6">
                  <p className="text-sm font-semibold text-emerald-800">
                    {authRole === "owner" ? "OWNER ACCOUNT" : "HOME SEEKER ACCOUNT"}
                  </p>

                  <h3 className="mt-2 text-xl font-extrabold">
                    {authMode === "signup"
                      ? "Create your account"
                      : "Welcome back"}
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError("");
                        setAuthMessage("");
                      }}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                        authMode === "signup"
                          ? "bg-white shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      Sign up
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError("");
                        setAuthMessage("");
                      }}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                        authMode === "login"
                          ? "bg-white shadow-sm"
                          : "text-gray-500"
                      }`}
                    >
                      Log in
                    </button>
                  </div>

                  <form onSubmit={handleAuth} className="mt-5 space-y-4">
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Email address
                      </label>
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="password"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        autoComplete={
                          authMode === "signup"
                            ? "new-password"
                            : "current-password"
                        }
                        required
                        minLength={8}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                      />
                    </div>

                    {authError && (
                      <p
                        role="alert"
                        className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                      >
                        {authError}
                      </p>
                    )}

                    {authMessage && (
                      <p
                        role="status"
                        className="rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-900"
                      >
                        {authMessage}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading || !authReady}
                      className="w-full rounded-xl bg-emerald-800 px-5 py-3.5 font-bold text-white hover:bg-emerald-900 disabled:opacity-50"
                    >
                      {authLoading
                        ? "Please wait..."
                        : authMode === "signup"
                          ? "Create account"
                          : "Log in"}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAuth(false);
                      setSelected(null);
                      setAuthError("");
                      setAuthMessage("");
                    }}
                    className="mt-4 w-full text-sm font-semibold text-gray-500 hover:text-gray-800"
                  >
                    Back to options
                  </button>
                </div>
              )}
            </>
          )}

          {authMessage && user && (
            <p
              role="status"
              className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
            >
              {authMessage}
            </p>
          )}

          {authError && user && (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            >
              {authError}
            </p>
          )}
        </section>
          </>
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Nearby Homes</p>
          <p>Find nearby homes. Make informed decisions.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
