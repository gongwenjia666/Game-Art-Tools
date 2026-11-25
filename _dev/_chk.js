"use strict";
const $=id=>document.getElementById(id);
const srcCanvas=$("srcCanvas"), srcCtx=srcCanvas.getContext("2d");
const flatCanvas=$("flatCanvas"), flatCtx=flatCanvas.getContext("2d");
const extCanvas=$("extCanvas"), extCtx=extCanvas.getContext("2d");

let img=null, imgW=0, imgH=0, imgData=null;
let anchors=[];
let dragIdx=-1;
let ellipse=null;
let flatData=null;

/* ==================== PURE START ==================== */
function clamp01(v){ return v<0?0:v>1?1:v; }
function smoothstep(e0,e1,x){
  if(e1<=e0) return x>=e1?1:0;
  const t=clamp01((x-e0)/(e1-e0));
  return t*t*(3-2*t);
}

/* 分离式盒式模糊（就地） */
function blur3(a,w,h,r){
  const tmp=new Float32Array(w*h);
  for(let y=0;y<h;y++){
    const row=y*w;
    let sum=0;
    for(let i=-r;i<=r;i++) sum+=a[row+Math.min(w-1,Math.max(0,i))];
    for(let x=0;x<w;x++){
      tmp[row+x]=sum/(2*r+1);
      sum+=a[row+Math.min(w-1,Math.max(0,x+r+1))]-a[row+Math.min(w-1,Math.max(0,x-r))];
    }
  }
  for(let x=0;x<w;x++){
    let sum=0;
    for(let i=-r;i<=r;i++) sum+=tmp[Math.min(h-1,Math.max(0,i))*w+x];
    for(let y=0;y<h;y++){
      a[y*w+x]=sum/(2*r+1);
      sum+=tmp[Math.min(h-1,Math.max(0,y+r+1))*w+x]-tmp[Math.min(h-1,Math.max(0,y-r))*w+x];
    }
  }
}

/* 小数组取中位（就地排序副本） */
function medianOf(buf){
  const n=buf.length;
  for(let i=1;i<n;i++){
    const v=buf[i];
    let j=i-1;
    while(j>=0 && buf[j]>v){ buf[j+1]=buf[j]; j--; }
    buf[j+1]=v;
  }
  return buf[n>>1];
}

/* 分离式中位滤波（近似二维中位，抗大块污染） */
function sepMedian(a,w,h,r){
  const tmp=new Float32Array(w*h);
  const buf=new Float32Array(2*r+1);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    for(let k=-r;k<=r;k++) buf[k+r]=a[y*w+Math.min(w-1,Math.max(0,x+k))];
    tmp[y*w+x]=medianOf(buf.slice());
  }
  for(let x=0;x<w;x++)for(let y=0;y<h;y++){
    for(let k=-r;k<=r;k++) buf[k+r]=tmp[Math.min(h-1,Math.max(0,y+k))*w+x];
    a[y*w+x]=medianOf(buf.slice());
  }
}

/* 局部背景估计：
   1) 每格取「中位亮度附近的平均色」→ 细线不会污染底色
   2) 大窗口中位 → 角色等大块污染被压制
   3) 与全图中位色的偏离钳制到 ±45 → 大块遮挡物不会被当成背景
   4) 轻度模糊 + 双线性上采样 → 平滑底色，兼顾暗角与渐变 */
function buildBackground(rgba,S){
  const n=S*S;
  const cell=Math.max(4, Math.round(S/56));
  const w=Math.ceil(S/cell), h=w;
  const med=new Float32Array(w*h*3);
  const valid=new Uint8Array(w*h);

  for(let cy=0;cy<h;cy++)for(let cx=0;cx<w;cx++){
    const x0=cx*cell, y0=cy*cell;
    const x1=Math.min(S,x0+cell), y1=Math.min(S,y0+cell);
    const total=(x1-x0)*(y1-y0);
    const hist=new Int32Array(256);
    let cnt=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const o=(y*S+x)*4;
      if(rgba[o+3]<16) continue;
      const l=(rgba[o]*77+rgba[o+1]*150+rgba[o+2]*29)>>8;
      hist[l]++; cnt++;
    }
    if(cnt<Math.max(6, total*0.2)) continue;         // 大半透明的格子视为无效
    let acc=0, lm=0;
    for(let l=0;l<256;l++){ acc+=hist[l]; if(acc>=cnt*0.5){ lm=l; break; } }
    let r=0,g=0,b=0,k=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const o=(y*S+x)*4;
      if(rgba[o+3]<16) continue;
      const l=(rgba[o]*77+rgba[o+1]*150+rgba[o+2]*29)>>8;
      if(l<lm-16||l>lm+16) continue;
      r+=rgba[o]; g+=rgba[o+1]; b+=rgba[o+2]; k++;
    }
    if(!k) continue;
    const idx=cy*w+cx;
    med[idx*3]=r/k; med[idx*3+1]=g/k; med[idx*3+2]=b/k;
    valid[idx]=1;
  }

  // 全图中位色（大块遮挡物占比通常 < 50%）
  const keepR=[],keepG=[],keepB=[];
  for(let i=0;i<w*h;i++) if(valid[i]){ keepR.push(med[i*3]); keepG.push(med[i*3+1]); keepB.push(med[i*3+2]); }
  let GR=0,GG=0,GB=0;
  if(keepR.length){
    keepR.sort((p,q)=>p-q); keepG.sort((p,q)=>p-q); keepB.sort((p,q)=>p-q);
    const m=keepR.length>>1;
    GR=keepR[m]; GG=keepG[m]; GB=keepB[m];
  }
  // 无效格用全图中位色填充
  for(let i=0;i<w*h;i++) if(!valid[i]){ med[i*3]=GR; med[i*3+1]=GG; med[i*3+2]=GB; }

  // 大窗口中位（压制角色等大块），再钳制偏离
  const rMed=Math.max(2, Math.round(w*0.18));
  const ch=[new Float32Array(w*h), new Float32Array(w*h), new Float32Array(w*h)];
  for(let i=0;i<w*h;i++){ ch[0][i]=med[i*3]; ch[1][i]=med[i*3+1]; ch[2][i]=med[i*3+2]; }
  for(let c=0;c<3;c++){
    sepMedian(ch[c], w, h, rMed);
    const Gc = c===0?GR : c===1?GG : GB;
    for(let i=0;i<w*h;i++){
      let d=ch[c][i]-Gc;
      if(d>45) d=45; else if(d<-45) d=-45;
      ch[c][i]=Gc+d;
    }
    blur3(ch[c], w, h, 2);
  }

  // 双线性上采样
  const q=S/w;
  const out=new Float32Array(n*3);
  for(let y=0;y<S;y++){
    const fy=Math.min(h-1.001, Math.max(0,(y+0.5)/q-0.5));
    const y0=fy|0, ty=fy-y0, y1=Math.min(h-1,y0+1);
    for(let x=0;x<S;x++){
      const fx=Math.min(w-1.001, Math.max(0,(x+0.5)/q-0.5));
      const x0=fx|0, tx=fx-x0, x1=Math.min(w-1,x0+1);
      const o=(y*S+x)*3;
      for(let c=0;c<3;c++){
        const a=ch[c];
        out[o+c]=(1-ty)*((1-tx)*a[y0*w+x0]+tx*a[y0*w+x1]) + ty*((1-tx)*a[y1*w+x0]+tx*a[y1*w+x1]);
      }
    }
  }
  return out;
}

