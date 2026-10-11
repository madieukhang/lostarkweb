"use client";

import { useT } from "./LangProvider";

/**
 * Placeholder shown while data loads; the visual design round restyles it.
 * @returns A busy status block.
 */
export function Skeleton() {
  const tr = useT();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={tr("common.loading")}
      style={{ height: "1.5rem", width: "12rem", background: "#d9d9d9", borderRadius: 4 }}
    />
  );
}
