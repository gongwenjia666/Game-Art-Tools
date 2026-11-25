const fs=require("fs"), zlib=require("zlib");
const html=fs.readFileSync("magic-circle.html","utf8");
const s=html.indexOf("/* ==================== PURE START"), e=html.indexOf("/* ==================== PURE END");
const mod={};
new Function("exports", html.slice(s,e)+
  "\nexports.autoClean=autoClean; exports.FLAT_ROI=FLAT_ROI; exports.refineEllipse=refineEllipse;")(mod);
const {autoClean,FLAT_ROI,refineEllipse}=mod;

/* ---------- PNG 输出 ---------- */
function crc32(buf){let c=0xFFFFFFFF;for(let n=0;n<buf.length;n++){let x=(c^buf[n])&0xFF;for(let k=0;k<8;k++)x=x&1?(0xEDB88320^(x>>>1)):(x>>>1);c=(c>>>8)^x;}return (c^0xFFFFFFFF)>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const b=Buffer.concat([Buffer.from(t,"ascii"),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(b));return Buffer.concat([l,b,c]);}
function writePNG(p,w,h,rgba){
  const raw=Buffer.alloc((w*4+1)*h);
  for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;for(let x=0;x<w;x++){const si=(y*w+x)*4,di=y*(w*4+1)+1+x*4;raw[di]=rgba[si];raw[di+1]=rgba[si+1];raw[di+2]=rgba[si+2];raw[di+3]=rgba[si+3];}}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  fs.writeFileSync(p,Buffer.concat([Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),chunk("IHDR",ihdr),chunk("IDAT",zlib.deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]));
}

/* ---------- 合成“斜视角法阵 + 角色遮挡”的展平图 ---------- */
const S=1024, R=S*0.5/FLAT_ROI, cx=S/2, cy=S/2;
const rgba=new Uint8ClampedArray(S*S*4);
const mRing=new Int16Array(S*S).fill(0), mSpoke=new Uint8Array(S*S), mBlob=new Uint8Array(S*S), mHalo=new Uint8Array(S*S);
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
// 角色手里的一把亮刀（细长亮条）
const sword={x0:cx-0.45*R, y0:cy+0.30*R, x1:cx+0.55*R, y1:cy-0.45*R, w:13};

function rnd(i){ const v=Math.sin(i*12.9898+i*0.0007*78.233)*43758.5453; return v-Math.floor(v); }

