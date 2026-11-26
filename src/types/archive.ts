/**
 * 이 파일은 장소·일정·곡 데이터의 공통 형태와 세트리스트 확인 상태를 정의합니다.
 */

/** 지도에서 여러 일정이 공유하는 장소와 지도 좌표를 표현합니다. */
export type Location = {
  id: string;
  name: string;
  countryCode?: CountryCode; // 생략하면 대한민국(KR) 장소로 취급
  address?: string; // 좌표와 장소를 검토·중복 확인할 때 쓰는 실제 주소
  coordinates?: [number, number]; // [경도, 위도]. 좌표 후보가 없으면 주소만 보존하고 지도에서는 제외
};

/** 해외 지역 메뉴와 장소 필터가 사용하는 국가 식별자입니다. */
export type CountryCode = 'KR' | 'CN' | 'JP' | 'TH';

/** 일정 세트리스트가 참조하는 곡 카탈로그 항목입니다. */
export type Song = {
  id: string;
  title: string;
};

/** 일정 상세에서 종류별로 보여줄 미디어 연결 정보입니다. */
export type ScheduleMedia = {
  photos?: string[];
  youtube?: string[];
  xPosts?: string[];
  officialGroupPhotos?: string[]; // 확인된 HTTPS 이미지 주소 또는 public/media/official/ 로컬 경로
  officialIndividualPhotos?: string[]; // 확인된 HTTPS 이미지 주소 또는 public/media/official/ 로컬 경로
  officialReels?: string[]; // 공식 Instagram 게시물 링크
};

/** 지도 장소가 필요한지 판단할 때 쓰는 일정 진행 방식입니다. */
export type EventFormat = 'in-person' | 'online' | 'hybrid' | 'unknown';

/** 확인된 시작 시간 문자열에서 유효한 시 범위만 허용합니다. */
type Hour =
  | `${'0' | '1'}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
  | `2${0 | 1 | 2 | 3}`;
/** 확인된 시작 시간 문자열에서 유효한 분 범위만 허용합니다. */
type Minute =
  `${0 | 1 | 2 | 3 | 4 | 5}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

/** 아카이브 화면 전체가 공유하는 일정 원본 자료입니다. */
export type Schedule = {
  id: string;
  locationId?: Location['id']; // 실제 장소가 없는 온라인 행사나 아직 장소를 모르는 행사에서는 생략
  eventFormat: EventFormat;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: `${Hour}:${Minute}`; // HH:mm (00:00~23:59), 미확인일 때 생략
  orderInDay?: number; // 같은 날짜의 행사 순서 (1부터), 전체 순번 아님
  media?: ScheduleMedia; // 미디어는 외부 주소와 선택적으로 보관한 공식 사진의 정적 경로를 연결
} & ( // 배열 순서는 공연 순서입니다. 곡별 누적 공연 순번은 저장하지 않습니다.
  | { setlistStatus: 'known'; setlist: [Song['id'], ...Song['id'][]] }
  | { setlistStatus: 'partial'; setlist: [Song['id'], ...Song['id'][]] } // 일부 곡과 확인된 순서만 기록
  | { setlistStatus: 'provisional'; setlist: [Song['id'], ...Song['id'][]] } // 기본 입력값이며 실제 공연 내용 확인 전
  | { setlistStatus: 'unknown'; setlist: [] } // 세트리스트 미확인
  | { setlistStatus: 'none'; setlist: [] } // 곡 공연이 없었음을 확인
);
