import { redirect } from "next/navigation";

// Moved to /assessments (Stage 11).
export default function MyAssessmentsPage() {
  redirect("/assessments");
}