/* Chamfer 距离变换：返回每个内容像素到最近背景的距离（px），支持矩形 W×H */
function chamferDT(mask,W,H){
  const INF=1e7, K=1.41421356, n=W*H;
  const d=new Float32Array(n);
  for(let i=0;i<n;i++) d[i]=mask[i]?INF:0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x; if(!d[i]) continue;
    let v=d[i];
    if(y>0){
      if(x>0 && d[i-W-1]+K<v) v=d[i-W-1]+K;
      if(d[i-W]+1<v) v=d[i-W]+1;
      if(x<W-1 && d[i-W+1]+K<v) v=d[i-W+1]+K;
    }
    if(x>0 && d[i-1]+1<v) v=d[i-1]+1;
    d[i]=v;
  }
  for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){
    const i=y*W+x; if(!d[i]) continue;
    let v=d[i];
    if(y<H-1){
      if(x<W-1 && d[i+W+1]+K<v) v=d[i+W+1]+K;
      if(d[i+W]+1<v) v=d[i+W]+1;
      if(x>0 && d[i+W-1]+K<v) v=d[i+W-1]+K;
    }
    if(x<W-1 && d[i+1]+1<v) v=d[i+1]+1;
    d[i]=v;
  }
  return d;
}

/* 二值膨胀（矩形核，用积分图 O(1) 查询） */
function dilate(mask,S,r){
  if(r<=0) return mask.slice();
  const W=S+1;
  const sat=new Int32Array(W*W);
  for(let y=0;y<S;y++){
    let rowsum=0;
    for(let x=0;x<S;x++){
      rowsum+=mask[y*S+x];
      sat[(y+1)*W+(x+1)]=sat[y*W+(x+1)]+rowsum;
    }
  }
  const out=new Uint8Array(S*S);
  for(let y=0;y<S;y++){
    const y0=Math.max(0,y-r), y1=Math.min(S-1,y+r);
    for(let x=0;x<S;x++){
      const x0=Math.max(0,x-r), x1=Math.min(S-1,x+r);
      const s=sat[(y1+1)*W+(x1+1)]-sat[y0*W+(x1+1)]-sat[(y1+1)*W+x0]+sat[y0*W+x0];
      out[y*S+x]=s>0?1:0;
    }
  }
  return out;
}

/* 4 邻域连通域标记 */
function labelComponents(mask,S,dt){
  const n=S*S;
  const labels=new Int32Array(n).fill(-1);
  const stack=new Int32Array(n);
  const comps=[];
  for(let s=0;s<n;s++){
    if(!mask[s]||labels[s]!==-1) continue;
    const id=comps.length;
    let sp=0, area=0, maxDT=0;
    stack[sp++]=s; labels[s]=id;
    while(sp>0){
      const p=stack[--sp];
      area++;
      if(dt && dt[p]>maxDT) maxDT=dt[p];
      const x=p%S, y=(p-x)/S;
      if(x>0 && mask[p-1] && labels[p-1]===-1){ labels[p-1]=id; stack[sp++]=p-1; }
      if(x<S-1 && mask[p+1] && labels[p+1]===-1){ labels[p+1]=id; stack[sp++]=p+1; }
      if(y>0 && mask[p-S] && labels[p-S]===-1){ labels[p-S]=id; stack[sp++]=p-S; }
      if(y<S-1 && mask[p+S] && labels[p+S]===-1){ labels[p+S]=id; stack[sp++]=p+S; }
    }
    comps.push({area,maxDT});
  }
  return {labels,comps};
}

/* 展平取景系数：圆盘占画布的 1/FLAT_ROI，留出边距，避免外环被画布边缘切掉 */
const FLAT_ROI=1.05;

/* ============ 一维滑动极值（单调队列 O(n)）+ 可分离形态学 ============ */
function slideMinMax(src,n,r,outMin,outMax){
  const dqMin=new Int32Array(n+1), dqMax=new Int32Array(n+1);
  let hMin=0,tMin=0,hMax=0,tMax=0;
  const total=n+r;
  for(let x=0;x<total;x++){
    if(x<n){
      const v=src[x];
      while(tMin>hMin && src[dqMin[tMin-1]]>=v) tMin--;
      dqMin[tMin++]=x;
      while(tMax>hMax && src[dqMax[tMax-1]]<=v) tMax--;
      dqMax[tMax++]=x;
    }
    const lo=x-r;
    if(lo>=0&&lo<n){
      while(dqMin[hMin]<lo) hMin++;
      while(dqMax[hMax]<lo) hMax++;
      outMin[lo]=src[dqMin[hMin]];
      outMax[lo]=src[dqMax[hMax]];
    }
  }
}

/* 矩形核形态学（isMax=true 为膨胀，false 为腐蚀），半径 r，O(W·H) */
function morph2D(a,W,H,r,isMax){
  if(r<=0) return a;
  const tmp=new Float32Array(W*H);
  const sz=Math.max(W,H)+1;
  const oMin=new Float32Array(sz), oMax=new Float32Array(sz);
  const row=new Float32Array(W);
  for(let y=0;y<H;y++){
    const off=y*W;
    for(let x=0;x<W;x++) row[x]=a[off+x];
    slideMinMax(row,W,r,oMin,oMax);
    for(let x=0;x<W;x++) tmp[off+x]= isMax?oMax[x]:oMin[x];
  }
  const col=new Float32Array(H);
  for(let x=0;x<W;x++){
    for(let y=0;y<H;y++) col[y]=tmp[y*W+x];
    slideMinMax(col,H,r,oMin,oMax);
    for(let y=0;y<H;y++) a[y*W+x]= isMax?oMax[y]:oMin[y];
  }
  return a;
}

/* Otsu 双峰阈值（hist 为 256 桶直方图） */
function otsu(hist,total){
  let sum=0;
  for(let i=0;i<256;i++) sum+=i*hist[i];
  let sumB=0,wB=0,best=-1,bestT=127;
  for(let t=0;t<256;t++){
    wB+=hist[t];
    if(!wB) continue;
    const wF=total-wB;
    if(!wF) break;
    sumB+=t*hist[t];
    const mB=sumB/wB, mF=(sum-sumB)/wF;
    const v=wB*wF*(mB-mF)*(mB-mF);
    if(v>best){ best=v; bestT=t; }
  }
  return bestT+0.5;
}

/* ---------- 极坐标重采样：环 → 水平线，射线 → 竖线 ----------
   PW 角向采样数（≈2πR，保证弧长方向 1px/样本），PH 径向采样数
   亮度取 max(R,G,B)：任意色相的发光线条都能检出
   valid=0 的样本（圆外透明区）用该半径行的中位亮度填充，避免在圆边界制造假边 */
