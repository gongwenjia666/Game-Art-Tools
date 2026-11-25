/* 法阵提取精度客观测试：仿真真实条件（斜透视椭圆 + 光晕 + 噪点 + 渐变底 + 角色遮挡） */
const fs=require("fs"), zlib=require("zlib");

const html=fs.readFileSync("magic-circle.html","utf8");
const s1=html.indexOf("/* ==================== PURE START"), e1=html.indexOf("/* ==================== PURE END");
const pure=html.slice(s1,e1);
const s2=html.indexOf("/* ---------------- 椭圆拟合 ---------------- */");
const e2=html.indexOf("/* ---------------- 叠加层 ---------------- */");
const app=html.slice(s2,e2);
let __PH=0,__PW=0,__mpX=null,__apX=null,__respX=null;
const pureI=pure
  .replace("  // --- 映射回笛卡尔","  globalThis.__X={mp,ap,resp,PW,PH};\n  // --- 映射回笛卡尔")
  .replace("  // --- 厚度过滤：","  globalThis.__mpA=mp.slice();\n  // --- 厚度过滤：")
  .replace("  // --- alpha 横截面：","  globalThis.__mpB=mp.slice();\n  // --- alpha 横截面：");
const mod={};
new Function("exports", pureI+app+"\nexports.fitEllipse=fitEllipse; exports.refineEllipse=refineEllipse; exports.autoClean=autoClean; exports.FLAT_ROI=FLAT_ROI;")(mod);
const {fitEllipse,refineEllipse,autoClean,FLAT_ROI}=mod;

