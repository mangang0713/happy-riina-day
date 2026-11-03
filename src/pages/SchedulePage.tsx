/**
 * 이 페이지는 특정 일정의 세트리스트와 미디어, 좋아요, 후기 기능을 제공합니다.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { locations } from '../data/locations';
import { schedules } from '../data/schedules';
import { songs } from '../data/songs';
import { getSongPerformanceNumber } from '../data/songStats';
import { useAuth } from '../features/auth/authContext';
import {
  acceptCommunityTerms,
  deleteCommunityContent,
  deleteCommunityMedia,
  getCommunityErrorDetails,
  getOwnScheduleReview,
  getScheduleReactions,
  getScheduleReviews,
  hideCommunityContent,
  reportCommunityContent,
  saveScheduleReview,
  toggleScheduleLike,
} from '../features/community/api';
import {
  claimHessxlAdmin,
  isCurrentArchiveAdmin,
} from '../features/community/adminApi';
import type {
  CommunityMedia,
  ScheduleReview,
} from '../features/community/types';
import CommunityReportDialog from '../components/community/CommunityReportDialog';
import ModerationReasonDialog from '../components/community/ModerationReasonDialog';
import TurnstileWidget from '../components/security/TurnstileWidget';
import './CommunityPages.css';

const MAX_REVIEW_IMAGES = 3;

/** 일정 ID를 기준으로 세트리스트, 미디어, 좋아요와 후기 조회·작성을 연결합니다. */
function SchedulePage() {
  const { scheduleId = '' } = useParams();
  const { user } = useAuth();
  const [adminCheck, setAdminCheck] = useState<{
    userId: string;
    isAdmin: boolean;
  } | null>(null);
  const userIdForFetch = user?.id;
  const schedule = useMemo(
    () => schedules.find((item) => item.id === scheduleId),
    [scheduleId],
  );
  const location = schedule?.locationId
    ? locations.find((item) => item.id === schedule.locationId)
    : undefined;
  const scheduleIdForFetch = schedule?.id;
  const [reviews, setReviews] = useState<ScheduleReview[]>([]);
  const [reviewPage, setReviewPage] = useState(0);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [ownReviewId, setOwnReviewId] = useState<string>();
  const [reportedReviews, setReportedReviews] = useState<{
    userId: string | undefined;
    scheduleId: string | undefined;
    ids: Set<string>;
  }>(() => ({ userId: undefined, scheduleId: undefined, ids: new Set() }));
  const [body, setBody] = useState('');
  const [bodyError, setBodyError] = useState('');
  const [rating, setRating] = useState(5);
  const [files, setFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<
    Array<{ file: File; url: string }>
  >([]);
  const previewUrlsRef = useRef<string[]>([]);
  const consentCheckboxRef = useRef<HTMLInputElement>(null);
  const reviewBodyRef = useRef<HTMLTextAreaElement>(null);
  const [consentError, setConsentError] = useState('');
  const [submissionError, setSubmissionError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [message, setMessage] = useState('');
  const messageTimeoutRef = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [reportTarget, setReportTarget] = useState<ScheduleReview | null>(null);
  const [reportingId, setReportingId] = useState<string>();
  const [reportDialogStep, setReportDialogStep] = useState<'form' | 'success'>(
    'form',
  );
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [moderationTarget, setModerationTarget] =
    useState<ScheduleReview | null>(null);
  const [moderationError, setModerationError] = useState('');
  const [moderationSuccess, setModerationSuccess] = useState('');
  const [moderationSubmitting, setModerationSubmitting] = useState(false);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (messageTimeoutRef.current !== null) {
        window.clearTimeout(messageTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!message) return;
    if (messageTimeoutRef.current !== null) {
      window.clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage('');
      messageTimeoutRef.current = null;
    }, 3500);
    return () => {
      if (messageTimeoutRef.current !== null) {
        window.clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [message]);

  const refresh = useCallback(async () => {
    if (!scheduleIdForFetch) return;
    try {
      const [nextReviews, reactions] = await Promise.all([
        getScheduleReviews(scheduleIdForFetch),
        getScheduleReactions(scheduleIdForFetch, userIdForFetch),
      ]);
      let visibleReviews = nextReviews;
      if (
        reactions.ownReviewId &&
        !nextReviews.some((review) => review.id === reactions.ownReviewId)
      ) {
        const ownReview = await getOwnScheduleReview(scheduleIdForFetch);
        if (ownReview) visibleReviews = [...nextReviews, ownReview];
      }
      setReviews(visibleReviews);
      setReviewPage(0);
      setHasMoreReviews(nextReviews.length === 12);
      setLikeCount(reactions.likeCount);
      setLiked(reactions.liked);
      setOwnReviewId(reactions.ownReviewId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '일정 반응을 불러오지 못했습니다.',
      );
    }
  }, [scheduleIdForFetch, userIdForFetch]);

  // 페이지 진입과 로그인 상태 변경 시 원격 후기를 읽어옵니다.

  useEffect(() => {
    // 일정 상세가 열리면 해당 일정의 후기와 반응을 서버에서 읽어옵니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void claimHessxlAdmin()
      .then(isCurrentArchiveAdmin)
      .then((isAdmin) => {
        if (active) setAdminCheck({ userId: user.id, isAdmin });
      })
      .catch(() => {
        if (active) setAdminCheck({ userId: user.id, isAdmin: false });
      });
    return () => {
      active = false;
    };
  }, [user]);

  if (!schedule) {
    return (
      <section className="community-page">
        <div className="community-alert">해당 일정을 찾을 수 없습니다.</div>
        <Link to="/archive">지도에서 찾기</Link>
      </section>
    );
  }
  const currentSchedule = schedule;
  const songById = new Map(songs.map((song) => [song.id, song]));

  function replaceSelectedPhotos(nextFiles: File[]) {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const previews = nextFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    previewUrlsRef.current = previews.map((preview) => preview.url);
    setFiles(nextFiles);
    setPhotoPreviews(previews);
    setSubmissionError(null);
  }

  function addSelectedPhotos(newFiles: File[]) {
    const fileKey = (file: File) =>
      `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    const existing = new Set(files.map(fileKey));
    const additions = newFiles.filter((file) => {
      const key = fileKey(file);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    const remaining = MAX_REVIEW_IMAGES - files.length;
    if (additions.length > remaining) {
      setMessage(
        `사진은 후기당 최대 ${MAX_REVIEW_IMAGES}장까지 선택할 수 있어 ${remaining}장만 추가했습니다.`,
      );
    } else if (additions.length < newFiles.length) {
      setMessage('이미 선택한 사진은 중복으로 추가하지 않았습니다.');
    } else setMessage('');
    replaceSelectedPhotos([...files, ...additions.slice(0, remaining)]);
  }

  async function handleLike() {
    setBusy(true);
    try {
      const result = await toggleScheduleLike(currentSchedule.id);
      setLiked(result.liked);
      setLikeCount((count) => count + (result.liked ? 1 : -1));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '좋아요를 반영하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (body.trim().length < 2) {
      setBodyError('후기는 두 글자 이상 입력해 주세요.');
      reviewBodyRef.current?.focus();
      return;
    }
    setBodyError('');
    if (
      files.length > MAX_REVIEW_IMAGES ||
      files.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
      )
    ) {
      setMessage(
        `JPG, PNG, WebP 사진을 후기당 ${MAX_REVIEW_IMAGES}장까지 선택해 주세요. 1MB 초과 사진은 업로드 전에 자동으로 줄입니다.`,
      );
      return;
    }
    if (!termsAccepted) {
      setConsentError('후기를 등록하려면 공개 안내를 확인하고 동의해 주세요.');
      consentCheckboxRef.current?.focus();
      return;
    }
    setConsentError('');
    setBusy(true);
    setSubmissionError(null);
    try {
      await acceptCommunityTerms();
      await saveScheduleReview(
        currentSchedule.id,
        body.trim(),
        rating,
        files,
        editingId,
        turnstileToken,
      );
      setBody('');
      setBodyError('');
      replaceSelectedPhotos([]);
      setEditingId(undefined);
      setTurnstileResetKey((key) => key + 1);
      setTurnstileToken('');
      setTermsAccepted(false);
      setConsentError('');
      await refresh();
      setMessage('후기를 저장했습니다.');
    } catch (error) {
      setSubmissionError(getCommunityErrorDetails(error));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function openReportDialog(review: ScheduleReview) {
    if (reportingId || reportedReviewIdsForCurrentUser.has(review.id)) return;
    setReportDetails('');
    setReportError('');
    setReportDialogStep('form');
    setReportTarget(review);
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const review = reportTarget;
    if (!review || reportingId) return;
    setReportingId(review.id);
    setReportError('');
    try {
      await reportCommunityContent(
        'review',
        review.id,
        '기타',
        reportDetails.trim(),
      );
      setReportedReviews((current) => ({
        userId: user?.id,
        scheduleId: currentSchedule.id,
        ids: new Set(
          current.userId === user?.id &&
          current.scheduleId === currentSchedule.id
            ? current.ids
            : [],
        ).add(review.id),
      }));
      setReportDialogStep('success');
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : '신고를 접수하지 못했습니다.',
      );
    } finally {
      setReportingId(undefined);
    }
  }

  function closeReportDialog() {
    if (reportingId) return;
    setReportTarget(null);
    setReportDetails('');
    setReportError('');
    setReportDialogStep('form');
  }

  async function handleDelete(reviewId: string) {
    const review = reviews.find((item) => item.id === reviewId);
    if (!review) return;
    const moderatingAnotherUsersPost = isAdmin && !review.is_mine;
    if (moderatingAnotherUsersPost) {
      setModerationTarget(review);
      setModerationError('');
      setModerationSuccess('');
      return;
    }
    if (
      !window.confirm(
        '이 후기와 첨부 사진을 영구 삭제할까요? 삭제한 후기와 신고 기록은 복구할 수 없습니다.',
      )
    ) {
      return;
    }
    try {
      await deleteCommunityContent('review', reviewId);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '후기를 삭제하지 못했습니다.',
      );
    }
  }

  async function submitHideReason(reason: string) {
    if (!moderationTarget) return;
    setModerationSubmitting(true);
    setModerationError('');
    try {
      await hideCommunityContent('review', moderationTarget.id, reason);
      void refresh();
      setModerationSuccess(
        '작성자는 내 게시글에서 7일 안에 이의제기할 수 있습니다.',
      );
    } catch (error) {
      setModerationError(
        error instanceof Error ? error.message : '후기를 숨기지 못했습니다.',
      );
    } finally {
      setModerationSubmitting(false);
    }
  }

  function closeModerationDialog() {
    if (moderationSubmitting) return;
    setModerationTarget(null);
    setModerationError('');
    setModerationSuccess('');
  }

  async function removePhoto(media: CommunityMedia) {
    if (!window.confirm('이 사진만 삭제할까요? 후기는 그대로 남습니다.')) {
      return;
    }
    try {
      await deleteCommunityMedia(media.id);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '사진을 삭제하지 못했습니다.',
      );
    }
  }

  async function loadMoreReviews() {
    try {
      const nextPage = reviewPage + 1;
      const next = await getScheduleReviews(currentSchedule.id, nextPage);
      setReviews((current) => [
        ...current,
        ...next.filter(
          (review) => !current.some((item) => item.id === review.id),
        ),
      ]);
      setReviewPage(nextPage);
      setHasMoreReviews(next.length === 12);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '후기를 더 불러오지 못했습니다.',
      );
    }
  }

  const isAdmin = Boolean(
    user && adminCheck?.userId === user.id && adminCheck.isAdmin,
  );
  const canReportContent = Boolean(
    user && adminCheck?.userId === user.id && !isAdmin,
  );
  const reportedReviewIdsForCurrentUser =
    reportedReviews.userId === user?.id &&
    reportedReviews.scheduleId === currentSchedule.id
      ? reportedReviews.ids
      : new Set<string>();
  const reportedReviewIds = reportedReviewIdsForCurrentUser;
  const visibleReviews = reviews.filter(
    (review) => !reportedReviewIds.has(review.id),
  );

  return (
    <section className="community-page schedule-community-page">
      <Link className="back-link" to="/archive">
        ← 지도
      </Link>
      <div className="community-heading">
        <span className="community-eyebrow">SCHEDULE RECORD</span>
        <h1>{schedule.title}</h1>
        <div className="schedule-heading-meta">
          <p>
            {schedule.date.replaceAll('-', '.')} ·{' '}
            {location?.name ??
              (schedule.eventFormat === 'online' ? '온라인' : '장소 미확인')}
          </p>
          {schedule.startTime && (
            <span className="schedule-time">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="6.25" />
                <path d="M8 4.5v3.8l2.4 1.4" />
              </svg>
              <span>시작 {schedule.startTime}</span>
            </span>
          )}
        </div>
      </div>
      {schedule.eventFormat !== 'online' &&
        (schedule.setlist.length > 0 || schedule.setlistStatus === 'none') && (
          <section className="schedule-setlist-card">
            <h2>세트리스트</h2>
            {schedule.setlistStatus === 'none' ? (
              <p className="community-small">행사에서 진행된 곡이 없습니다.</p>
            ) : (
              <ol className="schedule-setlist">
                {schedule.setlist.map((songId, index) => {
                  const song = songById.get(songId);
                  const performanceNumber = getSongPerformanceNumber(
                    songId,
                    currentSchedule.id,
                  );
                  return (
                    <li key={`${songId}-${index}`}>
                      <span className="schedule-song-title">
                        {song?.title ?? `곡 정보 오류 (${songId})`}
                      </span>
                      {song && performanceNumber !== undefined && (
                        <span className="schedule-song-count">
                          기록상 {performanceNumber}번째 무대
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      <div className="schedule-community-actions">
        <button
          className={`like-button${liked ? ' is-liked' : ''}`}
          type="button"
          disabled={!user || busy}
          onClick={() => void handleLike()}
          aria-pressed={liked}
        >
          ♥ {liked ? '좋아요' : '좋아요'} · {likeCount}
        </button>
      </div>
      <section className="schedule-reviews">
        <div className="community-list-heading">
          <h2>후기</h2>
          <span>{visibleReviews.length}개 표시</span>
        </div>
        {user && (!ownReviewId || editingId) && (
          <form
            className="community-form review-form"
            onSubmit={(event) => void submitReview(event)}
          >
            <label htmlFor="review-body">다녀온 느낌을 남겨 주세요</label>
            <div className="rating-field">
              <label htmlFor="review-rating">별점</label>
              <select
                id="review-rating"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {'★'.repeat(value)} ({value}점)
                  </option>
                ))}
              </select>
            </div>
            <textarea
              ref={reviewBodyRef}
              id="review-body"
              value={body}
              maxLength={1200}
              rows={4}
              aria-invalid={bodyError ? true : undefined}
              aria-describedby={bodyError ? 'review-body-error' : undefined}
              onChange={(event) => {
                setBody(event.target.value);
                if (event.target.value.trim().length >= 2) setBodyError('');
              }}
              placeholder="공연과 행사에 대한 후기를 적어 주세요."
            />
            {bodyError && (
              <p
                className="form-field-error"
                id="review-body-error"
                role="alert"
              >
                {bodyError}
              </p>
            )}
            <div className="form-footer">
              <label className="file-picker" htmlFor="review-images">
                사진 추가 (최대 {MAX_REVIEW_IMAGES}장)
              </label>
              <input
                id="review-images"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  addSelectedPhotos(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
              <button className="primary-button" disabled={busy}>
                {busy ? '등록 중…' : editingId ? '후기 수정' : '후기 등록'}
              </button>
              <span>
                {files.length}/{MAX_REVIEW_IMAGES}장 선택 · {body.length}/1200자
                · 계정당 사진 10장, 총 10MB까지
              </span>
            </div>
            {photoPreviews.length > 0 && (
              <div
                className="guestbook-photo-previews"
                aria-label="업로드할 사진 미리보기"
              >
                {photoPreviews.map(({ file, url }, index) => (
                  <figure key={`${file.name}-${file.lastModified}-${index}`}>
                    <img src={url} alt={`${file.name} 미리보기`} />
                    <figcaption>{file.name}</figcaption>
                    <button
                      type="button"
                      aria-label={`${file.name} 사진 제거`}
                      onClick={() =>
                        replaceSelectedPhotos(
                          files.filter((_, fileIndex) => fileIndex !== index),
                        )
                      }
                    >
                      ×
                    </button>
                  </figure>
                ))}
              </div>
            )}
            <label className="consent-field">
              <input
                ref={consentCheckboxRef}
                type="checkbox"
                checked={termsAccepted}
                aria-invalid={consentError ? true : undefined}
                aria-describedby={
                  consentError ? 'review-consent-error' : undefined
                }
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  if (event.target.checked) setConsentError('');
                }}
              />
              <span>
                <Link to="/policy/privacy" target="_blank" rel="noreferrer">
                  개인정보·공개 안내
                </Link>
                를 확인했고, 후기와 선택한 사진이 공개되는 데 동의합니다.
              </span>
            </label>
            {consentError && (
              <p
                className="consent-error"
                id="review-consent-error"
                role="alert"
              >
                {consentError}
              </p>
            )}
            <div
              className="guestbook-turnstile"
              role="group"
              aria-label="Cloudflare 보안 확인"
            >
              <TurnstileWidget
                onToken={setTurnstileToken}
                resetKey={turnstileResetKey}
                appearance="interaction-only"
              />
            </div>
            {editingId && (
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditingId(undefined);
                  setBody('');
                  setBodyError('');
                  setRating(5);
                  replaceSelectedPhotos([]);
                  setTermsAccepted(false);
                  setConsentError('');
                  setSubmissionError(null);
                }}
              >
                수정 취소
              </button>
            )}
          </form>
        )}
        {submissionError && (
          <div className="community-error-details" role="alert">
            <strong>후기 요청 오류 · {submissionError.code}</strong>
            <span>{submissionError.message}</span>
          </div>
        )}
        {!user && (
          <p className="empty-state">후기를 작성하려면 로그인이 필요합니다.</p>
        )}
        {user && visibleReviews.length === 0 && (
          <p className="empty-state">아직 등록된 후기가 없습니다.</p>
        )}
        {visibleReviews.map((review) => (
          <article className="user-post-card" key={review.id}>
            <header>
              <strong>{review.author_name}</strong>
              <span className="review-rating" aria-label={`${review.rating}점`}>
                {'★'.repeat(review.rating)}
                {'☆'.repeat(5 - review.rating)}
              </span>
              <time dateTime={review.created_at}>
                {new Date(review.created_at).toLocaleDateString('ko-KR')}
              </time>
            </header>
            <p className="user-post-body">{review.body}</p>
            {!!review.media?.length && (
              <div className="user-photo-grid">
                {review.media.map(
                  (media) =>
                    media.signed_url && (
                      <figure className="user-photo-item" key={media.id}>
                        <img
                          src={media.signed_url}
                          loading="lazy"
                          alt="후기 첨부 사진"
                        />
                        {user && (review.is_mine || isAdmin) && (
                          <button
                            className="admin-photo-delete"
                            type="button"
                            aria-label="후기 사진 삭제"
                            onClick={() => void removePhoto(media)}
                          >
                            사진 삭제
                          </button>
                        )}
                      </figure>
                    ),
                )}
              </div>
            )}
            {!!review.media?.length &&
              !review.media.some((media) => media.signed_url) && (
                <p className="community-small">
                  사진을 지금은 불러올 수 없습니다.
                </p>
              )}
            {user && (review.is_mine || isAdmin) && (
              <div className="post-actions">
                {review.is_mine && (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setEditingId(review.id);
                      setBody(review.body);
                      setBodyError('');
                      setRating(review.rating);
                      setTermsAccepted(true);
                      setConsentError('');
                      setSubmissionError(null);
                    }}
                  >
                    수정하기
                  </button>
                )}
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => void handleDelete(review.id)}
                >
                  {isAdmin && !review.is_mine ? '숨김 처리' : '삭제'}
                </button>
              </div>
            )}
            {canReportContent && !review.is_mine && (
              <button
                className="text-button"
                type="button"
                disabled={
                  reportingId === review.id || reportedReviewIds.has(review.id)
                }
                onClick={() => openReportDialog(review)}
              >
                {reportedReviewIds.has(review.id) ? '신고 접수됨' : '신고'}
              </button>
            )}
          </article>
        ))}
        {hasMoreReviews && (
          <button
            className="secondary-button load-more"
            type="button"
            onClick={() => void loadMoreReviews()}
          >
            후기 더 보기
          </button>
        )}
      </section>
      {message && (
        <div className="community-toast" role="status" aria-live="polite">
          {message}
        </div>
      )}
      <CommunityReportDialog
        target={reportTarget}
        contentLabel="일정 후기"
        feedLabel="내 후기 목록"
        error={reportError}
        submitting={reportingId !== undefined}
        step={reportDialogStep}
        autoDismissSuccess
        details={reportDetails}
        onDetailsChange={setReportDetails}
        onSubmit={(event) => void submitReport(event)}
        onClose={closeReportDialog}
      />
      {moderationTarget && (
        <ModerationReasonDialog
          subjectLabel="일정 후기"
          submitting={moderationSubmitting}
          error={moderationError}
          successMessage={moderationSuccess}
          onSubmit={(reason) => void submitHideReason(reason)}
          onClose={closeModerationDialog}
        />
      )}
    </section>
  );
}

export default SchedulePage;
