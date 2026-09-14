/**
 * 넥슨 캐릭터 이미지(300×300 PNG, 투명 배경)에서 캐릭터가 실제로 그려진 영역만 잘라 보여준다.
 * 실측: 캐릭터는 대략 x 85~195, y 125~210 (중심 ≈ 140,168, 약 110×85px). 나머지는 투명 여백.
 * object-fit:none 으로 1:1 픽셀 스케일을 유지하고 object-position 으로 그 중심을 박스 중앙에 맞춘다.
 */
const SRC_CENTER = { x: 140, y: 168 };

export function CharacterAvatar({ src, alt = "", size = 112, className = "" }: { src: string | null | undefined; alt?: string; size?: number; className?: string }) {
  const box = { width: size, height: size };
  if (!src) return <div className={`rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 ${className}`} style={box} />;
  // 1:1 스케일에서 박스 중앙에 캐릭터 중심이 오도록 오프셋. 박스가 130 보다 크면 살짝 확대해 채운다.
  const scale = Math.max(1, size / 130);
  const ox = size / 2 - SRC_CENTER.x * scale;
  const oy = size / 2 - SRC_CENTER.y * scale;
  return (
    <div className={`relative overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-800/60 shrink-0 ${className}`} style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={300}
        height={300}
        className="absolute max-w-none select-none [image-rendering:pixelated]"
        style={{ width: 300 * scale, height: 300 * scale, left: ox, top: oy }}
        draggable={false}
      />
    </div>
  );
}
