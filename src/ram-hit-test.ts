/** Pixel hit testing for the visible Ram body. The surrounding scene button
 * remains a keyboard-accessible control, but pointer clicks outside painted
 * pixels are redirected to the room floor instead of touching the pet. */
export interface HitRect {left:number;top:number;width:number;height:number}
export function alphaAt(data:Uint8ClampedArray,width:number,height:number,x:number,y:number,threshold=32):boolean {
  const px=Math.floor(x),py=Math.floor(y)
  if(px<0||py<0||px>=width||py>=height)return false
  return data[(py*width+px)*4+3]>=threshold
}
export function pointInPaintedRect(data:Uint8ClampedArray,width:number,height:number,rect:HitRect,clientX:number,clientY:number,threshold=32):boolean {
  if(clientX<rect.left||clientY<rect.top||clientX>rect.left+rect.width||clientY>rect.top+rect.height)return false
  return alphaAt(data,width,height,(clientX-rect.left)/rect.width*width,(clientY-rect.top)/rect.height*height,threshold)
}
export function isRamBodyPoint(root:HTMLElement,clientX:number,clientY:number):boolean {
  const canvases=[...root.querySelectorAll<HTMLCanvasElement>('canvas.ram-classic-frame,canvas.seed-body-frame')].filter(canvas=>getComputedStyle(canvas).visibility!=='hidden'&&canvas.width>0&&canvas.height>0)
  let painted=false
  for(const canvas of canvases){
    const rect=canvas.getBoundingClientRect(),ctx=canvas.getContext('2d');if(!ctx)continue
    painted=true
    if(pointInPaintedRect(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,{left:rect.left,top:rect.top,width:rect.width,height:rect.height},clientX,clientY))return true
  }
  // During the first decode frame, keep the control usable. Once a body is
  // painted, all transparent pixels are deliberately excluded.
  return !painted
}
