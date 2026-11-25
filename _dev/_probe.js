/* 探查 θ=0° 辐条在展平面中的实际位置 vs GT 采样位置 */
const fs=require("fs");
const html=fs.readFileSync("magic-circle.html","utf8");
const s1=html.indexOf("/* ==================== PURE START"), e1=html.indexOf("/* ==================== PURE END");
const pure=html.slice(s1,e1);
const s2=html.indexOf("/* ---------------- 椭圆拟合 ---------------- */");
const e2=html.indexOf("/* ---------------- 叠加层 ---------------- */");
const app=html.slice(s2,e2);
const mod={};
new Function("exports", pure+app+"\nexports.fitEllipse=fitEllipse; exports.refineEllipse=refineEllipse; exports.FLAT_ROI=FLAT_ROI;")(mod);
console.log("FLAT_ROI =", mod.FLAT_ROI);
