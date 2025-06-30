// Mock canvas module to prevent JSDOM errors
// This completely replaces any canvas package imports
/* eslint-disable @typescript-eslint/no-empty-function */

export const createCanvas = (width = 300, height = 150) => {
  const canvas = {
    width,
    height,
    getContext: (type: string) => {
      if (type === '2d') {
        return {
          fillRect: () => {},
          clearRect: () => {},
          getImageData: () => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
          }),
          putImageData: () => {},
          createImageData: () => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
          }),
          setTransform: () => {},
          drawImage: () => {},
          save: () => {},
          fillText: () => {},
          restore: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          stroke: () => {},
          translate: () => {},
          scale: () => {},
          rotate: () => {},
          arc: () => {},
          fill: () => {},
          measureText: () => ({ width: 0 }),
          transform: () => {},
          rect: () => {},
          clip: () => {},
          canvas,
          fillStyle: '#000000',
          strokeStyle: '#000000',
          lineWidth: 1,
          font: '10px sans-serif',
          textAlign: 'start',
          textBaseline: 'alphabetic',
          globalAlpha: 1,
          globalCompositeOperation: 'source-over',
        };
      }
      return null;
    },
    toDataURL: () => {
      const hash = Math.random().toString(36).substring(7);
      return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==${hash}`;
    },
    toBlob: (callback: (blob: Blob | null) => void, type?: string) => {
      setTimeout(() => {
        const blob = new Blob(['mock-canvas-blob'], {
          type: type || 'image/png',
        });
        callback(blob);
      }, 0);
    },
  };

  return canvas;
};

export const loadImage = (src: string) => {
  return Promise.resolve({
    src,
    width: 100,
    height: 100,
    complete: true,
  });
};

export default {
  createCanvas,
  loadImage,
};
