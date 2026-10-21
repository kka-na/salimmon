import { Suspense } from "react";

import { LoadingList } from "@/components/ui";
import { ReviewDetailView } from "@/views/DetailViews";

export default function Page() {
  return (
    <Suspense fallback={<div className="pt-16"><LoadingList count={3} /></div>}>
      <ReviewDetailView />
    </Suspense>
  );
}
