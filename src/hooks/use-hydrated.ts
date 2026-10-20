"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
const client = () => true;
const server = () => false;
/** Stable SSR snapshot; portals become available after client hydration. */
export function useHydrated() { return useSyncExternalStore(subscribe, client, server); }
