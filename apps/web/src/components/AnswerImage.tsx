import { Typography } from 'antd';
import { useEffect, useState } from 'react';

interface Props {
  imageKey: string;
  load: () => Promise<Blob>;
  pageNo: number;
  partIndex: number;
  crop: { x: number; y: number; width: number; height: number } | null;
}

export function AnswerImage({ imageKey, load, pageNo, partIndex, crop }: Props) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl = '';
    setUrl('');
    setError(false);
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
  return (
    <div style={{ width: 200 }}>
      {url ? (
        <img src={url} alt={'第' + pageNo + '页'} style={{ width: '100%', border: '1px solid #eee' }} />
      ) : (
        <div style={{ height: 80, lineHeight: '80px', textAlign: 'center', color: error ? '#c00' : undefined }}>
          {error ? '图片加载失败' : '加载图片中'}
        </div>
      )}
      <Typography.Text type="secondary">
        第{pageNo}页 / 片段{partIndex}
        {crop ? ' / 裁剪' : ''}
      </Typography.Text>
    </div>
  );
}