function polarLum(rgba,S,PW,PH){
  const R=S*0.5/FLAT_ROI, cx=S*0.5, cy=S*0.5;
  const N=PW*PH;
  const L=new Float32Array(N), valid=new Uint8Array(N);
  const cosT=new Float32Array(PW), sinT=new Float32Array(PW);
  for(let i=0;i<PW;i++){
    const th=((i+0.5)/PW)*Math.PI*2;
    cosT[i]=Math.cos(th); sinT[i]=Math.sin(th);
  }
  const vals=new Float32Array(PW);
  const hist=new Int32Array(256);
  let prevMed=0;
  for(let j=0;j<PH;j++){
    const rpix=(((j+0.5)/PH)*FLAT_ROI)*R;
    const row=j*PW;
    let vcnt=0;
    for(let i=0;i<PW;i++){
      const px=cx+cosT[i]*rpix, py=cy+sinT[i]*rpix;
      if(px<0||py<0||px>S-1.001||py>S-1.001){ vals[i]=0; valid[row+i]=0; continue; }
      const x0=px|0, y0=py|0, fx=px-x0, fy=py-y0;
      const o=(y0*S+x0)*4, o1=o+4, o2=o+S*4, o3=o2+4;
      const w00=(1-fx)*(1-fy), w10=fx*(1-fy), w01=(1-fx)*fy, w11=fx*fy;
      const a=w00*rgba[o+3]+w10*rgba[o1+3]+w01*rgba[o2+3]+w11*rgba[o3+3];
      const r_=w00*rgba[o]+w10*rgba[o1]+w01*rgba[o2]+w11*rgba[o3];
      const g_=w00*rgba[o+1]+w10*rgba[o1+1]+w01*rgba[o2+1]+w11*rgba[o3+1];
      const b_=w00*rgba[o+2]+w10*rgba[o1+2]+w01*rgba[o2+2]+w11*rgba[o3+2];
      vals[i]=Math.max(r_,g_,b_);
      if(a>140){ valid[row+i]=1; vcnt++; } else { valid[row+i]=0; }
    }
    // 整行无效（圆盘外的假想行）：填上一有效行的中位底色。
    // 绝不能填 0——会在盘缘制造假黑台阶，顶帽开运算把附近背景全判成「亮结构」
    if(vcnt<PW*0.15){
      for(let i=0;i<PW;i++){ L[row+i]=prevMed; }
      continue;
    }
    hist.fill(0);
    for(let i=0;i<PW;i++) if(valid[row+i]) hist[Math.min(255,Math.round(vals[i]))]++;
    let acc=0, med=128;
    for(let l=0;l<256;l++){ acc+=hist[l]; if(acc>=vcnt*0.5){ med=l; break; } }
    for(let i=0;i<PW;i++) L[row+i]= valid[row+i]?vals[i]:med;
    prevMed=med;
  }
  return {L,valid};
}

/* 矩形连通域（4 邻域） */
function labelRect(mask,W,H){
  const n=W*H;
  const labels=new Int32Array(n).fill(-1);
  const stack=new Int32Array(n);
  const comps=[];
  for(let s=0;s<n;s++){
    if(!mask[s]||labels[s]!==-1) continue;
    const id=comps.length;
    let sp=0, area=0;
    stack[sp++]=s; labels[s]=id;
    while(sp>0){
      const p=stack[--sp];
      area++;
      const x=p%W, y=(p-x)/W;
      if(x>0 && mask[p-1] && labels[p-1]===-1){ labels[p-1]=id; stack[sp++]=p-1; }
      if(x<W-1 && mask[p+1] && labels[p+1]===-1){ labels[p+1]=id; stack[sp++]=p+1; }
      if(y>0 && mask[p-W] && labels[p-W]===-1){ labels[p-W]=id; stack[sp++]=p-W; }
      if(y<H-1 && mask[p+W] && labels[p+W]===-1){ labels[p+W]=id; stack[sp++]=p+W; }
    }
    comps.push({area});
  }
  return {labels,comps};
}

/* 径向 / 角向连续游程长度：细线两向都小，实心块的球心两向都大 */
function runLengths(mask,W,H){
  const N=W*H;
  const rRun=new Int32Array(N), tRun=new Int32Array(N);
  for(let x=0;x<W;x++){
    let y=0;
    while(y<H){
      if(!mask[y*W+x]){ y++; continue; }
      let y2=y;
      while(y2<H && mask[y2*W+x]) y2++;
      const len=y2-y;
      for(let k=y;k<y2;k++) rRun[k*W+x]=len;
      y=y2;
    }
  }
  for(let y=0;y<H;y++){
    const off=y*W;
    let x=0;
    while(x<W){
      if(!mask[off+x]){ x++; continue; }
      let x2=x;
      while(x2<W && mask[off+x2]) x2++;
      const len=x2-x;
      for(let k=x;k<x2;k++) tRun[off+k]=len;
      x=x2;
    }
  }
  return {rRun,tRun};
}

/* 环 / 射线结构先验：极坐标下环是水平线、射线是竖线，
   角色等遮挡物的轮廓在极坐标里是斜的/弯的，在两个方向的投影都不会形成尖峰 → 被剔除 */
function ringSpokeBand(mask,W,H,tol){
  const rp=new Float32Array(H), sp=new Float32Array(W);
  for(let y=0;y<H;y++){
    const off=y*W; let c=0;
    for(let x=0;x<W;x++) if(mask[off+x]) c++;
    rp[y]=c/W;
  }
  for(let x=0;x<W;x++){
    let c=0;
    for(let y=0;y<H;y++) if(mask[y*W+x]) c++;
    sp[x]=c/H;
  }
  const smooth1=(a)=>{
    const b=new Float32Array(a.length);
    for(let i=0;i<a.length;i++){
      let s=0,n=0;
      for(let k=-2;k<=2;k++){ const j=i+k; if(j>=0&&j<a.length){ s+=a[j]; n++; } }
      b[i]=s/n;
    }
    return b;
  };
  const RP=smooth1(smooth1(rp)), SP=smooth1(smooth1(sp));
  const band=new Uint8Array(W*H);
  // 环峰 → 沿半径 ±tol 的带
  for(let y=1;y<H-1;y++){
    if(!(RP[y]>=RP[y-1] && RP[y]>=RP[y+1] && RP[y]>0.10)) continue;
    const y0=Math.max(0,y-tol), y1=Math.min(H-1,y+tol);
    for(let yy=y0;yy<=y1;yy++){
      const off=yy*W;
      for(let x=0;x<W;x++) if(mask[off+x]) band[off+x]=1;
    }
  }
  // 射线峰（要求峰窄：宽平台是遮挡物投出来的，不是射线）→ 沿角向 ±tol 的带
  for(let x=0;x<W;x++){
    const v=SP[x];
    if(v<0.30) continue;
    const l=SP[(x-1+W)%W], r=SP[(x+1)%W];
    if(!(v>=l && v>=r)) continue;
    let wl=0, wr=0;
    while(wl<W*0.2 && SP[(x-wl-1+W)%W]>v*0.55) wl++;
    while(wr<W*0.2 && SP[(x+wr+1)%W]>v*0.55) wr++;
    if((wl+wr)>W*0.12) continue;
    const x0=x-tol, x1=x+tol;
    for(let xx=x0;xx<=x1;xx++){
      const xi=((xx%W)+W)%W;
      for(let y=0;y<H;y++) if(mask[y*W+xi]) band[y*W+xi]=1;
    }
  }
  return band;
}

