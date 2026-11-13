"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/errors";
import { createListing, deleteListing, setListingActive, updateListing } from "@/lib/listings";

export async function createListingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  let id = "";
  const state = await toActionState(async () => {
    id = await createListing(user.id, formData);
  });
  if (state?.error) return state;
  redirect(`/costumes/${id}`);
}

export async function updateListingAction(listingId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const state = await toActionState(() => updateListing(user.id, listingId, formData));
  if (state?.error) return state;
  revalidatePath(`/costumes/${listingId}`);
  redirect(`/costumes/${listingId}`);
}

export async function setListingActiveAction(listingId: string, active: boolean): Promise<ActionState> {
  const user = await requireUser();
  const state = await toActionState(() => setListingActive(user.id, listingId, active));
  revalidatePath("/my-listings");
  revalidatePath(`/costumes/${listingId}`);
  return state;
}

export async function deleteListingAction(listingId: string): Promise<ActionState> {
  const user = await requireUser();
  const state = await toActionState(() => deleteListing(user.id, listingId));
  if (state?.error) return state;
  redirect("/my-listings");
}
