const fs=require("fs");
const src=fs.readFileSync("_t2.js","utf8");
// 重用 _t2.js 里合成图像的部分：截取到 writePNG 定义之后、跑算法之前
const cut=src.indexOf("/* ---------- 跑算法 ---------- */");
const head=src.slice(0,cut);
const html=fs.readFileSync("magic-circle.html","utf8");
const s=html.indexOf("/* ==================== PURE START"), e=html.indexOf("/* ==================== PURE END");
const mod={};
new Function("exports", html.slice(s,e)+"\nexports.polarLum=polarLum; exports.morph2D=morph2D; exports.FLAT_ROI=FLAT_ROI; exports.labelRect=labelRect;")(mod);
const {polarLum,morph2D,FLAT_ROI,labelRect}=mod;
eval(head.replace("const fs=require(\"fs\"), zlib=require(\"zlib\");","const fs=require(\"fs\"), zlib=require(\"zlib\"); const __stop=true;").replace(/writePNG\("_in2[^)]*\);/,""));

const S2=S, R2=R;
const PW=Math.max(720, Math.min(2400, Math.round(Math.PI*2*R2)));
const PH=Math.max(256, Math.min(1100, Math.round(R2*1.08)));
const {L,valid}=polarLum(rgba,S2,PW,PH);
const m=Math.max(2, Math.min(36, Math.round(R2*6/100)));
const op=Float32Array.from(L); morph2D(op,PW,PH,m,false); morph2D(op,PW,PH,m,true);
const resp=new Float32Array(PW*PH);
let vmax=0;
for(let i=0;i<PW*PH;i++){ resp[i]=Math.max(0,L[i]-op[i]); if(resp[i]>vmax)vmax=resp[i]; }
console.log("PW",PW,"PH",PH,"m",m,"vmax",vmax.toFixed(1));
// 沿角 0.3rad 打半径剖面
const ang=0.3, ci=Math.floor(ang/(Math.PI*2)*PW);
console.log("rn -> L / resp / op (找环)");
for(let rn=0.24; rn<1.0; rn+=0.004){
  const j=Math.round(rn/FLAT_ROI*PH-0.5);
  if(j<0||j>=PH) continue;
  const i=j*PW+ci;
  const rr=rings.map((g,k)=>Math.abs(rn-g.r)<0.006?("R"+(k+1)):"").join("");
  if(rr||Math.round(rn*250)%8===0)
    console.log(rn.toFixed(3), rr.padEnd(4), "L="+L[i].toFixed(0), "op="+op[i].toFixed(0), "resp="+resp[i].toFixed(1));
}