/* PNG 编码 */
function crc32(buf){let c=0xFFFFFFFF;for(let n=0;n<buf.length;n++){let x=(c^buf[n])&0xFF;for(let k=0;k<8;k++)x=x&1?(0xEDB88320^(x>>>1)):(x>>>1);c=(c>>>8)^x;}return (c^0xFFFFFFFF)>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const b=Buffer.concat([Buffer.from(t,"ascii"),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(b));return Buffer.concat([l,b,c]);}
function writePNG(p,w,h,rgba){
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;for(let x=0;x<w;x++){const si=(y*w+x)*4,di=y*(w*4+1)+1+x*4;raw[di]=rgba[si];raw[di+1]=rgba[si+1];raw[di+2]=rgba[si+2];raw[di+3]=rgba[si+3];}}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  fs.writeFileSync(p,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",ih),chunk("IDAT",zlib.deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]));
}

/* 场景：斜透视法阵 */
const T={cx:702,cy:468,A:520,B:326,ang:0.23};
const IW=1400, IH=960;
const caT=Math.cos(T.ang), saT=Math.sin(T.ang);
const toUV=(px,py)=>{
  const dx=px-T.cx, dy=py-T.cy;
  const rx= caT*dx+saT*dy, ry=-saT*dx+caT*dy;
  return {u:rx/T.A, v:ry/T.B};
};
const src=new Uint8ClampedArray(IW*IH*4);
const put=(x,y,r,g,b,a)=>{
  a=a===undefined?255:a;
  x=Math.round(x); y=Math.round(y);
  if(x<0||y<0||x>=IW||y>=IH) return;
  const o=(y*IW+x)*4;
  const al=a/255;
  src[o]  =Math.min(255, src[o]  *(1-al)+r*al);
  src[o+1]=Math.min(255, src[o+1]*(1-al)+g*al);
  src[o+2]=Math.min(255, src[o+2]*(1-al)+b*al);
  src[o+3]=255;
};
for(let y=0;y<IH;y++)for(let x=0;x<IW;x++){
  const o=(y*IW+x)*4;
  const gx=x/IW, gy=y/IH;
  const vig=1-0.5*Math.hypot(gx-0.5,gy-0.5)*1.4;
  const n=(Math.sin(x*12.9898+y*78.233)*43758.5453%1)*10-5;
  src[o]=16*vig+n; src[o+1]=14*vig+n*0.8; src[o+2]=30*vig+n*1.2; src[o+3]=255;
}
for(let y=0;y<IH;y++)for(let x=0;x<IW;x++){
  const uv=toUV(x+0.5,y+0.5);
  const rr=Math.hypot(uv.u,uv.v);
  if(rr<1.6){ const g=(1-rr/1.6)*26; put(x,y,30+g,50+g,90+g,90); }
}
const ringF=[0.965,0.845,0.615,0.385];
const spokeN=28, spokeW=1.4;
function drawRing(f,w,core,glow){
  const rad=w*0.5;
  const CIRC=Math.PI*2*((f*T.A+f*T.B)/2);
  for(let t=0;t<CIRC*2;t+=0.35){
    const th=t/2;
    const u=Math.cos(th)*f, v=Math.sin(th)*f;
    const px=T.cx+caT*T.A*u-saT*T.B*v, py=T.cy+saT*T.A*u+caT*T.B*v;
    const R=Math.ceil(rad)+1;
    for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){
      const d=Math.hypot(dx,dy);
      if(d<=rad+0.4) put(px+dx,py+dy,core[0],core[1],core[2],230);
      else if(d<=rad+2.2) put(px+dx,py+dy,glow[0],glow[1],glow[2],Math.round(70*(1-(d-rad-0.4)/1.8)));
    }
  }
}
function drawSpokes(inner,outer){
  for(let k=0;k<spokeN;k++){
    const th=k/spokeN*Math.PI*2;
    const steps=Math.round((outer-inner)*((T.A+T.B)/2))*3;
    for(let t=0;t<=steps;t++){
      const f=inner+(outer-inner)*t/steps;
      const u=Math.cos(th)*f, v=Math.sin(th)*f;
      const px=T.cx+caT*T.A*u-saT*T.B*v, py=T.cy+saT*T.A*u+caT*T.B*v;
      put(px,py,175,215,255,220);
      put(px+0.5,py,175,215,255,150);
    }
  }
}
drawRing(0.965,3.0,[225,240,255],[120,180,255]);
drawRing(0.845,2.2,[205,230,255],[110,170,250]);
drawRing(0.615,2.0,[195,225,255],[100,160,250]);
drawRing(0.385,1.8,[185,220,255],[90,150,240]);
drawSpokes(0.20,0.945);
const BLOB={u:0.24,v:-0.10,au:0.115,av:0.19};
for(let y=0;y<IH;y++)for(let x=0;x<IW;x++){
  const uv=toUV(x+0.5,y+0.5);
  const du=(uv.u-BLOB.u)/BLOB.au, dv=(uv.v-BLOB.v)/BLOB.av;
  const dd=du*du+dv*dv;
  const o=(y*IW+x)*4;
  if(dd<1){ src[o]=208; src[o+1]=118; src[o+2]=92; }
  else if(dd<1.5){ src[o]=src[o]*0.5+60; src[o+1]=src[o+1]*0.5+35; src[o+2]=src[o+2]*0.5+27; }
}

/* 锚点（±7px 噪声） */
const anchors=[];
let seed=42;
const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff*2-1; };
for(let k=0;k<9;k++){
  const th=k/9*Math.PI*2+0.1;
  anchors.push({
    x:T.cx+caT*T.A*Math.cos(th)-saT*T.B*Math.sin(th)+rnd()*7,
    y:T.cy+saT*T.A*Math.cos(th)+caT*T.B*Math.sin(th)+rnd()*7
  });
}

console.log("== 椭圆精度 ==");
const e0=fitEllipse(anchors);
console.log("锚点拟合误差: dcx=%s dcy=%s dA=%s dB=%s",
  (e0.cx-T.cx).toFixed(1),(e0.cy-T.cy).toFixed(1),(e0.A-T.A).toFixed(1),(e0.B-T.B).toFixed(1));
