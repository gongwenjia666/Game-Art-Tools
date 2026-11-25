/* 探查辐条在极坐标各半径处的 mp/ap/alpha */
const fs=require("fs");
const html=fs.readFileSync("magic-circle.html","utf8");
const s1=html.indexOf("/* ==================== PURE START"), e1=html.indexOf("/* ==================== PURE END");
let code=html.slice(s1,e1);
code=code.replace("  // --- 映射回笛卡尔","  globalThis.__mp=mp; globalThis.__ap=ap; globalThis.__resp=resp; globalThis.__PW=PW; globalThis.__PH=PH; globalThis.__lo=lo; globalThis.__blobZone=blobZone;\n  // --- 映射回笛卡尔");
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
for(const [f,w] of [[0.965,3],[0.845,2.2],[0.615,2],[0.385,1.8]]){
  const rad=w/2;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const rr=Math.hypot((x+0.5-C)/R,(y+0.5-C)/R);
    if(Math.abs(rr-f)<rad/R) put(x,y,205,230,255,230);
  }
}
const spokeN=28;
for(let k=0;k<spokeN;k++){
  const th=k/spokeN*Math.PI*2;
  for(let t=0.20;t<0.945;t+=0.0012){
    put(C+Math.cos(th)*t*R,C+Math.sin(th)*t*R,175,215,255,220);
    put(C+Math.cos(th)*t*R+0.5,C+Math.sin(th)*t*R,175,215,255,150);
  }
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
const PW=globalThis.__PW, PH=globalThis.__PH, mp=globalThis.__mp, ap=globalThis.__ap, resp=globalThis.__resp;
console.log("PW="+PW+" PH="+PH+" lo="+globalThis.__lo.toFixed(1));
const k=7, th=k/spokeN*Math.PI*2;
console.log("辐条 theta="+(th*180/Math.PI).toFixed(1)+"deg");
for(const f of [0.30,0.50,0.70,0.90]){
  const row=Math.round(f/1.05*PH);
  const colF=th/(Math.PI*2)*PW;
  const col=Math.round(colF);
  let bestC=-1,bestR=-1;
  for(let dc=-4;dc<=4;dc++){
    const cc=((col+dc)%PW+PW)%PW;
    if(resp[row*PW+cc]>bestR){ bestR=resp[row*PW+cc]; bestC=cc; }
  }
  const i=row*PW+bestC;
  const x=Math.round(C+Math.cos(th)*f*R), y=Math.round(C+Math.sin(th)*f*R);
  console.log("r="+f+"  row"+row+" col"+bestC+"(off"+(bestC-col)+")  resp="+resp[i].toFixed(1)+" mp="+mp[i]+" ap="+ap[i].toFixed(2)
    +"  outAlpha="+res.alpha[y*S+x]+" blobZone="+(globalThis.__blobZone?globalThis.__blobZone[y*S+x]:0));
}
