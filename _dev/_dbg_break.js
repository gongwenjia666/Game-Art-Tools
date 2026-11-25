/* 插桩定位内环断裂来源（简化圆盘法阵场景） */
const fs=require("fs");
const html=fs.readFileSync("magic-circle.html","utf8");
const s1=html.indexOf("/* ==================== PURE START"), e1=html.indexOf("/* ==================== PURE END");
let code=html.slice(s1,e1);
code=code.replace("  // --- alpha 横截面","  globalThis.__dbg={lo,vmax,mpCnt:mp.reduce((a,b)=>a+b,0)};\n  // --- alpha 横截面");
code=code.replace("  // --- 映射回笛卡尔","  globalThis.__blobZone=blobZone; globalThis.__mp=mp; globalThis.__ap=ap; globalThis.__PW=PW; globalThis.__PH=PH;\n  // --- 映射回笛卡尔");
const mod={};
new Function("exports", code+"\nexports.autoClean=autoClean; exports.FLAT_ROI=FLAT_ROI;")(mod);

const S=1024, R=S*0.5/mod.FLAT_ROI, C=S/2;
const rgba=new Uint8ClampedArray(S*S*4);
const put=(x,y,r,g,b,a)=>{
  a=a===undefined?255:a;
  x=Math.round(x); y=Math.round(y);
  if(x<0||y<0||x>=S||y>=S) return;
  const o=(y*S+x)*4, al=a/255;
  rgba[o]=Math.min(255,rgba[o]*(1-al)+r*al);
  rgba[o+1]=Math.min(255,rgba[o+1]*(1-al)+g*al);
  rgba[o+2]=Math.min(255,rgba[o+2]*(1-al)+b*al);
  rgba[o+3]=255;
};
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const u=(x+0.5-C)/R,v=(y+0.5-C)/R, rr=Math.hypot(u,v);
  const vig=1-0.4*rr;
  const n=(Math.sin(x*12.9898+y*78.233)*43758.5453%1)*10-5;
  const o=(y*S+x)*4;
  rgba[o]=16*vig+n; rgba[o+1]=14*vig+n; rgba[o+2]=30*vig+n; rgba[o+3]=255;
}
const ringF=[[0.965,3],[0.845,2.2],[0.615,2],[0.385,1.8]];
for(const [f,w] of ringF){
  const rad=w/2;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const rr=Math.hypot((x+0.5-C)/R,(y+0.5-C)/R);
    if(Math.abs(rr-f)<rad/R) put(x,y,205,230,255,230);
  }
}
for(let k=0;k<28;k++){
  const th=k/28*Math.PI*2;
  for(let t=0.20;t<0.945;t+=0.0012) put(C+Math.cos(th)*t*R,C+Math.sin(th)*t*R,175,215,255,220);
}
const BLOB={u:0.24,v:-0.10,au:0.115,av:0.19};
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const u=(x+0.5-C)/R,v=(y+0.5-C)/R;
  const du=(u-BLOB.u)/BLOB.au, dv=(v-BLOB.v)/BLOB.av, dd=du*du+dv*dv;
  const o=(y*S+x)*4;
  if(dd<1){ rgba[o]=208; rgba[o+1]=118; rgba[o+2]=92; }
  else if(dd<1.5){ rgba[o]=rgba[o]*0.5+60; rgba[o+1]=rgba[o+1]*0.5+35; rgba[o+2]=rgba[o+2]*0.5+27; }
}

const res=mod.autoClean(rgba,S,{thr:44,strokePct:6,edge:45,blobs:true,dark:false,struct:false});
console.log("lo=",globalThis.__dbg.lo.toFixed(1)," vmax=",globalThis.__dbg.vmax.toFixed(1),
  " mpCnt=",globalThis.__dbg.mpCnt," blobPx=",res.blobPx," contentCnt=",res.contentCnt);

const PW=globalThis.__PW, PH=globalThis.__PH, mp=globalThis.__mp, ap=globalThis.__ap;
const row=Math.round(0.385/1.05*PH);
console.log("极坐标内环行 y="+row+"/"+PH+", PW="+PW);
let out="";
const step=Math.max(1,Math.round(PW/120));
for(let i=0;i<PW;i+=step) out+=mp[row*PW+i]?"#":".";
console.log("mp:",out);
let out2="";
for(let i=0;i<PW;i+=step) out2+=ap[row*PW+i]>0.5?"#":ap[row*PW+i]>0.1?"+":".";
console.log("ap:",out2);
const bz=globalThis.__blobZone;
let hit=0;
if(bz){
  for(let a=-40;a<=40;a++){
    const th=a*Math.PI/180;
    const x=Math.round(C+Math.cos(th)*0.385*R), y=Math.round(C+Math.sin(th)*0.385*R);
    if(bz[y*S+x]) hit++;
  }
}
console.log("内环右段(-40°..40°)被 blobZone 覆盖:",hit,"/81");