for(let y=0;y<S;y++){
  for(let x=0;x<S;x++){
    const i=y*S+x, dx=x+0.5-cx, dy=y+0.5-cy;
    const rp=Math.hypot(dx,dy), rn=rp/R;
    // 底色：中心亮晕 + 暗角 + 噪声
    const glow=Math.pow(Math.max(0,1-Math.min(1,rn)),2.2)*0.20;
    const vig=Math.max(0,1-rn*0.55);
    let r=0.030+glow*0.9+vig*0.012, g=0.028+glow*0.75+vig*0.010, b=0.055+glow*1.15+vig*0.014;
    const n=(rnd(i)-0.5)*0.012; r+=n; g+=n; b+=n;
    let isRing=false, isHalo=false, ringIdx=0;
    // 环
    for(let k=0;k<rings.length;k++){
      const rg=rings[k], d=Math.abs(rn-rg.r)*R;
      if(d<=rg.w/2+1){
        const cov=Math.max(0,Math.min(1, 0.5+(rg.w/2-d)));
        r+=cov*rg.i*rg.c[0]; g+=cov*rg.i*rg.c[1]; b+=cov*rg.i*rg.c[2];
        if(d<=rg.w/2){ isRing=true; ringIdx=k+1; }
      } else if(d<rg.w/2+7 && d>=rg.w/2+2){ isHalo=true; }
    }
    // 射线
    let a=Math.atan2(dy,dx); if(a<0)a+=Math.PI*2;
    const sa=a/(Math.PI*2)*24, kk=Math.round(sa);
    let dAng=Math.abs(sa-kk)/24*Math.PI*2*rp;
    if(rp>0.17*R && rp<0.935*R && dAng<=1.25+1){
      const cov=Math.max(0,Math.min(1,0.5+(1.25-dAng)));
      r+=cov*0.55*0.72; g+=cov*0.55*0.90; b+=cov*0.55*1.0;
      if(dAng<=1.25){ mSpoke[i]=1; }
    }
    // 角色块
    const bx=x+0.5-bl.x, by=y+0.5-bl.y;
    const u= ca0*bx+sa0*by, v=-sa0*bx+ca0*by;
    const q=(u*u)/(bl.a*bl.a)+(v*v)/(bl.b*bl.b);
    if(q<=1){
      const shade=0.34+0.16*(-v/bl.b);
      r=0.62*shade+0.20; g=0.40*shade+0.12; b=0.34*shade+0.10;
      mBlob[i]=1; isRing=false; mSpoke[i]=0; isHalo=false;
    }
    // 亮刀（细长高亮，属于角色，不应保留）
    const sdx=sword.x1-sword.x0, sdy=sword.y1-sword.y0;
    const L2=sdx*sdx+sdy*sdy;
    let tt=((x+0.5-sword.x0)*sdx+(y+0.5-sword.y0)*sdy)/L2;
    if(tt>=0&&tt<=1){
      const px=sword.x0+tt*sdx, py=sword.y0+tt*sdy;
      const d=Math.hypot(x+0.5-px, y+0.5-py);
      if(d<=sword.w/2+1){
        const cov=Math.max(0,Math.min(1,0.5+(sword.w/2-d)));
        r=r*(1-cov)+cov*0.95; g=g*(1-cov)+cov*0.97; b=b*(1-cov)+cov*1.0;
        if(d<=sword.w/2){ mBlob[i]=1; isRing=false; mSpoke[i]=0; isHalo=false; }
      }
    }
    const o=i*4;
    rgba[o]=Math.min(255,Math.round(r*255));
    rgba[o+1]=Math.min(255,Math.round(g*255));
    rgba[o+2]=Math.min(255,Math.round(b*255));
    rgba[o+3]=255;
    if(isRing) mRing[i]=ringIdx;
    if(isHalo && !isRing) mHalo[i]=1;
  }
}
writePNG("_in2.png",S,S,rgba);

/* ---------- 跑算法 ---------- */
function evalOpt(opt,label,detail){
  const t0=Date.now();
  const res=autoClean(rgba,S,opt);
  const ms=Date.now()-t0;
  const a=res.alpha;
  let ringT=0,ringK=0,spokeT=0,spokeK=0,blobT=0,blobK=0,haloT=0,haloK=0;
  for(let i=0;i<S*S;i++){
    if(mRing[i]>=1){ ringT++; if(a[i]>128)ringK++; }
    if(mSpoke[i]===1){ spokeT++; if(a[i]>128)spokeK++; }
    if(mBlob[i]===1){ blobT++; if(a[i]>128)blobK++; }
    if(mHalo[i]===1){ haloT++; if(a[i]>32)haloK++; }
  }
  const pc=v=>(v*100).toFixed(1)+"%";
  if(detail){
    for(let kk=1;kk<=rings.length;kk++){
      let row="  环"+kk+": ";
      for(let oct=0;oct<8;oct++){
        let tt=0,k2=0;
        for(let i=0;i<S*S;i++){
          if(mRing[i]!==kk) continue;
          const x=i%S, y=(i-x)/S;
          const ang=Math.atan2(y+0.5-cy,x+0.5-cx);
          if(((Math.round(ang/(Math.PI/4))+8)%8)!==oct) continue;
          tt++; if(a[i]>128)k2++;
        }
        row+=(tt?(k2/tt*100).toFixed(0)+"%":"--")+" ";
      }
      console.log(row);
    }
  }
  console.log(label.padEnd(22),
    "环保留",pc(ringK/ringT),
    "射线",pc(spokeK/spokeT),
    "角色残留",pc(blobK/blobT),
    "光晕误检",pc(haloK/haloT),
    ms+"ms");
  return res;
}

