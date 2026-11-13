import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState title="Page not found" action={{ href: "/costumes", label: "Browse costumes" }}>
      This costume may have been removed, or the link is wrong.
    </EmptyState>
  );
}
