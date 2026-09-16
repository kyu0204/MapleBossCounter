/**
 * 넥슨 캐릭터 이미지(300×300 PNG, 투명 배경)에서 얼굴 쪽을 크게 잘라 보여준다.
 *
 * 실측 (캐릭터 6개의 불투명 픽셀):
 *   전신   x 85~194, y 125~210
 *   머리   x 108~178, y 125~175  (가로 최대 70, 세로 약 46)
 * 전신을 다 담으면 얼굴이 박스의 3분의 1밖에 안 된다. 목록에서 누가 누구인지
 * 알아보려면 얼굴이 커야 하므로, 다리 쪽을 잘라 내고 얼굴을 채운다.
 */

/** 머리 중심 (실측 평균) */
const FACE_CENTER = { x: 145, y: 149 };

/**
 * 박스를 가득 채울 원본 폭. 이 값이 배율을 정한다.
 *
 * 크기와 무관하게 원본의 x 107~183, y 111~187 이 보이므로 머리(x 108~178,
 * y 125~175)는 어느 크기에서도 잘리지 않는다. 대신 y 187 아래(다리)는 잘린다.
 * 작게 잡을수록 얼굴이 커지고 몸이 더 잘린다.
 *
 * 머리 왼쪽 끝이 x 108 이라 이보다 더 좁히면 머리카락이 잘리기 시작한다.
 */
const CONTENT_BOX = 76;

export function CharacterAvatar({ src, alt = "", size = 112, className = "" }: { src: string | null | undefined; alt?: string; size?: number; className?: string }) {
  const box = { width: size, height: size };
  if (!src) return <div className={`rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 ${className}`} style={box} />;

  const scale = size / CONTENT_BOX;
  const ox = size / 2 - FACE_CENTER.x * scale;
  const oy = size / 2 - FACE_CENTER.y * scale;
  return (
    <div className={`relative overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-800/60 shrink-0 ${className}`} style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={300}
        height={300}
        // 확대할 때만 픽셀 그대로 키운다. 축소에 pixelated 를 쓰면 계단현상이 생긴다.
        className={`absolute max-w-none select-none ${scale >= 1 ? "[image-rendering:pixelated]" : ""}`}
        style={{ width: 300 * scale, height: 300 * scale, left: ox, top: oy }}
        draggable={false}
      />
    </div>
  );
}