/* 小型方阵高斯消元（含部分主元），M 为 n×(n+1) */
function solveSquare(M,n){
  const A=M.map(r=>r.slice());
  for(let col=0;col<n;col++){
    let piv=col;
    for(let r=col+1;r<n;r++) if(Math.abs(A[r][col])>Math.abs(A[piv][col])) piv=r;
    if(Math.abs(A[piv][col])<1e-12) return null;
    if(piv!==col){ const t=A[piv]; A[piv]=A[col]; A[col]=t; }
    const d=A[col][col];
    for(let c=col;c<=n;c++) A[col][c]/=d;
    for(let r=0;r<n;r++){
      if(r===col) continue;
      const f=A[r][col];
      if(!f) continue;
      for(let c=col;c<=n;c++) A[r][c]-=f*A[col][c];
    }
  }
  return A.map(r=>r[n]);
}

/* 椭圆贴合（亚像素）：
   ① 沿椭圆法向取亮度梯度剖面，用「梯度加权质心」定位线条中心——对光晕不对称不敏感，
      而单纯取亮度极大值会被光晕或线条一侧带偏；
   ② 4 参数（中心 2 + 长短轴）加权最小二乘迭代，残差按 MAD 截尾，抗遮挡物干扰；
   ③ 外层对角度做 ±4° 粗扫（角度单独扰动在单点法向上不可观，但对整条环显著）。 */
function refineEllipse(e, data, W, H){
  const gray=new Float32Array(W*H);
  for(let i=0;i<W*H;i++){
    const o=i*4;
    gray[i]=data[o]*0.299+data[o+1]*0.587+data[o+2]*0.114;
  }
  const bil=(px,py)=>{
    if(px<0||py<0||px>W-1.001||py>H-1.001) return -1;
    const x0=px|0, y0=py|0, fx=px-x0, fy=py-y0, o=y0*W+x0;
    return (1-fy)*((1-fx)*gray[o]+fx*gray[o+1]) + fy*((1-fx)*gray[o+W]+fx*gray[o+W+1]);
  };
  const maxScale=Math.max(e.A,e.B);
  const solve4=(list)=>{
    const M=[[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]];
    for(const p of list){
      const J=[p.nx,p.ny,p.j1,p.j2];
      for(let i=0;i<4;i++){
        for(let j=0;j<4;j++) M[i][j]+=p.w*J[i]*J[j];
        M[i][4]+=p.w*J[i]*p.s;
      }
    }
    return solveSquare(M,4);
  };

  function fit(init, rounds){
    let cx=init.cx, cy=init.cy, A=init.A, B=init.B, ang=init.ang;
    let err=Infinity;
    for(let iter=0; iter<rounds; iter++){
      const ca=Math.cos(ang), sa=Math.sin(ang);
      const half=Math.max(5, Math.round(maxScale*(iter<2?0.085:0.045)));
      const N=200;
      const pts=[];
      for(let k=0;k<N;k++){
        const t=(k+0.5)/N*Math.PI*2, u=Math.cos(t), v=Math.sin(t);
        const px=cx+ca*A*u-sa*B*v, py=cy+sa*A*u+ca*B*v;
        let nx=ca*(u/A)-sa*(v/B), ny=sa*(u/A)+ca*(v/B);
        const nl=Math.hypot(nx,ny)||1; nx/=nl; ny/=nl;
        const M2=2*half+1;
        const g=new Float32Array(M2);
        let gmax=0, bad=false;
        for(let i=0;i<M2;i++){
          const s=i-half;
          const a=bil(px+nx*(s-1),py+ny*(s-1));
          const b=bil(px+nx*(s+1),py+ny*(s+1));
          if(a<0||b<0){ bad=true; break; }
          const gg=Math.abs(b-a)*0.5;
          g[i]=gg; if(gg>gmax) gmax=gg;
        }
        if(bad||gmax<3) continue;
        const gate=gmax*0.55;
        let sw=0, ss=0;
        for(let i=0;i<M2;i++){
          if(g[i]<=gate) continue;
          const w=g[i]-gate;
          sw+=w; ss+=w*(i-half);
        }
        if(sw<=0) continue;
        const sStar=ss/sw;
        pts.push({s:sStar, w:sw, nx, ny,
                  j1:ca*u*nx+sa*u*ny, j2:-sa*v*nx+ca*v*ny});
      }
      if(pts.length<N*0.3) break;
      let sol=solve4(pts);
      if(!sol) break;
      // 残差截尾（去掉被遮挡物拉偏的采样点）
      const rs=pts.map(p=>{
        const r=p.s-(p.nx*sol[0]+p.ny*sol[1]+p.j1*sol[2]+p.j2*sol[3]);
        return {p, r:Math.abs(r)};
      }).sort((a,b)=>a.r-b.r);
      const keep=rs.slice(0, Math.max(10, Math.round(rs.length*0.78))).map(o=>o.p);
      const s2=solve4(keep);
      if(s2) sol=s2;
      const cap=Math.max(2, maxScale*0.03);
      const cl=v=>v>cap?cap:(v<-cap?-cap:v);
      const dcx=cl(sol[0]), dcy=cl(sol[1]), dA=cl(sol[2]), dB=cl(sol[3]);
      cx+=dcx; cy+=dcy; A+=dA; B+=dB;
      if(!(A>6&&B>6)) return null;
      let se=0, sw=0;
      for(const p of keep){
        const r=p.s-(p.nx*sol[0]+p.ny*sol[1]+p.j1*sol[2]+p.j2*sol[3]);
        se+=Math.abs(r)*p.w; sw+=p.w;
      }
      err= sw>0? se/sw : Infinity;
      if(Math.abs(dcx)<0.05&&Math.abs(dcy)<0.05&&Math.abs(dA)<0.05&&Math.abs(dB)<0.05) break;
    }
    if(!isFinite(cx)||!isFinite(cy)||!(A>6&&B>6)) return null;
    return {cx,cy,A,B,ang,err};
  }

  let best=null;
  for(let da=-4; da<=4.001; da+=1){
    const r=fit({cx:e.cx, cy:e.cy, A:e.A, B:e.B, ang:e.ang+da*Math.PI/180}, 3);
    if(r && (!best || r.err<best.err)) best=r;
  }
  if(!best) return e;
  const fin=fit(best, 6) || best;
  if(!fin) return e;
  // 安全阀：偏离锚点初值过多说明锁到了别的结构
  if(Math.abs(fin.A-e.A)>e.A*0.16 || Math.abs(fin.B-e.B)>e.B*0.16) return e;
  if(Math.hypot(fin.cx-e.cx, fin.cy-e.cy)>maxScale*0.18) return e;
  return {cx:fin.cx, cy:fin.cy, A:fin.A, B:fin.B, ang:fin.ang};
}

