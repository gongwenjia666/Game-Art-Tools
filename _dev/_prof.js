/* 径向剖面对比：输出 alpha vs 输入亮度，定位线条变细/变弱的环节 */
const fs=require("fs");
const html=fs.readFileSync("magic-circle.html","utf8");
const s1=html.indexOf("/* ==================== PURE START"), e1=html.indexOf("/* ==================== PURE END");
let code=html.slice(s1,e1);
code=code.replace("  // --- 映射回笛卡尔","  globalThis.__mp=mp; globalThis.__ap=ap; globalThis.__resp=resp; globalThis.__env=env; globalThis.__PW=PW; globalThis.__PH=PH; globalThis.__m=m; globalThis.__lo=lo;\n  // --- 映射回笛卡尔");
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
// 环：核心 2.8px（230 不透明）+ 外侧光晕 1.8px 渐弱
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const rr=Math.hypot((x+0.5-C)/R,(y+0.5-C)/R);
  const d=(rr-0.845)*R;   // 距环心 px，内侧为负
  if(d>=-1.4&&d<=1.4) put(x,y,205,230,255,230);
  else if(d>1.4&&d<=3.2) put(x,y,120,180,250,Math.round(70*(1-(d-1.4)/1.8)));
}
const res=mod.autoClean(rgba,S,{thr:44,strokePct:6,edge:45,blobs:true,dark:false,struct:false});
const PW=globalThis.__PW, PH=globalThis.__PH;
console.log("PW="+PW+" PH="+PH+" m="+globalThis.__m+" lo="+globalThis.__lo.toFixed(1));
// 取 θ=45° 方向剖面
const th=Math.PI/4;
console.log(" d(px) | 输入Lum | resp | env | ap | 输出alpha");
const rowF=0.845/1.05*PH;
for(let d=-5;d<=5;d++){
  const rr=(0.845+d/R)*R;
  const x=C+Math.cos(th)*rr, y=C+Math.sin(th)*rr;
  const xi=Math.round(x), yi=Math.round(y);
  const o=(yi*S+xi)*4;
  const lum=Math.max(rgba[o],rgba[o+1],rgba[o+2]);
  // 极坐标采样
  const rrN=rr/(R*1.05);
  const fy=rrN*PH-0.5, y0=Math.max(0,Math.min(PH-1,Math.floor(fy)));
  const fx2=Math.atan2(Math.sin(th),Math.cos(th))/(Math.PI*2)*PW-0.5;
  const x0=((Math.floor(fx2)%PW)+PW)%PW;
  const pi=y0*PW+x0;
  console.log(" "+String(d).padStart(4)+" | "+lum.toFixed(0).padStart(7)+" | "+globalThis.__resp[pi].toFixed(1).padStart(4)+" | "+globalThis.__env[pi].toFixed(1).padStart(5)+" | "+globalThis.__ap[pi].toFixed(2).padStart(4)+" | "+res.alpha[yi*S+xi]);
}
