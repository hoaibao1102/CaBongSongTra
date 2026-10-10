import { catalog } from "./catalog";
const money = new Intl.NumberFormat("vi-VN");
export default function Home() { return <main><header><p className="eyebrow">QUẢNG NGÃI · VIỆT NAM</p><h1>Cá Bống Sông Trà</h1><p>Website V2 đang được xây dựng trên nền tảng an toàn cho đơn hàng, tồn kho và tài chính.</p></header><section aria-label="Sản phẩm">{catalog.map((product)=><article key={product.sku}><span>{product.sku}</span><h2>{product.name.vi}</h2><p lang="en">{product.name.en}</p><strong>{money.format(product.priceVnd)}đ</strong></article>)}</section></main>; }