/* 主清理管线（判定全部在极坐标空间完成，再映射回笛卡尔）：
   step1 顶帽：只保留「比周围更亮/更暗的细结构」→ 光晕、渐变底、大块实体内部天然为 0
   step2 Otsu 自动阈值 + 迟滞链接 → 细线在阈值处断开的小段被弱阈值连回来，不再断成虚线
   step3 游程测厚：径向与角向游程同时过大 = 实心块（角色等）→ 剔除
   step4 结构先验（可选）：只留环向 / 径向
   step5 映射回笛卡尔 → 颜色解混 → 边缘收紧（去掉半透明灰雾） */
function autoClean(rgba,S,opt){
  const n=S*S, R=S*0.5/FLAT_ROI;
  const bg=buildBackground(rgba,S);
  const PW=Math.max(720, Math.min(4096, Math.round(Math.PI*2*R)));
  const PH=Math.max(256, Math.min(1400, Math.round(R*1.08)));
  const N=PW*PH;
  const {L,valid}=polarLum(rgba,S,PW,PH);

  // --- 白顶帽 = L − 开运算：亮细结构响应，光晕/渐变底/大块实体内部天然为 0
  //     （黑顶帽=闭运算−L 会在相邻亮线之间产生假暗带，仅在勾选「暗线检测」时启用）
  const m=Math.max(2, Math.min(36, Math.round(R*opt.strokePct/100)));
  const op=Float32Array.from(L);
  morph2D(op,PW,PH,m,false); morph2D(op,PW,PH,m,true);
  const resp=new Float32Array(N);
  let vmax=0;
  if(opt.dark){
    const cl=Float32Array.from(L);
    morph2D(cl,PW,PH,m,true); morph2D(cl,PW,PH,m,false);
    for(let i=0;i<N;i++){
      if(!valid[i]){ resp[i]=0; continue; }
      const up=L[i]-op[i], dn=cl[i]-L[i];
      const v=up>dn?up:dn;
      resp[i]=v>0?v:0;
      if(resp[i]>vmax) vmax=resp[i];
    }
  }else{
    for(let i=0;i<N;i++){
      if(!valid[i]){ resp[i]=0; continue; }
      const v=L[i]-op[i];
      resp[i]=v>0?v:0;
      if(resp[i]>vmax) vmax=resp[i];
    }
  }
  const alpha=new Uint8ClampedArray(n), rgb=new Uint8ClampedArray(n*3);
  if(vmax<3) return {alpha, rgb, bg, contentCnt:0, blobPx:0, speckPx:0, structPx:0, R};

  // --- 阈值：稳健噪声底估计。
  //     不能用 p90：法阵线条+光晕常占极坐标样本 10% 以上，p90 会落进内容分布内部，
  //     把阈值抬到内容亮度级别，整片暗线被抹掉。
  //     改用「中位数 + IQR×3.2」：只由占多数的背景噪声决定，与内容占比无关。
  const hist=new Int32Array(256);
  let tot=0;
  for(let i=0;i<N;i++){
    if(!valid[i]) continue;
    hist[Math.min(255,Math.round(resp[i]/vmax*255))]++; tot++;
  }
  const pct=q=>{
    let acc=0;
    const target=tot*q;
    for(let l=0;l<256;l++){ acc+=hist[l]; if(acc>=target) return l; }
    return 255;
  };
  const p25=pct(0.25), p50=pct(0.50), p75=pct(0.75);
  const iqr=p75-p25;
  const k=Math.max(0.3, Math.min(2.6, opt.thr/44));
  const lo=Math.min(Math.max(2.5, (p50+iqr*3.2)*vmax/255, vmax*0.015)*k, vmax*0.25);

  // --- 初筛 + 连通域面积过滤（去孤立噪点）
  const mp=new Uint8Array(N);
  for(let i=0;i<N;i++) mp[i]=(valid[i] && resp[i]>=lo)?1:0;
  const {labels,comps}=labelRect(mp,PW,PH);
  const keep=new Uint8Array(comps.length);
  const minA=Math.max(8, Math.round(N*0.000008));
  let speckPx=0;
  for(let i=0;i<N;i++){
    if(!mp[i]) continue;
    if(comps[labels[i]].area<minA) continue;
    keep[labels[i]]=1;
  }
  for(let c=0;c<comps.length;c++) if(!keep[c]) speckPx+=comps[c].area;
  for(let i=0;i<N;i++) if(mp[i] && !keep[labels[i]]) mp[i]=0;

  // --- 厚度过滤：mp 区域的局部厚度（距离变换×2）超过阈值 = 实体或宽光晕带（角色）。
  //     用厚度而不是双向游程：环/辐条交叉点两个方向游程都大，但厚度仍是线条级别，
  //     游程判据会把交叉点整块误删；厚度判据只删真正「厚」的区域
  {
    const dtP=chamferDT(mp,PW,PH);
    const thP=Math.max(8, m*0.6);
    for(let i=0;i<N;i++) if(mp[i] && dtP[i]*2>thP) mp[i]=0;
  }

  // --- alpha 横截面：按「局部峰值包络」归一化（邻域内响应峰）。
  //     包络半径取小（只覆盖本线条截面），避免邻近更亮结构压低暗线的 alpha；
  //     阈值带宽收窄，让线条截面保持「宽平台 + 陡边」，输出粗细与原图一致
  const envR=Math.max(3, Math.min(8, Math.round(m*0.30)));
  const env=Float32Array.from(resp);
  morph2D(env,PW,PH,envR,true);
  const ap=new Float32Array(N);
  for(let i=0;i<N;i++){
    if(!mp[i]) continue;
    const e=Math.max(env[i], lo*2.5);
    ap[i]=smoothstep(e*0.22, e*0.50, resp[i]);
  }

  // --- 实心遮挡物（角色等）：在笛卡尔空间用「内容粗掩膜 + 距离变换」找厚实区域。
  //     内容掩膜含角色、线条与光晕，其中厚度超限的部分必然是实体（细线与光晕都很薄）；
  //     再向外扩一点，把角色轮廓边一并盖住。
  let blobPx=0, blobZone=null;
  if(opt.blobs){
    // 只把「强差异」像素当遮挡物本体：角色软光晕是平滑大渐变，不算实体，
    // 否则厚度判定会把光晕一起算进去，膨胀后误删旁边合法的法阵线条
    const T2=Math.max(70, opt.thr*1.5);
    const cm=new Uint8Array(n);
    for(let i=0;i<n;i++){
      const o=i*4;
      if(rgba[o+3]<128) continue;
      const dr=rgba[o]-bg[i*3], dg=rgba[o+1]-bg[i*3+1], db=rgba[o+2]-bg[i*3+2];
      if(Math.sqrt(dr*dr+dg*dg+db*db)>T2) cm[i]=1;
    }
    const dt=chamferDT(cm,S,S);
    // 厚度判定：>「最大线条粗细」×1.25 的实心区域才是遮挡物（细线与光晕都很薄）
    const maxT=Math.max(8, m*1.25);
    const solid=new Uint8Array(n);
    let sCnt=0;
    for(let i=0;i<n;i++) if(cm[i] && dt[i]*2>maxT){ solid[i]=1; sCnt++; }
    // 只外扩不到半个线宽：盖住角色硬轮廓即可；软光晕由「弱响应平滑区抑制」处理
    if(sCnt>4) blobZone=dilate(solid,S,Math.max(3,Math.round(m*0.45)));
  }

  // --- 结构先验：只保留环向 / 径向笔触
  let structPx=0;
  if(opt.struct){
    const tol=Math.max(2, Math.round(m*0.6));
    const band=ringSpokeBand(mp,PW,PH,tol);
    for(let i=0;i<N;i++) if(mp[i] && !band[i]){ mp[i]=0; ap[i]=0; structPx++; }
  }

  // --- 映射回笛卡尔（角向环绕双线性）+ 颜色解混 + 边缘收紧
  const cx0=S*0.5, cy0=S*0.5;
  const gam=1+opt.edge*0.013;
  // 亮度梯度图：用于区分「线条边缘」（梯度大）与「角色软光晕残留」（平滑，梯度小）
  const lumArr=new Float32Array(n);
  for(let i=0;i<n;i++){ const o=i*4; const v0=rgba[o]>rgba[o+1]?rgba[o]:rgba[o+1]; lumArr[i]=v0>rgba[o+2]?v0:rgba[o+2]; }
  const gradMax=new Float32Array(n);
  for(let y=1;y<S-1;y++)for(let x=1;x<S-1;x++){
    const i=y*S+x;
    const gx=lumArr[i+1]-lumArr[i-1], gy=lumArr[i+S]-lumArr[i-S];
    gradMax[i]=Math.abs(gx)>Math.abs(gy)?Math.abs(gx):Math.abs(gy);
  }
  const gTh=Math.max(5, vmax*0.018);
  let contentCnt=0;
  for(let y=0;y<S;y++){
    const dy=y+0.5-cy0;
    for(let x=0;x<S;x++){
      const dx=x+0.5-cx0;
      const rr=Math.sqrt(dx*dx+dy*dy)/R;
      if(rr>1.0) continue;
      const i=y*S+x;
      let th=Math.atan2(dy,dx);
      if(th<0) th+=Math.PI*2;
      const fx=th/(Math.PI*2)*PW-0.5;
      const fy=rr/FLAT_ROI*PH-0.5;
      const x0=Math.floor(fx), y0=Math.floor(fy);
      const tx=fx-x0, ty=fy-y0;
      const xa=((x0%PW)+PW)%PW, xb=((x0+1)%PW+PW)%PW;
      const ya=y0<0?0:(y0>PH-1?PH-1:y0);
      const yb=y0+1<0?0:(y0+1>PH-1?PH-1:y0+1);
      const v=(1-ty)*((1-tx)*ap[ya*PW+xa]+tx*ap[ya*PW+xb])
             + ty*((1-tx)*ap[yb*PW+xa]+tx*ap[yb*PW+xb]);
      if(v<=0.006) continue;
      if(blobZone && blobZone[i]){ blobPx++; continue; }
      const a=Math.min(1, Math.pow(v,gam));
      // 弱 alpha 且周围没有任何边缘（平滑区）→ 角色软光晕等残留，剔除；
      // 线条边缘像素梯度大不受影响，线条紧邻的弱 alpha 也会因 3×3 邻域含核心边缘而保留
      if(a<0.55){
        let gm=0;
        const bx0=x>0?x-1:0, bx1=x<S-1?x+1:S-1, by0=y>0?y-1:0, by1=y<S-1?y+1:S-1;
        for(let yy=by0;yy<=by1;yy++){
          const ro=yy*S;
          for(let xx=bx0;xx<=bx1;xx++){
            const g2=gradMax[ro+xx];
            if(g2>gm) gm=g2;
          }
        }
        if(gm<gTh) continue;
      }
      const ai=Math.round(255*a);
      alpha[i]=ai;
      if(ai>64) contentCnt++;
      const o=i*4;
      if(a>=0.985){
        rgb[i*3]=rgba[o]; rgb[i*3+1]=rgba[o+1]; rgb[i*3+2]=rgba[o+2];
      }else{
        const inv=1/a;
        let r0=(rgba[o]-bg[i*3]*(1-a))*inv;
        let g0=(rgba[o+1]-bg[i*3+1]*(1-a))*inv;
        let b0=(rgba[o+2]-bg[i*3+2]*(1-a))*inv;
        rgb[i*3]=r0<0?0:(r0>255?255:r0);
        rgb[i*3+1]=g0<0?0:(g0>255?255:g0);
        rgb[i*3+2]=b0<0?0:(b0>255?255:b0);
      }
    }
  }

  return {alpha, rgb, bg, contentCnt, blobPx, speckPx, structPx, R};
}
/* ==================== PURE END ==================== */

