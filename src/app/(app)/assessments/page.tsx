import { Suspense } from "react";
import { AssessmentsScreen } from "@/components/assessments/assessments-screen";

export const metadata = { title: "Assessments" };

export default function AssessmentsPage() {
  return (
    <Suspense>
      <AssessmentsScreen />
    </Suspense>
  );
}
