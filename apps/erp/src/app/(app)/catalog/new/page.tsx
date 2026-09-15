import { redirect } from "next/navigation";

export default function NewProductPage() {
  redirect("/catalog?createProduct=true");
}
