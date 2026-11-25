/* 自包含诊断：合成法阵图 → 逐步复现 autoClean 各阶段 → 定位丢失环节 */
const fs=require("fs");
const html=fs.readFileSync("magic-circle.html","utf8");
const s=html.indexOf("/* ==================== PURE START"), e=html.indexOf("/* ==================== PURE END");
const mod={};
new Function("exports", html.slice(s,e)+
  "\nexports.autoClean=autoClean; exports.FLAT_ROI=FLAT_ROI; exports.polarLum=polarLum; exports.morph2D=morph2D; exports.labelRect=labelRect; exports.buildBackground=buildBackground; exports.chamferDT=chamferDT; exports.dilate=dilate;")(mod);
const {autoClean,FLAT_ROI,polarLum,morph2D,labelRect}=mod;

/* ---------- 合成（与 _t2.js 相同） ---------- */
const S=1024, R=S*0.5/FLAT_ROI, cx=S/2, cy=S/2;
const rgba=new Uint8ClampedArray(S*S*4);
const rings=[
  {r:0.966,w:3.0,i:1.00,c:[0.78,0.96,1.00]},
  {r:0.928,w:1.6,i:0.50,c:[0.78,0.96,1.00]},
  {r:0.872,w:5.0,i:0.62,c:[1.00,0.86,0.55]},
  {r:0.640,w:2.0,i:0.85,c:[0.78,0.96,1.00]},
  {r:0.520,w:1.4,i:0.38,c:[0.78,0.96,1.00]},
  {r:0.300,w:2.4,i:0.75,c:[1.00,0.90,0.70]},
];
const bl={x:cx+0.30*R, y:cy+0.10*R, a:0.20*R, b:0.34*R, ang:0.35};
const ca0=Math.cos(bl.ang), sa0=Math.sin(bl.ang);
function rnd(i){ const v=Math.sin(i*12.9898+i*0.0007*78.233)*43758.5453; return v-Math.floor(v); }
for(let y=0;y<S;y++){
  for(let x=0;x<S;x++){
    const i=y*S+x, dx=x+0.5-cx, dy=y+0.5-cy;
    const rp=Math.hypot(dx,dy), rn=rp/R;
    const glow=Math.pow(Math.max(0,1-Math.min(1,rn)),2.2)*0.20;
    const vig=Math.max(0,1-rn*0.55);
    let r=0.030+glow*0.9+vig*0.012, g=0.028+glow*0.75+vig*0.010, b=0.055+glow*1.15+vig*0.014;
    const n=(rnd(i)-0.5)*0.012; r+=n; g+=n; b+=n;
    for(const rg of rings){
      const d=Math.abs(rn-rg.r)*R;
      if(d<=rg.w/2+1){
        const cov=Math.max(0,Math.min(1, 0.5+(rg.w/2-d)));
        r+=cov*rg.i*rg.c[0]; g+=cov*rg.i*rg.c[1]; b+=cov*rg.i*rg.c[2];
      }
    }
    let a=Math.atan2(dy,dx); if(a<0)a+=Math.PI*2;
    const sa=a/(Math.PI*2)*24, kk=Math.round(sa);
    const dAng=Math.abs(sa-kk)/24*Math.PI*2*rp;
    if(rp>0.17*R && rp<0.935*R && dAng<=2.25){
      const cov=Math.max(0,Math.min(1,0.5+(1.25-dAng)));
      r+=cov*0.55*0.72; g+=cov*0.55*0.90; b+=cov*0.55*1.0;
    }
    const bx=x+0.5-bl.x, by=y+0.5-bl.y;
    const u= ca0*bx+sa0*by, v=-sa0*bx+ca0*by;
    if((u*u)/(bl.a*bl.a)+(v*v)/(bl.b*bl.b)<=1){
      const shade=0.34+0.16*(-v/bl.b);
      r=0.62*shade+0.20; g=0.40*shade+0.12; b=0.34*shade+0.10;
    }
    const sdx=(cx+0.55*R)-(cx-0.45*R), sdy=(cy-0.45*R)-(cy+0.30*R);
    const L2=sdx*sdx+sdy*sdy;
    let tt=((x+0.5-(cx-0.45*R))*sdx+(y+0.5-(cy+0.30*R))*sdy)/L2;
    if(tt>=0&&tt<=1){
      const px=cx-0.45*R+tt*sdx, py=cy+0.30*R+tt*sdy;
      const d=Math.hypot(x+0.5-px, y+0.5-py);
      if(d<=6.5+1){
        const cov=Math.max(0,Math.min(1,0.5+(6.5-d)));
        r=r*(1-cov)+cov*0.95; g=g*(1-cov)+cov*0.97; b=b*(1-cov)+cov*1.0;
      }
    }
    const o=i*4;
    rgba[o]=Math.min(255,Math.round(r*255));
    rgba[o+1]=Math.min(255,Math.round(g*255));
    rgba[o+2]=Math.min(255,Math.round(b*255));
    rgba[o+3]=255;
  }
}

/* ---------- 逐步复现 ---------- */
const PW=Math.max(720, Math.min(2400, Math.round(Math.PI*2*R)));
const PH=Math.max(256, Math.min(1100, Math.round(R*1.08)));
const N=PW*PH;
const {L,valid}=polarLum(rgba,S,PW,PH);
const m=Math.max(2, Math.min(36, Math.round(R*6/100)));
const op=Float32Array.from(L); morph2D(op,PW,PH,m,false); morph2D(op,PW,PH,m,true);
const resp=new Float32Array(N); let vmax=0;
for(let i=0;i<N;i++){ resp[i]=valid[i]?Math.max(0,L[i]-op[i]):0; if(resp[i]>vmax)vmax=resp[i]; }
console.log("PW",PW,"PH",PH,"m",m,"vmax",vmax.toFixed(1));

