/**
 * 이 파일은 커뮤니티 화면에서 사용하는 글·사진·신고·이의제기 자료의 형태를 정의합니다.
 */

/** 비공개 Storage에 저장된 사진의 메타데이터와 임시 보기 주소입니다. */
export type CommunityMedia = {
  id: string;
  /** Supabase 저장 경로이며 Worker API 응답에서는 비공개 경로를 노출하지 않습니다. */
  object_path?: string;
  byte_size: number;
  content_type: string;
  signed_url?: string;
};

/** 방명록 목록에 표시할 글과 작성자·첨부 정보입니다. */
export type GuestbookPost = {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  is_mine: boolean;
  media: CommunityMedia[];
};

/** 일정 후기 목록에 표시할 별점·본문·첨부 정보입니다. */
export type ScheduleReview = {
  id: string;
  schedule_id: string;
  author_name: string;
  body: string;
  rating: number;
  created_at: string;
  is_mine: boolean;
  media: CommunityMedia[];
};

/** 관리자가 신고 검토 화면에서 판단할 수 있도록 전달되는 신고 자료입니다. */
export type ContentReport = {
  id: string;
  content_type: 'guestbook' | 'review';
  content_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'actioned' | 'dismissed';
  created_at: string;
  target_excerpt: string;
  target_author: string;
};

/** 숨김 조치 이후 작성자가 제출한 이의제기와 운영자 판단 결과입니다. */
export type ContentAppeal = {
  id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  decided_at: string | null;
  decision_reason: string | null;
};

/** 관리자 및 작성자 화면에서 숨김·삭제 예정 상태를 확인할 콘텐츠입니다. */
export type HiddenCommunityContent = {
  id: string;
  content_type: 'guestbook' | 'review';
  schedule_id: string | null;
  author_name: string;
  body: string;
  rating: number | null;
  created_at: string;
  status: 'published' | 'hidden' | 'purging';
  moderation_reason: string | null;
  hidden_at: string | null;
  purge_after: string | null;
  appeal: ContentAppeal | null;
  media: Array<Pick<CommunityMedia, 'id' | 'signed_url'>>;
};

/** 내 게시글 화면에서 작성자 본인의 콘텐츠와 검토 상태를 표시합니다. */
export type MyCommunityContent = HiddenCommunityContent;

/** 기각 사유를 작성자에게 보여주고 보관 종료 시점을 안내하는 결과입니다. */
export type CommunityAppealResult = {
  id: string;
  content_type: 'guestbook' | 'review';
  content_created_at: string;
  decision_reason: string;
  decided_at: string;
  expires_at: string;
};

/** 방문자 기능의 읽기 가능 상태와 관리자가 제어하는 중단 스위치입니다. */
export type CommunitySettings = {
  community_enabled: boolean;
  uploads_enabled: boolean;
  media_views_enabled: boolean;
};

/** 관리자 대시보드가 중단 스위치와 함께 보여주는 사용량 현황입니다. */
export type AdminCommunitySettings = CommunitySettings & {
  storage_used_bytes: number;
  storage_limit_bytes: number;
  database_used_bytes: number;
  database_warning_bytes: number;
  database_stop_bytes: number;
  egress_warning_bytes: number;
  egress_stop_bytes: number;
};
