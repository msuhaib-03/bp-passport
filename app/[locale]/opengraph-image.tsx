import { ImageResponse } from "next/og";

export const alt = "BP Passport — understand your blood pressure and take one clear next step";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#edf4ef", color: "#07383a", padding: "72px 82px" }}>
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: 250, background: "#d3eee7", right: -100, top: -130 }} />
      <div style={{ position: "absolute", width: 340, height: 340, borderRadius: 170, border: "2px solid #78cfc3", right: 52, bottom: -150 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 32, fontWeight: 800 }}>
          <div style={{ width: 66, height: 66, borderRadius: 18, background: "#07383a", color: "#8fe2d7", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 20, fontSize: 30 }}>BP</div>
          BP Passport
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 840 }}>
          <div style={{ color: "#078679", fontSize: 22, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>Blood pressure, understood</div>
          <div style={{ marginTop: 18, fontSize: 68, lineHeight: 1.05, fontWeight: 800, letterSpacing: -3 }}>Your health. One clear next step.</div>
          <div style={{ marginTop: 25, fontSize: 27, color: "#55706a" }}>Free · Bilingual · Privacy-first · Built for Pakistan</div>
        </div>
      </div>
    </div>,
    size,
  );
}
