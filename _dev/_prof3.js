/* 透视场景内探查辐条极坐标响应：定位辐条在哪一环被丢 */
const fs=require("fs");
const html=fs.readFileSync("magic-circle.html","utf8");
const s1=html.indexOf("/* ==================== PURE START"), e1=html.indexOf("/* ==================== PURE END");
let code=html.slice(s1,e1);
code=code.replace("  // --- 映射回笛卡尔","  globalThis.__mp=mp; globalThis.__ap=ap; globalThis.__resp=resp; globalThis.__env=env; globalThis.__PW=PW; globalThis.__PH=PH; globalThis.__lo=lo; globalThis.__vmax=vmax;\n  // --- 映射回笛卡尔");
const mod={};
new Function("exports", code+"\nexports.autoClean=autoClean; exports.FLAT_ROI=FLAT_ROI;")(mod);

/* ---- 重建透视场景（与 _prec_test 相同参数）---- */
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
  const o=(y*IW+x)*4, al=a/255;
  src[o]=Math.min(255,src[o]*(1-al)+r*al);
  src[o+1]=Math.min(255,src[o+1]*(1-al)+g*al);
  src[o+2]=Math.min(255,src[o+2]*(1-al)+b*al);
  src[o+3]=255;
};
for(let y=0;y<IH;y++)for(let x=0;x<IW;x++){
  const o=(y*IW+x)*4, gx=x/IW, gy=y/IH;
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
const spokeN=28;
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
  const du=(uv.u-BLOB.u)/BLOB.au, dv=(uv.v-BLOB.v)/BLOB.av, dd=du*du+dv*dv;
  const o=(y*IW+x)*4;
  if(dd<1){ src[o]=208; src[o+1]=118; src[o+2]=92; }
  else if(dd<1.5){ src[o]=src[o]*0.5+60; src[o+1]=src[o+1]*0.5+35; src[o+2]=src[o+2]*0.5+27; }
}

/* ---- 展平（eRef = 真值+微小误差，直接用真值+1.6px 偏移模拟） ---- */
const eRef={cx:T.cx+0.04, cy:T.cy+1.62, A:T.A-0.8, B:T.B+0.09, ang:T.ang};
const S=1024, SS=2, adj=1;
const A=eRef.A*adj, B=eRef.B*adj, ca=Math.cos(eRef.ang), sa=Math.sin(eRef.ang);
const ROI=mod.FLAT_ROI;
const flat=new Uint8ClampedArray(S*S*4);
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
      }
    }
    if(aw<=1e-6){ flat[o+3]=0; continue; }
    flat[o]=ar/aw; flat[o+1]=ag/aw; flat[o+2]=ab/aw;
    flat[o+3]=Math.min(255,Math.round(255*aw));
  }
}

const res=mod.autoClean(flat,S,{thr:44,strokePct:6,edge:45,blobs:true,dark:false,struct:false});
const __mp=globalThis.__mp,__ap=globalThis.__ap,__resp=globalThis.__resp,__PW2=globalThis.__PW,__PH2=globalThis.__PH;
const RR=S*0.5/ROI, CC=S/2;
for(const thD of [200,60]){
  const th2=thD*Math.PI/180;
  console.log("== 半径剖面 theta="+thD+"° ==");
  console.log(" rpx | inLum | resp | mp | ap | outAlpha");
  for(let rpx=Math.round(0.94*RR); rpx<=Math.round(1.02*RR); rpx+=2){
    const x2=Math.round(CC+Math.cos(th2)*rpx), y2=Math.round(CC+Math.sin(th2)*rpx);
    const i2=y2*S+x2, o2=i2*4;
    const inL=Math.max(flat[o2],flat[o2+1],flat[o2+2]);
    const fy2=rpx/(RR*1.05)*__PH2-0.5;
    const yr=Math.max(0,Math.min(__PH2-1,Math.round(fy2)));
    const fx2=((Math.round(th2/(Math.PI*2)*__PW2))%__PW2+__PW2)%__PW2;
    const pi2=yr*__PW2+fx2;
    console.log(" "+String(rpx).padStart(4)+" | "+inL.toFixed(0).padStart(5)+" | "+__resp[pi2].toFixed(1).padStart(5)+" | "+__mp[pi2]+" | "+__ap[pi2].toFixed(2).padStart(4)+" | "+res.alpha[i2]);
  }
}
const PW=globalThis.__PW, PH=globalThis.__PH, mp=globalThis.__mp, ap=globalThis.__ap, resp=globalThis.__resp, env=globalThis.__env;
console.log("PW="+PW+" PH="+PH+" lo="+globalThis.__lo.toFixed(1)+" vmax="+globalThis.__vmax.toFixed(1));
// 辐条在展平面里的真实角位置：源辐条在 eRef 坐标下的角 = 真值角 + 由 eRef 偏移引起的变化
// 直接在展平图里沿半径扫描找局部极大（辐条）来定位
const C=S/2, R=S*0.5/ROI;
const thProbe=[0, 45, 90, 135].map(d=>d*Math.PI/180);
for(const th0 of thProbe){
  console.log("--- 探查方向 θ="+(th0*180/Math.PI).toFixed(0)+"°（在真值辐条之间的间隙 & 辐条上扫描）---");
  for(const f of [0.35,0.55,0.75]){
    // 在该半径的圆周上扫描 60 个点，找 resp 峰
    let peaks=[];
    const rpx=f*R;
    const M=720;
    for(let q=0;q<M;q++){
      const th=q/M*Math.PI*2;
      const x=Math.round(C+Math.cos(th)*rpx), y=Math.round(C+Math.sin(th)*rpx);
      const i=y*S+x;
      peaks.push({th, a:res.alpha[i], lum:Math.max(flat[(y*S+x)*4],flat[(y*S+x)*4+1],flat[(y*S+x)*4+2])});
    }
    // 统计该圆周上 alpha>180 的角区间数量与总覆盖
    let cov=0, runs=0, inRun=false;
    for(const p of peaks){
      if(p.a>180){ cov++; if(!inRun){ runs++; inRun=true; } } else inRun=false;
    }
    console.log("r="+f+"  alpha>180 覆盖 "+(cov/M*360).toFixed(1)+"° / 360°, 区间数 "+runs+" (期望辐条28条×1.5°≈42°)");
  }
}
