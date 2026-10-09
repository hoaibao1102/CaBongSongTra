import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#f9f8f5",
          color: "#1f2420",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            color: "#54634c",
            fontWeight: 600,
          }}
        >
          ĐẶC SẢN QUẢNG NGÃI · CÓ HÀNG TẠI TP.HCM
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 80,
            fontWeight: 800,
            marginTop: 24,
            lineHeight: 1.15,
            color: "#2c3826",
          }}
        >
          <span>Cá Bống Sông Trà</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            marginTop: 26,
            color: "#6e746b",
          }}
        >
          Hương vị quê nhà, tiện cho bữa cơm gia đình.
        </div>
      </div>
    ),
    size
  );
}
