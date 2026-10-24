"use client";
import { createContext, useContext } from "react";
import { createMutation } from "./commerce";

// A React boundary, never a process-global 'current account'.
export const OperationActorContext = createContext<string | null>(null);
export function useActorMutation() {
  const actorId = useContext(OperationActorContext);
  return createMutation(fetch, { actorId: actorId ?? "" });
}
