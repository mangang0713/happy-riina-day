/** 지도 밖의 일정 상세에서도 기존 사진 갤러리와 확대보기를 재사용합니다. */
import { useEffect, useRef } from 'react';
import type { ScheduleMedia } from '../../types/archive';
import { renderPhotoGallery } from './photoGallery';

/** 행사별로 이미 분류한 공식 사진만 받으며 이용자 업로드 사진과 구분합니다. */
type OfficialSchedulePhotosProps = { media?: ScheduleMedia };

export default function OfficialSchedulePhotos({
  media,
}: OfficialSchedulePhotosProps) {
  const containerRef = useRef<HTMLElement>(null);
  const groupPhotos = media?.officialGroupPhotos;
  const individualPhotos = media?.officialIndividualPhotos;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const disposers: Array<() => void> = [];
    if (groupPhotos?.length) {
      disposers.push(
        renderPhotoGallery(
          container,
          groupPhotos,
          `그룹 단체사진 ${groupPhotos.length}`,
        ),
      );
    }
    if (individualPhotos?.length) {
      disposers.push(
        renderPhotoGallery(
          container,
          individualPhotos,
          `개인 사진 ${individualPhotos.length}`,
        ),
      );
    }
    // 다른 일정으로 전환하거나 화면을 닫으면 확대창과 이벤트도 함께 정리합니다.
    return () => disposers.forEach((dispose) => dispose());
  }, [groupPhotos, individualPhotos]);

  if (!groupPhotos?.length && !individualPhotos?.length) return null;
  return <section ref={containerRef} aria-label="공식 사진" />;
}
