import { Badge } from "@/components/ui/badge";

/**
 * v1.9 — Small badge shown next to event name in list views to indicate
 * feature mode (Full vs Lite).
 */
export function EventFeatureModeBadge({
  mode,
}: {
  mode: "full" | "lite";
}): React.ReactElement {
  if (mode === "lite") {
    return (
      <Badge variant="secondary" className="text-xs">
        Lite
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
      Full
    </Badge>
  );
}
