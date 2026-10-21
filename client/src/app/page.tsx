import { Suspense } from "react";

import { HomeView } from "@/views/HomeView";
import { LoadingList } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<div className="pt-6"><LoadingList /></div>}>
      <HomeView />
    </Suspense>
  );
}