const tE0=Date.now();
const eRef=refineEllipse(e0, src, IW, IH);
console.log("refineEllipse 耗时: "+(Date.now()-tE0)+"ms");
console.log("自动贴合误差: dcx=%s dcy=%s dA=%s dB=%s dang=%s",
  (eRef.cx-T.cx).toFixed(2),(eRef.cy-T.cy).toFixed(2),(eRef.A-T.A).toFixed(2),(eRef.B-T.B).toFixed(2),(eRef.ang-T.ang).toFixed(4));

/* 展平（复刻 renderFlat，S=1024, SS=2），同时记录真值掩膜 */
const S=1024, SS=2, adj=1;
const A=eRef.A*adj, B=eRef.B*adj, ca=Math.cos(eRef.ang), sa=Math.sin(eRef.ang);
const ROI=FLAT_ROI;
const flat=new Uint8ClampedArray(S*S*4);
const gtLine=new Uint8Array(S*S);
const gtKind=new Uint8Array(S*S); // 0=环 1=辐条
const gtCoreBlob=new Uint8Array(S*S);
const gtBlob=new Uint8Array(S*S);
const inv=1/(SS*SS);
for(let j=0;j<S;j++){
  for(let i=0;i<S;i++){
    const o=(j*S+i)*4;
    let ar=0,ag=0,ab=0,aw=0;
    const uC=(i+0.5)/S*2-1, vC=(j+0.5)/S*2-1;
    for(let sy=0;sy<SS;sy++){
      const v=(vC+(sy+0.5)/SS*(2/S))*ROI;
      for(let sx=0;sx<SS;sx++){
        const u=(uC+(sx+0.5)/SS*(2/S))*ROI;
        const rr=Math.sqrt(u*u+v*v);
        let mask=1;
        if(rr>1.045) continue;
        else if(rr>1.005) mask=(1.045-rr)/0.04;
        const px=eRef.cx+ca*(A*u)-sa*(B*v);
        const py=eRef.cy+sa*(A*u)+ca*(B*v);
        if(px<0||py<0||px>IW-1.001||py>IH-1.001) continue;
        const x0=px|0,y0=py|0,fx=px-x0,fy=py-y0;
        const i00=(y0*IW+x0)*4,i10=i00+4,i01=i00+IW*4,i11=i01+4;
        const w=inv*mask;
        ar+=w*((1-fy)*((1-fx)*src[i00]+fx*src[i10])+fy*((1-fx)*src[i01]+fx*src[i11]));
        ag+=w*((1-fy)*((1-fx)*src[i00+1]+fx*src[i10+1])+fy*((1-fx)*src[i01+1]+fx*src[i11+1]));
        ab+=w*((1-fy)*((1-fx)*src[i00+2]+fx*src[i10+2])+fy*((1-fx)*src[i01+2]+fx*src[i11+2]));
        aw+=w;
        const rrT=Math.hypot(u,adj?v:v);
        let isLine=false;
        for(const f of ringF) if(Math.abs(rrT-f)<3.0/A){ isLine=true; gtKind[j*S+i]=0; }
        if(rrT>0.20&&rrT<0.945){
          let th=Math.atan2(v,u);
          const frac=((th/(Math.PI*2)*spokeN)%1+1)%1;
          const dSpoke=Math.min(frac,1-frac);   // 到最近辐条中心的角距（辐条单位）
          if(dSpoke < (spokeW*0.5+2.0)*spokeN/(2*Math.PI*rrT*((A+B)/2))){ isLine=true; gtKind[j*S+i]=1; }
        }
        const du=(u-BLOB.u)/BLOB.au, dv=(v-BLOB.v)/BLOB.av;
        const inBlob=du*du+dv*dv<1.45;
        if(isLine&&!inBlob) gtLine[j*S+i]=1;
        if(du*du+dv*dv<1){ gtCoreBlob[j*S+i]=1; gtBlob[j*S+i]=1; }
        else if(inBlob) gtBlob[j*S+i]=1;
      }
    }
    if(aw<=1e-6){ flat[o+3]=0; continue; }
    flat[o]=ar/aw; flat[o+1]=ag/aw; flat[o+2]=ab/aw;
    flat[o+3]=Math.min(255,Math.round(255*aw));
  }
}
writePNG("_p_flat.png",S,S,flat);

