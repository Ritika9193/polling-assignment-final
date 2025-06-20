import { Suspense } from "react";
import StudentPollClient from "./StudentPollClient";

export default function Page() {
  return (
    <Suspense>
      <StudentPollClient />
    </Suspense>
  );
} 