/* ---------------- 载入 ---------------- */
const drop=$("drop"), fileInput=$("fileInput");
drop.onclick=()=>fileInput.click();
$("btnPick").onclick=()=>fileInput.click();
fileInput.onchange=e=>{ loadFile(e.target.files[0]); fileInput.value=""; };
document.addEventListener("dragover",e=>{e.preventDefault(); drop.classList.add("over");});
document.addEventListener("dragleave",e=>{ if(e.target===document.documentElement) drop.classList.remove("over");});
document.addEventListener("drop",e=>{ e.preventDefault(); drop.classList.remove("over"); if(e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]); });
document.addEventListener("paste",e=>{ for(const it of (e.clipboardData?.items||[])) if(it.type.startsWith("image/")) loadFile(it.getAsFile()); });

function loadFile(file){
  if(!file || !file.type.startsWith("image/")) return;
  const r=new FileReader();
  r.onload=e=>loadURL(e.target.result);
  r.readAsDataURL(file);
}
function loadURL(url){
  const im=new Image();
  im.onload=()=>{
    const MAX=1600, sc=Math.min(1, MAX/Math.max(im.width,im.height));
    imgW=Math.round(im.width*sc); imgH=Math.round(im.height*sc);
    img=document.createElement("canvas"); img.width=imgW; img.height=imgH;
    const c=img.getContext("2d",{willReadFrequently:true}); c.drawImage(im,0,0,imgW,imgH);
    imgData=c.getImageData(0,0,imgW,imgH);
    srcCanvas.width=imgW; srcCanvas.height=imgH;
    srcCtx.drawImage(img,0,0);
    anchors=[]; ellipse=null; flatData=null;
    $("drop").style.display="none";
    $("srcInfo").textContent=`${im.width}×${im.height}`+(sc<1?`（处理 ${imgW}×${imgH}）`:"");
    $("btnClear").disabled=false; $("btnUndo").disabled=false;
    $("btnSaveFlat").disabled=true; $("btnSaveExt").disabled=true;
    $("flatInfo").textContent=""; $("extInfo").textContent="";
    setStatus("已载入。沿法阵外圆边缘依次点击至少 5 个锚点。");
    drawOverlay();
  };
  im.src=url;
}
function setStatus(s){ $("status").textContent=s; }

