import type { EnterpriseType, Module, TypeCode } from "@/api/types";

/** What one head of a batch is counted as, for labels ("12 pigs"). */
export const HEAD_UNIT: Partial<Record<TypeCode, string>> = { layers: "bird", broilers: "bird", fish: "fish", pigs: "pig", rabbits: "rabbit" };

/** Crops whose harvest is dried grain: they record green or dry. */
export const GRAINS: TypeCode[] = ["maize", "beans", "rice", "wheat"];

/**
 * The modules a type's enterprises belong to. Pigs and rabbits are "mixed": breeding
 * stock in a herd (livestock) and their litters as batches.
 */
export function modulesOf(t: EnterpriseType | undefined): Module[] {
  if (!t) return [];
  return t.tracking_mode === "mixed" ? [t.module, "batches"] : [t.module];
}

export const isMixed = (t: EnterpriseType | undefined) => t?.tracking_mode === "mixed";
export const isPerennial = (t: EnterpriseType | undefined) => t?.tracking_mode === "perennial";

/** The batches menu says "Poultry & fish" unless the farm raises litters there too. */
export function batchesLabel(types: TypeCode[]): "nav.poultry" | "nav.batches" {
  return types.some((c) => c === "pigs" || c === "rabbits") ? "nav.batches" : "nav.poultry";
}
