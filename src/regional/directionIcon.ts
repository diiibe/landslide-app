import type { ExpressionSpecification } from "maplibre-gl";
/** A north-pointing navigation symbol, independent of a provider's font glyphs. */
export const DIRECTION_IMAGE = "regional-direction-arrow";
export function directionIcon(fill: readonly [number, number, number] = [23, 45, 37]) {
  const width = 24, height = 32, data = new Uint8Array(width * height * 4);
  const outer = [[12,1],[23,14],[16,14],[16,31],[8,31],[8,14],[1,14]];
  const inner = [[12,4],[19,12],[14,12],[14,29],[10,29],[10,12],[5,12]];
  const inside = (x: number, y: number, polygon: number[][]) => {
    let result = false;
    for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
      const a=polygon[i]!, b=polygon[j]!;
      if ((a[1]!>y)!==(b[1]!>y) && x<(b[0]!-a[0]!)*(y-a[1]!)/(b[1]!-a[1]!)+a[0]!) result=!result;
    }
    return result;
  };
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    let covered=0,dark=0;
    for(let sy=0;sy<4;sy++) for(let sx=0;sx<4;sx++) {
      const px=x+(sx+.5)/4,py=y+(sy+.5)/4;
      if(inside(px,py,outer)) covered++;
      if(inside(px,py,inner)) dark++;
    }
    if (!covered) continue;
    const offset=(y*width+x)*4, ratio=dark/covered;
    data[offset]=Math.round(246*(1-ratio)+fill[0]*ratio);
    data[offset+1]=Math.round(245*(1-ratio)+fill[1]*ratio);
    data[offset+2]=Math.round(237*(1-ratio)+fill[2]*ratio);
    data[offset+3]=Math.round(255*covered/16);
  }
  return {width,height,data};
}

/** Icon dimensions stay within 15–29 CSS pixels, independent of ground scale. */
export const directionSize = (): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 5, .6, 10, .8, 14, .9];
