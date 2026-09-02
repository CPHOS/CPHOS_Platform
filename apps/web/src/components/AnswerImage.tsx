import { Typography } from 'antd';
import { useEffect, useState } from 'react';

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  imageKey: string;
  load: () => Promise<Blob>;
  pageNo: number;
  partIndex: number;
  crop: Crop | null;
}

const DISPLAY_WIDTH = 200;

export function AnswerImage({ imageKey, load, pageNo, partIndex, crop }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setUrl('');
    setError(false);
    setNatural(null);
    void load()
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // imageKey 唯一标识任务+页+片段，load 每次渲染重建但行为一致
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  const cropped = !!crop && !!natural;
  const scale = cropped ? DISPLAY_WIDTH / crop.width : 1;
  const frameWidth = DISPLAY_WIDTH;
  const frameHeight = cropped ? Math.min(360, Math.max(80, crop.height * scale)) : undefined;

  return (
    <div style={{ width: frameWidth }}>
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          overflow: 'hidden',
          border: '1px solid #eee',
          background: '#fafafa',
        }}
      >
        {url ? (
          <img
            src={url}
            alt={'第' + pageNo + '页'}
            onLoad={(e) => {
              const image = e.currentTarget;
              setNatural({ width: image.naturalWidth, height: image.naturalHeight });
            }}
            style={
              cropped
                ? {
                    width: natural.width * scale,
                    maxWidth: 'none',
                    marginLeft: -crop.x * scale,
                    marginTop: -crop.y * scale,
                    display: 'block',
                  }
                : { width: '100%', display: 'block' }
            }
          />
        ) : (
          <div style={{ height: frameHeight ?? 80, lineHeight: (frameHeight ?? 80) + 'px', textAlign: 'center', color: error ? '#c00' : undefined }}>
            {error ? '图片加载失败' : '加载图片中'}
          </div>
        )}
      </div>
      <Typography.Text type="secondary">
        第{pageNo}页 / 片段{partIndex}
        {crop ? ' / 裁剪 x' + crop.x + ' y' + crop.y + ' w' + crop.width + ' h' + crop.height : ''}
      </Typography.Text>
    </div>
  );
}