/* ---------------- 椭圆拟合 ---------------- */
function solveLinear(M){
  const n=M.length, A=M.map(r=>r.slice());
  for(let col=0;col<n;col++){
    let piv=col;
    for(let r=col+1;r<n;r++) if(Math.abs(A[r][col])>Math.abs(A[piv][col])) piv=r;
    if(Math.abs(A[piv][col])<1e-12) return null;
    if(piv!==col){ const t=A[piv]; A[piv]=A[col]; A[col]=t; }
    const d=A[col][col];
    for(let c=col;c<=n;c++) A[col][c]/=d;
    for(let r=0;r<n;r++){
      if(r===col) continue;
      const f=A[r][col];
      if(!f) continue;
      for(let c=col;c<=n;c++) A[r][c]-=f*A[col][c];
    }
  }
  return A.map(r=>r[n]);
}
function fitEllipse(P){
  if(P.length<5) return null;
  const M=Array.from({length:5},()=>new Array(6).fill(0));
  for(const p of P){
    const row=[p.x*p.x, p.x*p.y, p.y*p.y, p.x, p.y];
    for(let i=0;i<5;i++){ for(let j=0;j<5;j++) M[i][j]+=row[i]*row[j]; M[i][5]+=row[i]; }
  }
  const s=solveLinear(M);
  if(!s) return null;
  const [a,b,c,d,e]=s, f=-1;
  const den=4*a*c-b*b;
  if(den<=1e-12) return null;
  const cx=(b*e-2*c*d)/den;
  const cy=(b*d-2*a*e)/den;
  const F0=a*cx*cx+b*cx*cy+c*cy*cy+d*cx+e*cy+f;
  const tr=a+c, det=a*c-b*b/4;
  const dsc=Math.sqrt(Math.max(0, tr*tr/4-det));
  const l1=tr/2+dsc, l2=tr/2-dsc;
  if(Math.abs(l1)<1e-12||Math.abs(l2)<1e-12) return null;
  let A2=-F0/l1, B2=-F0/l2;
  if(A2<=0||B2<=0){
    A2=Math.abs(A2); B2=Math.abs(B2);
    if(!isFinite(A2)||!isFinite(B2)||A2<=0||B2<=0) return null;
  }
  const A=Math.sqrt(A2), B=Math.sqrt(B2);
  let vx=b/2, vy=l1-a;
  if(Math.hypot(vx,vy)<1e-9){ vx=1; vy=0; }
  const vl=Math.hypot(vx,vy); vx/=vl; vy/=vl;
  const ang=Math.atan2(vy,vx);
  if(!isFinite(cx)||!isFinite(cy)||!isFinite(A)||!isFinite(B)) return null;
  return {cx,cy,A,B,ang};
}

/* ---------------- 叠加层 ---------------- */
function drawOverlay(){
  if(!img) return;
  srcCtx.clearRect(0,0,imgW,imgH);
  srcCtx.drawImage(img,0,0);
  const adj=+$("pRadius").value/100;
  if(ellipse){
    const A=ellipse.A*adj, B=ellipse.B*adj;
    srcCtx.save();
    srcCtx.translate(ellipse.cx, ellipse.cy);
    srcCtx.rotate(ellipse.ang);
    srcCtx.beginPath(); srcCtx.ellipse(0,0,A,B,0,0,Math.PI*2);
    srcCtx.strokeStyle="rgba(55,214,195,.95)"; srcCtx.lineWidth=Math.max(1.5,imgW/500); srcCtx.stroke();
    srcCtx.beginPath(); srcCtx.ellipse(0,0,A*0.5,B*0.5,0,0,Math.PI*2);
    srcCtx.strokeStyle="rgba(55,214,195,.35)"; srcCtx.lineWidth=1; srcCtx.stroke();
    srcCtx.beginPath(); srcCtx.moveTo(-A,0); srcCtx.lineTo(A,0); srcCtx.moveTo(0,-B); srcCtx.lineTo(0,B);
    srcCtx.strokeStyle="rgba(55,214,195,.18)"; srcCtx.stroke();
    srcCtx.restore();
  }
  const r=Math.max(3.5,imgW/200);
  anchors.forEach((p,i)=>{
    srcCtx.beginPath(); srcCtx.arc(p.x,p.y,r,0,7);
    srcCtx.fillStyle="#ff7a3c"; srcCtx.fill();
    srcCtx.strokeStyle="#fff"; srcCtx.lineWidth=1.4; srcCtx.stroke();
    srcCtx.fillStyle="#fff"; srcCtx.font=`${Math.max(9,imgW/110)}px sans-serif`;
    srcCtx.fillText(i+1, p.x+r+2, p.y-r-1);
  });
}

/* ---------------- 展平（超采样） ---------------- */
function renderFlat(){
  if(!img || !ellipse) return;
  const S=+$("pSize").value;
  const adj=+$("pRadius").value/100;
  const A=ellipse.A*adj, B=ellipse.B*adj;
  const ca=Math.cos(ellipse.ang), sa=Math.sin(ellipse.ang);
  const SS=$("pSS").checked ? (S<=512?3:2) : 1;
  const inv=1/(SS*SS);
  const ROI=FLAT_ROI;

  const out=flatCtx.createImageData(S,S);
  const od=out.data, sd=imgData.data;
  for(let j=0;j<S;j++){
    for(let i=0;i<S;i++){
      const o=(j*S+i)*4;
      let ar=0,ag=0,ab=0,aw=0;
      for(let sy=0;sy<SS;sy++){
        const v=((((j+(sy+0.5)/SS)/S)*2-1))*ROI;
        for(let sx=0;sx<SS;sx++){
          const u=((((i+(sx+0.5)/SS)/S)*2-1))*ROI;
          const rr=Math.sqrt(u*u+v*v);
          let mask=1;
          if(rr>1.045) continue;
          else if(rr>1.005) mask=(1.045-rr)/0.04;
          const px=ellipse.cx + ca*(A*u) - sa*(B*v);
          const py=ellipse.cy + sa*(A*u) + ca*(B*v);
          if(px<0||py<0||px>imgW-1.001||py>imgH-1.001) continue;
          const x0=px|0, y0=py|0, fx=px-x0, fy=py-y0;
          const i00=(y0*imgW+x0)*4, i10=i00+4, i01=i00+imgW*4, i11=i01+4;
          const w=inv*mask;
          ar+=w*((1-fy)*((1-fx)*sd[i00]  +fx*sd[i10]  )+fy*((1-fx)*sd[i01]  +fx*sd[i11]  ));
          ag+=w*((1-fy)*((1-fx)*sd[i00+1]+fx*sd[i10+1])+fy*((1-fx)*sd[i01+1]+fx*sd[i11+1]));
          ab+=w*((1-fy)*((1-fx)*sd[i00+2]+fx*sd[i10+2])+fy*((1-fx)*sd[i01+2]+fx*sd[i11+2]));
          aw+=w;
        }
      }
      if(aw<=1e-6){ od[o+3]=0; continue; }
      od[o]=ar/aw; od[o+1]=ag/aw; od[o+2]=ab/aw;
      od[o+3]=Math.min(255, Math.round(255*aw));
    }
  }
  flatCanvas.width=S; flatCanvas.height=S;
  flatCtx.putImageData(out,0,0);
  flatData=out;
  $("flatInfo").textContent=`${S}×${S} · 长轴 ${Math.round(A)} 短轴 ${Math.round(B)} · 旋转 ${(ellipse.ang*180/Math.PI).toFixed(1)}°`+(SS>1?" · 2× 超采样":"");
  $("btnSaveFlat").disabled=false;
  runClean();
}

