/** Load events work on embedded browsers where decode() may reject valid art. */
export function loadAnimationImage(url: string, dimensions?: {width: number; height: number}): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const clearHandlers = () => { image.onload = image.onerror = null; };
    image.onload = () => {
      clearHandlers();
      if (dimensions && (image.naturalWidth !== dimensions.width || image.naturalHeight !== dimensions.height)) {
        reject(new Error('动画图集尺寸不匹配'));
      } else {
        resolve(image);
      }
    };
    image.onerror = () => {
      clearHandlers();
      reject(new Error('动画素材加载失败'));
    };
    image.src = url;
  });
}
