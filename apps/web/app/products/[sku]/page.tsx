import { notFound } from "next/navigation";
import { skus } from "../../../lib/commerce";
import ProductDetail from "./product-detail";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  if (!skus.includes(sku)) notFound();
  return <ProductDetail sku={sku} />;
}