/* ---------------- 自动清理 + 输出 ---------------- */
function runClean(){
  if(!flatData) return;
  const S=flatCanvas.width;
  const opt={
    thr:+$("pAlpha").value,
    strokePct:+$("pStroke").value,
    edge:+$("pEdge").value,
    blobs:$("pBlobs").checked,
    dark:$("pDark").checked,
    struct:$("pStruct").checked
  };
  const t0=performance.now();
  const res=autoClean(flatData.data, S, opt);
  const alpha=res.alpha, rgb=res.rgb;

  if(res.contentCnt<20){
    $("extInfo").textContent="未检测到法阵内容";
    $("btnSaveExt").disabled=true;
    setStatus("未找到与底色差异足够的内容，可调低「色差阈值」。");
    return;
  }
  // 方形裁切：以圆心为中心的整圆外接正方形，保证输出始终正方形且外环完整
  let x0=0,y0=0,w=S,h=S;
  if($("pCrop").checked){
    const pad=Math.max(2, Math.round(S*0.008));
    const half=Math.min(Math.floor(S/2), Math.round(res.R+pad));
    x0=Math.round(S/2)-half; y0=x0; w=half*2; h=half*2;
    x0=Math.max(0,Math.min(S-w,x0)); y0=x0;
  }
  const out=extCtx.createImageData(w,h), od=out.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const si=(y+y0)*S+(x+x0), di=(y*w+x)*4;
    od[di]=rgb[si*3]; od[di+1]=rgb[si*3+1]; od[di+2]=rgb[si*3+2];
    od[di+3]=alpha[si];
  }
  extCanvas.width=w; extCanvas.height=h;
  extCtx.putImageData(out,0,0);
  $("btnSaveExt").disabled=false;

  const ms=Math.round(performance.now()-t0);
  $("extInfo").textContent=`${w}×${h} · 透明底 · ${ms}ms`;
  const parts=[];
  if(res.blobPx>0) parts.push(`剔遮挡 ${(res.blobPx/(S*S)*100).toFixed(1)}%`);
  if(res.structPx>0) parts.push(`结构过滤 ${(res.structPx/(S*S)*100).toFixed(1)}%`);
  if(res.speckPx>0) parts.push(`去碎点 ${res.speckPx}`);
  setStatus(`已提取法阵（${w}×${h}）`+(parts.length?" — "+parts.join(" · "):"")+"。线条缺失调低「检出阈值」，残留多调高它或勾选「只留环/射线」。");
}

/* ---------------- 拟合触发 ---------------- */
function tryFit(){
  ellipse=null;
  if(anchors.length>=5){
    const e=fitEllipse(anchors);
    if(e){
      // 自动贴合：把椭圆吸附到真实外环的梯度峰值上
      let ref=e;
      if($("pSnap").checked && imgData){
        try{ ref=refineEllipse(e, imgData.data, imgW, imgH) || e; }catch(_){ ref=e; }
      }
      ellipse=ref;
      drawOverlay();
      renderFlat();
    }else{
      drawOverlay();
      setStatus("拟合失败：锚点过于共线或形状非椭圆，请重新沿外圆描点。");
    }
  }else{
    drawOverlay();
    if(img) setStatus(`已放置 ${anchors.length} 个锚点，还需 ${5-anchors.length} 个即可拟合。`);
  }
}

/* ---------------- 交互 ---------------- */
function canvasPos(e){
  const r=srcCanvas.getBoundingClientRect();
  return {x:(e.clientX-r.left)*imgW/r.width, y:(e.clientY-r.top)*imgH/r.height};
}
srcCanvas.addEventListener("pointerdown",e=>{
  if(!img) return;
  e.preventDefault();
  const p=canvasPos(e), hitR=Math.max(8,imgW/120);
  dragIdx=anchors.findIndex(q=>Math.hypot(q.x-p.x,q.y-p.y)<hitR);
  if(dragIdx<0){ anchors.push(p); dragIdx=anchors.length-1; }
  srcCanvas.setPointerCapture(e.pointerId);
  tryFit(); updateBtns();
});
srcCanvas.addEventListener("pointermove",e=>{
  if(dragIdx<0) return;
  anchors[dragIdx]=canvasPos(e);
  tryFit();
});
srcCanvas.addEventListener("pointerup",()=>dragIdx=-1);
srcCanvas.addEventListener("contextmenu",e=>{
  if(!img) return;
  e.preventDefault();
  const p=canvasPos(e), hitR=Math.max(8,imgW/120);
  const i=anchors.findIndex(q=>Math.hypot(q.x-p.x,q.y-p.y)<hitR);
  if(i>=0){ anchors.splice(i,1); tryFit(); updateBtns(); }
});
function updateBtns(){
  $("btnClear").disabled=!img||!anchors.length;
  $("btnUndo").disabled=!img||!anchors.length;
}
$("btnClear").onclick=()=>{ anchors=[]; ellipse=null; drawOverlay(); updateBtns(); $("flatInfo").textContent=""; $("extInfo").textContent=""; setStatus("已清空锚点。"); };
$("btnUndo").onclick=()=>{ anchors.pop(); tryFit(); updateBtns(); };

/* ---------------- 参数 ---------------- */
const bind=(id,vid,fmt)=>{ const el=$(id); el.addEventListener("input",()=>{ $(vid).textContent=fmt?fmt(el.value):el.value; }); };
bind("pRadius","vRadius",v=>(v/100).toFixed(2));
bind("pSize","vSize"); bind("pAlpha","vAlpha"); bind("pStroke","vStroke",v=>v+"%"); bind("pEdge","vEdge");

$("pRadius").addEventListener("input",()=>{ if(ellipse){ drawOverlay(); renderFlat(); } });
$("pSize").addEventListener("input",()=>{ if(ellipse) renderFlat(); });
$("pSS").addEventListener("change",()=>{ if(ellipse) renderFlat(); });
$("pSnap").addEventListener("change",()=>{ tryFit(); });

let cleanPending=false;
function scheduleClean(){
  if(!flatData || cleanPending) return;
  cleanPending=true;
  requestAnimationFrame(()=>{ cleanPending=false; if(flatData) runClean(); });
}
for(const id of ["pAlpha","pStroke","pEdge","pBlobs","pStruct","pCrop"]){
  $(id).addEventListener("input",scheduleClean);
  $(id).addEventListener("change",scheduleClean);
}

/* ---------------- 导出 ---------------- */
function saveCanvas(cv,name){
  cv.toBlob(b=>{
    const a=document.createElement("a");
    a.href=URL.createObjectURL(b); a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  },"image/png");
}
$("btnSaveFlat").onclick=()=>saveCanvas(flatCanvas,"magic_circle_flat.png");
$("btnSaveExt").onclick=()=>saveCanvas(extCanvas,"magic_circle_extracted.png");