const opt={thr:44,strokePct:6,edge:45,blobs:true,dark:false,struct:false};
const t0=Date.now();
const res=autoClean(flat,S,opt);
__PH=globalThis.__X.PH; __PW=globalThis.__X.PW; __mpX=globalThis.__X.mp; __apX=globalThis.__X.ap; __respX=globalThis.__X.resp;
const ms=Date.now()-t0;

console.log("\n== 提取指标（S=1024, "+ms+"ms）==");
let lineTot=0,lineKeep=0,lineSoft=0;
for(let i=0;i<S*S;i++){
  if(gtLine[i]){ lineTot++;
    const a=res.alpha[i];
    if(a>180) lineKeep++;
    else if(a>40) lineSoft++;
  }
}
console.log("线条完整保留(alpha>180): "+(lineKeep/lineTot*100).toFixed(1)+"%  半透明: "+(lineSoft/lineTot*100).toFixed(1)+"%  丢失: "+((1-lineKeep/lineTot-lineSoft/lineTot)*100).toFixed(1)+"%");
let blobTot=0,blobLeak=0;
for(let i=0;i<S*S;i++) if(gtCoreBlob[i]){ blobTot++; if(res.alpha[i]>32) blobLeak++; }
/* 指标改用「展平输入实际可见线条」作 GT：
   输入亮度>110（远高于底色噪声、低于线心）且不在角色区域的像素 */
