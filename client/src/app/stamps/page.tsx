import { Suspense } from "react";

import { LoadingList } from "@/components/ui";
import { StampsView } from "@/views/StampsView";

export default function Page() {
  return (
    <Suspense fallback={<div className="pt-16"><LoadingList count={3} /></div>}>
      <StampsView />
    </Suspense>
  );
}
