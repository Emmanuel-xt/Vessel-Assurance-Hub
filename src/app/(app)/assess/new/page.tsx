import { Suspense } from "react";
import { AssessmentSetup } from "@/components/assess/assessment-setup";

export const metadata = { title: "New assessment" };

export default function NewAssessmentPage() {
  return (
    <Suspense>
      <AssessmentSetup />
    </Suspense>
  );
}
