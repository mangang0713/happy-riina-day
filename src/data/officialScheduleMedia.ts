/**
 * 이 파일은 공식 계정의 확인된 이미지 주소·로컬 사진을 일정과 분류에 연결합니다.
 */

import type { Schedule } from '../types/archive';
import { officialXPhotoPosts } from './officialXPhotos';

type OfficialScheduleMedia = Pick<
  NonNullable<Schedule['media']>,
  'officialGroupPhotos' | 'officialIndividualPhotos' | 'officialReels'
>;
type OfficialPhotoCategory = 'group' | 'individual';

// GitHub Pages 하위 경로와 로컬 개발 경로를 모두 지원합니다.
/** 공식 사진 파일의 저장소 공개 경로를 생성해 일정 분류에 연결합니다. */
export function officialPhoto(
  date: Schedule['date'],
  category: OfficialPhotoCategory,
  filename: string,
) {
  return `${import.meta.env.BASE_URL}media/official/${date}/${category}/${filename}`;
}

// X 사진의 이미지 주소·원본 게시물·일정 연결 근거는 officialXPhotos.ts에서 관리합니다.
// 로컬 사진은 public/media/official/<YYYY-MM-DD>/<분류>/에 넣고 officialPhoto로 연결합니다.
// 본문에 행사 날짜가 있으면 게시일보다 우선하고, 복수 일정의 연결 대상을 명시합니다.
// 예: 'schedule-2026-05-02-01': {
//   officialGroupPhotos: [officialPhoto('2026-05-02', 'group', '01.webp')],
//   officialIndividualPhotos: [officialPhoto('2026-05-02', 'individual', '01.webp')],
//   officialReels: ['https://www.instagram.com/reel/게시물ID/'],
// },
/** 직접 접근을 확인한 공식 사진을 기존 일정의 그룹·개인 사진 탭에 연결합니다. */
export const officialScheduleMediaByScheduleId: Partial<
  Record<Schedule['id'], OfficialScheduleMedia>
> = {};

// 한 원문이 여러 행사를 함께 언급하면 목록에 명시한 일정 ID에만 연결합니다.
// 같은 이미지가 여러 원문에 포함되어도 한 일정의 탭에서는 한 번만 표시합니다.
for (const post of officialXPhotoPosts) {
  const field =
    post.category === 'group'
      ? 'officialGroupPhotos'
      : 'officialIndividualPhotos';
  for (const scheduleId of post.scheduleIds) {
    const media = officialScheduleMediaByScheduleId[scheduleId] ?? {};
    media[field] = [...new Set([...(media[field] ?? []), ...post.photoUrls])];
    officialScheduleMediaByScheduleId[scheduleId] = media;
  }
}
