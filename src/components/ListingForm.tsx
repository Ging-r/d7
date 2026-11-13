"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormMessage, SubmitButton, submitWithoutReset } from "@/components/forms";
import { CostumeMap } from "@/components/map/CostumeMap";
import { MAX_PHOTOS, SIZES, THEMES } from "@/lib/config";
import type { ActionState } from "@/lib/errors";
import type { LatLng } from "@/lib/geo";
import { photoUrl } from "@/lib/photos";
import { formatSEK } from "@/lib/pricing";

export interface ListingFormValues {
  title: string;
  description: string;
  theme: string;
  size: string;
  price: number | "";
  includedDays: number | "";
  extraDayPrice: number | "";
  deposit: number | "";
  value: number | "";
  areaLabel: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
  photos: { id: string; filename: string }[];
}

export const EMPTY_LISTING: ListingFormValues = {
  title: "",
  description: "",
  theme: "",
  size: "",
  price: "",
  includedDays: 3,
  extraDayPrice: "",
  deposit: "",
  value: "",
  areaLabel: "",
  lat: null,
  lng: null,
  active: true,
  photos: [],
};

export function ListingForm({
  action,
  initial,
  feePercent,
  mode,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  initial: ListingFormValues;
  feePercent: number;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [keptPhotos, setKeptPhotos] = useState(initial.photos);
  // Each picked photo keeps an object URL for its preview, revoked when removed.
  const [newFiles, setNewFiles] = useState<{ file: File; url: string }[]>([]);
  const [pin, setPin] = useState<LatLng | null>(initial.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [price, setPrice] = useState(String(initial.price));
  const [includedDays, setIncludedDays] = useState(String(initial.includedDays));

  useRevokeOnUnmount(newFiles);
  const photoCount = keptPhotos.length + newFiles.length;
  const priceNumber = Number(price);
  const payout = priceNumber > 0 ? priceNumber - Math.round((priceNumber * feePercent) / 100) : null;

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateError("Your browser can't share its location. Tap the map instead.");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPin(p);
        setFocus(p);
        setLocating(false);
      },
      () => {
        setLocateError("Couldn't get your location. Tap the map instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <form
      onSubmit={submitWithoutReset(formAction, (formData) => {
        // Photos live in state so they can be previewed and removed before upload.
        for (const { file } of newFiles) formData.append("photos", file);
      })}
      className="flex flex-col gap-8"
    >
      <Section title="Photos" description="Bright photos of the whole costume get the most requests. The first photo is the cover.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {keptPhotos.map((p) => (
            <PhotoThumb key={p.id} src={photoUrl(p.filename)} onRemove={() => setKeptPhotos((ps) => ps.filter((x) => x.id !== p.id))}>
              <input type="hidden" name="keepPhotos" value={p.id} />
            </PhotoThumb>
          ))}
          {newFiles.map((p) => (
            <PhotoThumb
              key={p.url}
              src={p.url}
              onRemove={() => {
                URL.revokeObjectURL(p.url);
                setNewFiles((fs) => fs.filter((f) => f !== p));
              }}
            />
          ))}
          {photoCount < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 hover:border-brand-500 hover:text-brand-700">
              <span className="text-2xl">＋</span>
              <span className="text-xs font-medium">Add photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const room = MAX_PHOTOS - keptPhotos.length - newFiles.length;
                  const picked = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
                  setNewFiles((fs) => [...fs, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="hint">
          Up to {MAX_PHOTOS} photos, JPEG, PNG or WebP, max 8 MB each.
        </p>
      </Section>

      <Section title="About the costume">
        <div className="grid gap-4">
          <Field label="Title" htmlFor="title">
            <input id="title" name="title" className="input" defaultValue={initial.title} placeholder="e.g. Full pirate captain outfit" required maxLength={80} />
          </Field>
          <Field label="Description" htmlFor="description" hint="What's included, fit, condition, and any washing instructions.">
            <textarea
              id="description"
              name="description"
              rows={5}
              className="input"
              defaultValue={initial.description}
              placeholder="Coat, hat, belt and a plastic sword. Fits like a normal M. No stains."
              required
              maxLength={3000}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Theme" htmlFor="theme">
              <select id="theme" name="theme" className="input" defaultValue={initial.theme} required>
                <option value="" disabled>
                  Choose…
                </option>
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Size" htmlFor="size">
              <select id="size" name="size" className="input" defaultValue={initial.size} required>
                <option value="" disabled>
                  Choose…
                </option>
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Price" description="One flat price covers a rental of up to the number of days you choose — perfect for a party weekend.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Price per rental (kr)" htmlFor="price">
            <input
              id="price"
              name="price"
              type="number"
              inputMode="numeric"
              min={10}
              max={10000}
              className="input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </Field>
          <Field label="Covers up to (days)" htmlFor="includedDays">
            <input
              id="includedDays"
              name="includedDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={14}
              className="input"
              value={includedDays}
              onChange={(e) => setIncludedDays(e.target.value)}
              required
            />
          </Field>
          <Field label="Extra day price (kr)" htmlFor="extraDayPrice" hint="Leave empty to not allow longer rentals.">
            <input
              id="extraDayPrice"
              name="extraDayPrice"
              type="number"
              inputMode="numeric"
              min={0}
              max={5000}
              className="input"
              defaultValue={initial.extraDayPrice}
            />
          </Field>
          <Field label="Deposit (kr)" htmlFor="deposit" hint="Refunded to the renter when the costume comes back OK.">
            <input
              id="deposit"
              name="deposit"
              type="number"
              inputMode="numeric"
              min={0}
              max={20000}
              className="input"
              defaultValue={initial.deposit}
              required
            />
          </Field>
          <Field label="Costume value (kr, optional)" htmlFor="value" hint="Roughly what it would cost to replace. Helps you pick a deposit.">
            <input id="value" name="value" type="number" inputMode="numeric" min={0} className="input" defaultValue={initial.value} />
          </Field>
        </div>
        {payout != null && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
            You receive <strong>{formatSEK(payout)}</strong> per rental of up to {includedDays || "?"} days, after the {feePercent}% platform fee.
          </p>
        )}
      </Section>

      <Section
        title="Meeting point"
        description="Tap the map where you'd like to hand over the costume. Renters only see an approximate area until they've paid."
      >
        <div className="flex flex-col gap-3">
          <CostumeMap mode="pick" point={pin} onPick={setPin} focus={focus} className="h-72" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-secondary" onClick={useMyLocation} disabled={locating}>
              {locating ? "Locating…" : "📍 Use my location"}
            </button>
            <span className="text-sm text-stone-500">{pin ? "Pin placed ✓" : "No pin yet"}</span>
          </div>
          {locateError && <p className="text-sm text-red-700">{locateError}</p>}
          <input type="hidden" name="lat" value={pin?.lat ?? ""} />
          <input type="hidden" name="lng" value={pin?.lng ?? ""} />
          <Field label="Area name (optional)" htmlFor="areaLabel" hint='Shown on your listing, e.g. "Delphi" or "near LTH".'>
            <input id="areaLabel" name="areaLabel" className="input" defaultValue={initial.areaLabel} maxLength={60} placeholder="e.g. Delphi" />
          </Field>
        </div>
      </Section>

      {mode === "edit" && (
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="size-4 accent-brand-600" />
          Show this costume in search results
        </label>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-stone-200 bg-stone-50/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingText={mode === "create" ? "Publishing…" : "Saving…"} className="btn-primary w-full py-3 sm:w-auto">
          {mode === "create" ? "Publish costume" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}

function useRevokeOnUnmount(files: { url: string }[]) {
  const latest = useRef(files);
  useEffect(() => {
    latest.current = files;
  }, [files]);
  useEffect(() => () => latest.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
}

function PhotoThumb({ src, onRemove, children }: { src?: string; onRemove: () => void; children?: React.ReactNode }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-stone-200">
      {/* eslint-disable-next-line @next/next/no-img-element -- local previews and our own uploads */}
      {src && <img src={src} alt="" className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80"
        aria-label="Remove photo"
      >
        ✕
      </button>
      {children}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 mb-4 text-sm text-stone-600">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
