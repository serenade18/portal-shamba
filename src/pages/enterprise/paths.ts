import type { Module } from "@/api/types";

export const MODULE_PATH: Record<Module, string> = {
  livestock: "/animals",
  batches: "/poultry",
  crops: "/crops",
};

export const enterprisePath = (module: Module, id: string) => `${MODULE_PATH[module]}/${id}`;