const gtVis=new Uint8Array(S*S);
let junkCnt=0;
for(let i=0;i<S*S;i++){
  const o=i*4;
  const lum=Math.max(flat[o],flat[o+1],flat[o+2]);
  if(lum>110 && !gtBlob[i]) gtVis[i]=1;
}
let visTot=0,visKeep=0,visSoft=0;
for(let i=0;i<S*S;i++){
  if(!gtVis[i]) continue;
  visTot++;
  const a=res.alpha[i];
  if(a>180) visKeep++;
  else if(a>40) visSoft++;
}
console.log("可见线条保真(alpha>180): "+(visKeep/visTot*100).toFixed(1)+"%  半透明: "+(visSoft/visTot*100).toFixed(1)+"%  丢失: "+((1-visKeep/visTot-visSoft/visTot)*100).toFixed(1)+"%");
for(let i=0;i<S*S;i++){
  const o=i*4;
  const lum=Math.max(flat[o],flat[o+1],flat[o+2]);
  if(res.alpha[i]>180 && lum<70 && !gtBlob[i]) junkCnt++;
}
console.log("伪影像素(输出不透明但输入为背景): "+junkCnt);
/* 伪影按半径分布（临时诊断） */
{
  const CC=S/2, RRt=S*0.5/FLAT_ROI;
  const buckets={};
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const i=y*S+x, o=i*4;
    const lum=Math.max(flat[o],flat[o+1],flat[o+2]);
    if(res.alpha[i]>180 && lum<70 && !gtBlob[i]){
      const rb=Math.round(Math.hypot(x+0.5-CC,y+0.5-CC)/RRt*20)/20;
      buckets[rb]=(buckets[rb]||0)+1;
    }
  }
  console.log("伪影半径分布:", JSON.stringify(buckets));
}
let ringTot=0,ringKeep=0,spTot=0,spKeep=0,nearTot=0,nearKeep=0,farTot=0,farKeep=0;
for(let i=0;i<S*S;i++){
  if(!gtVis[i]) continue;
  const keep=res.alpha[i]>180?1:0;
  if(gtKind[i]===1){ spTot++; spKeep+=keep; } else { ringTot++; ringKeep+=keep; }
  if(gtBlob[i]){ nearTot++; nearKeep+=keep; } else { farTot++; farKeep+=keep; }
}
console.log("环保留: "+(ringKeep/ringTot*100).toFixed(1)+"%  辐条保留: "+(spKeep/spTot*100).toFixed(1)+"%");
/* 角色附近 = gtVis 且距角色核心（展平坐标）< 0.5 u 单位 */
let nTot2=0,nKeep2=0;
{
  const ROI2=FLAT_ROI, half2=S/2;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const i=y*S+x;
    if(!gtVis[i]) continue;
    const u2=((x+0.5)/half2-1)*ROI2, v2=((y+0.5)/half2-1)*ROI2;
    const du2=(u2-BLOB.u)/BLOB.au, dv2=(v2-BLOB.v)/BLOB.av;
    if(du2*du2+dv2*dv2<2.4){ nTot2++; if(res.alpha[i]>180) nKeep2++; }
  }
}
console.log("角色附近线条保留: "+(nTot2?(nKeep2/nTot2*100).toFixed(1):"n/a")+"%  远离角色: "+(farKeep/farTot*100).toFixed(1)+"%");
// 每根辐条分角度保留率（定位各向异性问题）：按真值角度采样（允许 3px 容差带内取最大 alpha）
const CS2=S/2, Rt2=S*0.5/FLAT_ROI;
for(let k=0;k<spokeN;k++){
  let tot=0,keep=0;
  for(let t=0.22;t<0.93;t+=0.002){
    const th=k/spokeN*Math.PI*2;
    const x=Math.round(CS2+Math.cos(th)*t*Rt2), y=Math.round(CS2+Math.sin(th)*t*Rt2);
    if(x<0||y<0||x>=S||y>=S) continue;
    tot++;
    let mA2=0;
    for(let ddy=-3;ddy<=3;ddy++)for(let ddx=-3;ddx<=3;ddx++){
      const xx=x+ddx, yy=y+ddy;
      if(xx<0||yy<0||xx>=S||yy>=S) continue;
      const a2=res.alpha[yy*S+xx];
      if(a2>mA2) mA2=a2;
    }
    if(mA2>180) keep++;
  }
  console.log("辐条 "+String(k).padStart(2)+" θ="+(k/spokeN*360).toFixed(0).padStart(3)+"°  保留 "+(keep/tot*100).toFixed(0)+"%");
}
console.log("角色核心残留: "+(blobLeak/blobTot*100).toFixed(2)+"%  (blobPx="+res.blobPx+")");

/* 探查 θ=0° / θ=270° 辐条：GT 采样带 vs 实际亮带位置（临时诊断） */
{
  const probe=(thDeg)=>{
    const th=thDeg/180*Math.PI;
    for(const t of [0.4,0.6,0.8]){
      const cxp=CS2+Math.cos(th)*t*Rt2, cyp=CS2+Math.sin(th)*t*Rt2;
      // GT 采样点附近 25×25 内：输入亮带(lum>110)的质心 vs 输出 alpha>180 的质心
      let ix=0,iy=0,inum=0, ox=0,oy=0,onum=0;
      for(let dy=-12;dy<=12;dy++)for(let dx=-12;dx<=12;dx++){
        const xx=Math.round(cxp)+dx, yy=Math.round(cyp)+dy;
        if(xx<0||yy<0||xx>=S||yy>=S) continue;
        const i2=yy*S+xx, o2=i2*4;
        const l2=Math.max(flat[o2],flat[o2+1],flat[o2+2]);
        if(l2>110){ ix+=xx; iy+=yy; inum++; }
        if(res.alpha[i2]>180){ ox+=xx; oy+=yy; onum++; }
      }
      console.log("θ="+thDeg+" t="+t+" GT采样("+Math.round(cxp)+","+Math.round(cyp)+") 输入亮带质心("+(inum?(ix/inum).toFixed(1):"-")+","+(inum?(iy/inum).toFixed(1):"-")+"×"+inum+") 输出质心("+(onum?(ox/onum).toFixed(1):"-")+","+(onum?(oy/onum).toFixed(1):"-")+"×"+onum+")");
    }
  };
  probe(0); probe(270); probe(90);
}

