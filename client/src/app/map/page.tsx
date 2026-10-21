import { Suspense } from "react";

import { LoadingList } from "@/components/ui";
import { MapView } from "@/views/MapView";

export default function Page() {
  return (
    <Suspense fallback={<div className="pt-16"><LoadingList count={3} /></div>}>
      <MapView />
    </Suspense>
  );
}