const def={thr:44,strokePct:6,edge:45,blobs:true,dark:false,struct:false};
const res1=evalOpt(def,"默认（默认参数）",true);
const res2=evalOpt({...def,struct:true},"+ 只留环/射线");
evalOpt({...def,thr:24},"阈值 24");
evalOpt({...def,edge:100},"边缘收紧 100");
evalOpt({...def,thr:80},"阈值 80");

/* ---------- 输出可视化：提取结果贴棋盘格 ---------- */
const out=new Uint8ClampedArray(S*S*4);
for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const i=y*S+x, o=i*4, al=res1.alpha[i]/255;
  const chk=((x>>4)+(y>>4))&1?44:30;
  out[o]  =res1.rgb[i*3]  *al + chk*(1-al);
  out[o+1]=res1.rgb[i*3+1]*al + chk*(1-al);
  out[o+2]=res1.rgb[i*3+2]*al + (chk+6)*(1-al);
  out[o+3]=255;
}
writePNG("_out2.png",S,S,out);

/* ---------- 椭圆贴合精度（带光晕 + 噪声 + 遮挡） ---------- */
const W=900,H=700;
const img2=new Uint8ClampedArray(W*H*4);
const T={cx:470,cy:330,A:350,B:215,ang:-0.42};
const tc=Math.cos(T.ang), ts=Math.sin(T.ang);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x,o=i*4;
  const dx=x+0.5-T.cx, dy=y+0.5-T.cy;
  const u=(tc*dx+ts*dy)/T.A, v=(-ts*dx+tc*dy)/T.B;
  const q=Math.sqrt(u*u+v*v);
  let lum=0.05+Math.max(0,1-Math.min(1.2,q))*0.12;
  const dpx=Math.abs(q-1)*Math.min(T.A,T.B);
  if(dpx<2.2){ lum+=0.75*Math.max(0,1-dpx/2.2); }
  // 光晕偏向一侧（不对称），检验梯度质心是否被带偏
  lum+=Math.max(0,1-Math.abs(q-1.06)*18)*0.10;
  lum+=(rnd(i)-0.5)*0.02;
  img2[o]=Math.min(255,Math.round(lum*255)); img2[o+1]=img2[o]; img2[o+2]=img2[o]; img2[o+3]=255;
}
// 遮挡：右上一块亮实体
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=x-620, dy=y-230;
  if((dx*dx)/(120*120)+(dy*dy)/(150*150)<=1){ const o=(y*W+x)*4; img2[o]=170;img2[o+1]=150;img2[o+2]=140; }
}
writePNG("_fit2.png",W,H,img2);
const init={cx:T.cx+11,cy:T.cy-9,A:T.A-16,B:T.B+12,ang:T.ang+0.06};
const fit=refineEllipse(init,img2,W,H);
const err=v=>v.toFixed(2);
console.log("\n椭圆贴合（初值偏差 11,-9,-16,+12,3.4°）");
console.log("  真值",{cx:T.cx,cy:T.cy,A:T.A,B:T.B,angDeg:(T.ang*180/Math.PI).toFixed(2)});
console.log("  结果",fit&&{cx:+err(fit.cx),cy:+err(fit.cy),A:+err(fit.A),B:+err(fit.B),angDeg:+(fit.ang*180/Math.PI).toFixed(2)});
if(fit) console.log("  误差 中心 "+Math.hypot(fit.cx-T.cx,fit.cy-T.cy).toFixed(2)+"px, 轴长 "+Math.abs(fit.A-T.A).toFixed(2)+"/"+Math.abs(fit.B-T.B).toFixed(2)+"px");