/* 诊断：角色区域残留 alpha 分层统计（定位深色弧线来源） */
{
  const ROI2=FLAT_ROI, half2=S/2;
  let coreA8=0,coreA32=0,blendA8=0,blendA32=0,blendDark=0;
  let arcSample=[];
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const i=y*S+x;
    const u2=((x+0.5)/half2-1)*ROI2, v2=((y+0.5)/half2-1)*ROI2;
    const du2=(u2-BLOB.u)/BLOB.au, dv2=(v2-BLOB.v)/BLOB.av;
    const dd2=du2*du2+dv2*dv2;
    const o=i*4;
    const lum2=Math.max(flat[o],flat[o+1],flat[o+2]);
    if(dd2<1){ if(res.alpha[i]>8)coreA8++; if(res.alpha[i]>32)coreA32++; }
    else if(dd2<1.45){
      if(res.alpha[i]>8)blendA8++;
      if(res.alpha[i]>32)blendA32++;
      if(res.alpha[i]>8 && lum2<70) blendDark++;
    }
  }
  console.log("角色核心: alpha>8 = "+coreA8+", alpha>32 = "+coreA32);
  console.log("角色软边(dd<1.45): alpha>8 = "+blendA8+", alpha>32 = "+blendA32+", 其中暗残留 = "+blendDark);
  /* 暗残留的空间分布：采样若干点打印坐标与 alpha */
  let shown=0;
  for(let y=0;y<S&&shown<8;y++)for(let x=0;x<S&&shown<8;x++){
    const i=y*S+x;
    const u2=((x+0.5)/half2-1)*ROI2, v2=((y+0.5)/half2-1)*ROI2;
    const du2=(u2-BLOB.u)/BLOB.au, dv2=(v2-BLOB.v)/BLOB.av;
    const dd2=du2*du2+dv2*dv2;
    const o=i*4;
    const lum2=Math.max(flat[o],flat[o+1],flat[o+2]);
    if(dd2>=1&&dd2<1.45&&res.alpha[i]>8&&lum2<70){
      console.log("  暗残留 @("+x+","+y+") u="+u2.toFixed(3)+" v="+v2.toFixed(3)+" r="+Math.hypot(u2,v2).toFixed(3)+" alpha="+res.alpha[i]+" inLum="+lum2.toFixed(0)+" rgb="+res.rgb[i*3]+","+res.rgb[i*3+1]+","+res.rgb[i*3+2]);
      shown++;
    }
  }
}

console.log("\n== 边缘锐度（10%-90% 过渡宽度，px，越窄越好）==");
const C=S/2, Rt=S*0.5/FLAT_ROI;
for(const f of ringF){
  let wsum=0,n=0;
  for(let k=0;k<64;k++){
    const th=k/64*Math.PI*2;
    const prof=[];
    for(let d=-4;d<=4;d++){
      const rr=f*Rt+d;
      const x2=Math.round(C+Math.cos(th)*rr), y2=Math.round(C+Math.sin(th)*rr);
      prof.push(res.alpha[y2*S+x2]);
    }
    const mx=Math.max.apply(null,prof);
    if(mx<100) continue;
    let i0=0,i1=prof.length-1;
    while(i0<prof.length&&prof[i0]<mx*0.1)i0++;
    while(i1>0&&prof[i1]<mx*0.1)i1--;
    wsum+=(i1-i0); n++;
  }
  if(n) console.log("环 r="+f+"  过渡宽度≈"+(wsum/n).toFixed(2)+" px");
}
console.log("\n== 半径精度（输出圆半径 vs 真值）==");
for(const f of ringF){
  let sr=0,sw=0;
  for(let y=0;y<S;y+=2)for(let x=0;x<S;x+=2){
    const i=y*S+x, a=res.alpha[i];
    if(a<60) continue;
    const rr=Math.hypot(x+0.5-C,y+0.5-C);
    if(Math.abs(rr-f*Rt)>3) continue;
    sr+=rr*a; sw+=a;
  }
  if(sw) console.log("环 r="+f+"  实测 "+(sr/sw).toFixed(2)+" (偏差 "+(sr/sw-f*Rt).toFixed(2)+" px)");
}

