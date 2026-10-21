import { Suspense } from "react";

import { LoadingList } from "@/components/ui";
import { ModelDetailView } from "@/views/ModelDetailView";

export default function Page() {
  return (
    <Suspense fallback={<div className="pt-16"><LoadingList count={4} /></div>}>
      <ModelDetailView />
    </Suspense>
  );
}