const hist=new Int32Array(256); let tot=0;
for(let i=0;i<N;i++){ if(!valid[i]) continue; hist[Math.min(255,Math.round(resp[i]/vmax*255))]++; tot++; }
for(const q of [0.5,0.75,0.85,0.90,0.95,0.97]){
  let a2=0,v2=0;
  for(let l=0;l<256;l++){ a2+=hist[l]; if(a2>=tot*q){ v2=l; break; } }
  console.log("p"+(q*100)+" resp =", (v2*vmax/255).toFixed(1));
}
console.log("resp>40 占比", (hist.slice(41).reduce((a,b)=>a+b,0)/tot*100).toFixed(2)+"%");
console.log("resp>80 占比", (hist.slice(81).reduce((a,b)=>a+b,0)/tot*100).toFixed(2)+"%");

const lo=Math.max(2.5, 59*vmax/255*2.2, vmax*0.02);
const mp=new Uint8Array(N);
for(let i=0;i<N;i++) mp[i]=(valid[i]&&resp[i]>=lo)?1:0;
const lr=labelRect(mp,PW,PH);
const minA=Math.max(8, Math.round(N*0.000008));
let kept=0;
for(const c of lr.comps) if(c.area>=minA) kept++;
console.log("lo =",lo.toFixed(2)," 连通域",lr.comps.length,"其中面积达标",kept);

/* R5 在远离角色的角度上是否进入 mp：角 2.0 rad */
const ci=Math.floor(2.0/(Math.PI*2)*PW);
for(let rn=0.514; rn<=0.526; rn+=0.002){
  const j=Math.round(rn/FLAT_ROI*PH-0.5);
  const i=j*PW+ci;
  console.log("R5@2.0rad rn="+rn.toFixed(3), "L="+L[i].toFixed(0), "resp="+resp[i].toFixed(1), "mp="+mp[i]);
}

/* ---------- 跑完整 autoClean，检查 R5 ---------- */
const res=autoClean(rgba,S,{thr:44,strokePct:6,edge:45,blobs:true,dark:false,struct:false});
console.log("lo 应为", Math.max(2.5,17*vmax/255*2.2, vmax*0.02).toFixed(2));
for(let rn=0.514; rn<=0.526; rn+=0.002){
  const rp=rn*R, ang=2.0;
  const x=Math.round(cx+Math.cos(ang)*rp), y=Math.round(cy+Math.sin(ang)*rp);
  const i=y*S+x;
  console.log("R5@2.0 rn="+rn.toFixed(3), "srcL="+Math.max(rgba[i*4],rgba[i*4+1],rgba[i*4+2]), "alpha="+res.alpha[i]);
}
// 环5 全圈 alpha>128 的比例（排除角色区）
let t5=0,k5=0;
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const dx=x+0.5-cx, dy=y+0.5-cy;
  const rn=Math.hypot(dx,dy)/R;
  if(Math.abs(rn-0.520)>1.4/R/2) continue;
  const bx=x+0.5-bl.x, by=y+0.5-bl.y;
  const u= ca0*bx+sa0*by, v=-sa0*bx+ca0*by;
  if((u*u)/(bl.a*bl.a)+(v*v)/(bl.b*bl.b)<=1) continue;
  t5++;
  const i=y*S+x;
  if(res.alpha[i]>128) k5++;
}
console.log("R5 全圈(去角色) alpha>128 比例:", (k5/t5*100).toFixed(1)+"%", "采样", t5);

/* ---------- 手动复现后续阶段，定位 R5 死因 ---------- */
const {chamferDT,dilate,buildBackground}=mod;
const bg=buildBackground(rgba,S);
// 内容粗掩膜 + DT（与 autoClean 相同）
const T2=Math.max(10, 44*0.75);
const cm=new Uint8Array(S*S);
for(let i=0;i<S*S;i++){
  const o=i*4;
  if(rgba[o+3]<128) continue;
  const dr=rgba[o]-bg[i*3], dg=rgba[o+1]-bg[i*3+1], db=rgba[o+2]-bg[i*3+2];
  if(Math.sqrt(dr*dr+dg*dg+db*db)>T2) cm[i]=1;
}
const dt=chamferDT(cm,S);
const maxT=Math.max(8, m*2.2);
const solid=new Uint8Array(S*S); let sCnt=0;
for(let i=0;i<S*S;i++) if(cm[i] && dt[i]*2>maxT){ solid[i]=1; sCnt++; }
const zone=dilate(solid,S,Math.max(3,Math.round(maxT*0.55)));
console.log("solid 区域像素", sCnt, "zone 覆盖", zone.reduce((a,b)=>a+(b?1:0),0), "maxT",maxT.toFixed(0));
let zoneCnt=0;
for(let rn=0.516; rn<=0.523; rn+=0.002){
  const rp=rn*R, ang=2.0;
  const x=Math.round(cx+Math.cos(ang)*rp), y=Math.round(cy+Math.sin(ang)*rp);
  const i=y*S+x;
  if(zone[i]) zoneCnt++;
}
console.log("R5@2.0 在 blobZone 内的采样数:", zoneCnt);