const prev=new Uint8ClampedArray(S*S*4);
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const i=y*S+x, o=i*4;
  const chk=(((x>>4)+(y>>4))&1)?46:32;
  const a=res.alpha[i];
  if(a>8){
    prev[o]=res.rgb[i*3]; prev[o+1]=res.rgb[i*3+1]; prev[o+2]=res.rgb[i*3+2]; prev[o+3]=255;
    const lumI=Math.max(flat[o],flat[o+1],flat[o+2]);
    if(a>180 && lumI<70 && !gtBlob[i]){ prev[o]=70; prev[o+1]=110; prev[o+2]=255; }
    else if(gtVis[i]&&a<120){ prev[o]=255; prev[o+1]=60; prev[o+2]=60; }
  } else {
    prev[o]=chk; prev[o+1]=chk; prev[o+2]=chk+8; prev[o+3]=255;
    if(gtVis[i]){ prev[o]=255; prev[o+1]=40; prev[o+2]=40; prev[o+3]=255; }
  }
}
writePNG("_p_out.png",S,S,prev);
console.log("== 交叉点探查 ==");
for(let k=0;k<spokeN;k+=4){
  const th=k/spokeN*Math.PI*2;
  let found=0;
  for(let rr2=0.83;rr2<0.86;rr2+=0.0005){
    const x2=Math.round(CS2+Math.cos(th)*rr2*Rt2), y2=Math.round(CS2+Math.sin(th)*rr2*Rt2);
    const i2=y2*S+x2, a2=res.alpha[i2], o2=i2*4;
    const l2=Math.max(flat[o2],flat[o2+1],flat[o2+2]);
    if(gtVis[i2]&&a2<120&&found<2){ found++;
      console.log("辐条"+k+" r="+rr2.toFixed(3)+" inLum="+l2+" alpha="+a2);
    }
  }
}
console.log("== 失败交叉点极坐标中间量（辐条12, r=0.839）==");
{
  const th=12/spokeN*Math.PI*2, rpx=0.839*Rt2;
  const x2=Math.round(CS2+Math.cos(th)*rpx), y2=Math.round(CS2+Math.sin(th)*rpx);
  console.log("笛卡尔像素("+x2+","+y2+") alpha="+res.alpha[y2*S+x2]);
  const mA=globalThis.__mpA, mB=globalThis.__mpB;
  const fy3=rpx/(Rt2*1.05)*__PH-0.5, fx3=th/(Math.PI*2)*__PW-0.5;
  for(let dy=-3;dy<=3;dy++){
    let rowS="";
    for(let dx=-3;dx<=3;dx++){
      const yy=Math.round(fy3)+dy, xx=((Math.round(fx3)+dx)%__PW+__PW)%__PW;
      if(yy<0||yy>=__PH){ rowS+="  ----  "; continue; }
      const pi3=yy*__PW+xx;
      // A=初筛后 B=连通域过滤后 X=最终  (resp)
      rowS+=("["+(__mpX[pi3]?"1":"0")+"/"+(mA[pi3]?"1":"0")+"/"+(mB[pi3]?"1":"0")+"]"+Math.round(__respX[pi3])).padStart(11);
    }
    console.log(rowS);
  }
}
console.log("\n输出: _p_flat.png(展平输入) _p_out.png(提取结果)");
