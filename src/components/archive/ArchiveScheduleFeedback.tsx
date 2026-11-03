/**
 * 이 컴포넌트는 일정 상세 안에서 좋아요 수와 사용자의 반응 상태를 표시합니다.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/authContext';
import {
  getScheduleReactions,
  getScheduleReviews,
  toggleScheduleLike,
} from '../../features/community/api';
import type { ScheduleReview } from '../../features/community/types';

type ScheduleFeedback = {
  likeCount: number;
  liked: boolean;
  ownReviewId?: string;
};

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date(value));
}

/** 전체 기록 안에서 일정 반응 수를 간단히 표시하고 상세 후기 화면으로 잇습니다. */
function ArchiveScheduleFeedback({ scheduleId }: { scheduleId: string }) {
  const { user, loading: authLoading } = useAuth();
  const [feedback, setFeedback] = useState<ScheduleFeedback>({
    likeCount: 0,
    liked: false,
  });
  const [reviews, setReviews] = useState<ScheduleReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeBusy, setLikeBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    void Promise.all([
      getScheduleReactions(scheduleId, user?.id),
      getScheduleReviews(scheduleId, 0, 2),
    ])
      .then(([nextFeedback, nextReviews]) => {
        if (!active) return;
        setError('');
        setFeedback(nextFeedback);
        setReviews(nextReviews);
      })
      .catch(() => {
        if (active) {
          setError(
            '좋아요와 후기를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [scheduleId, user?.id]);

  async function handleLike() {
    if (!user || likeBusy) return;
    setLikeBusy(true);
    setError('');
    try {
      const result = await toggleScheduleLike(scheduleId);
      setFeedback((current) => ({
        ...current,
        liked: result.liked,
        likeCount: Math.max(0, current.likeCount + (result.liked ? 1 : -1)),
      }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : '좋아요를 반영하지 못했습니다.',
      );
    } finally {
      setLikeBusy(false);
    }
  }

  return (
    <section
      className="archive-schedule-feedback"
      aria-label="행사 좋아요와 후기"
    >
      <header className="archive-schedule-feedback-heading">
        <div>
          <span className="archive-schedule-feedback-eyebrow">
            SHARE THE MOMENT
          </span>
          <h3>이 날의 기억을 나눠요</h3>
        </div>
        <Link
          to={`/schedule/${scheduleId}`}
          className="archive-schedule-review-link"
        >
          {feedback.ownReviewId ? '내 후기 보기' : '후기 남기기'}{' '}
          <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <div className="archive-schedule-reaction-row">
        <button
          className={`archive-schedule-like${feedback.liked ? ' is-liked' : ''}`}
          type="button"
          disabled={loading || likeBusy || !user}
          onClick={() => void handleLike()}
          aria-pressed={feedback.liked}
          aria-label={`좋아요 ${feedback.likeCount}개${feedback.liked ? ', 참여함' : ''}`}
        >
          <span aria-hidden="true">{feedback.liked ? '♥' : '♡'}</span>
          <strong>
            {loading ? '불러오는 중' : `좋아요 ${feedback.likeCount}`}
          </strong>
        </button>
        {!authLoading && !user && (
          <Link
            className="archive-schedule-login-link"
            to={`/account?returnTo=/schedule/${scheduleId}`}
          >
            로그인하고 참여하기
          </Link>
        )}
        {authLoading && (
          <span className="archive-schedule-login-hint">
            로그인 상태 확인 중…
          </span>
        )}
      </div>

      <div className="archive-schedule-review-preview" aria-live="polite">
        <div className="archive-schedule-review-label">
          <span>최근 후기</span>
          <span>
            {loading ? '…' : reviews.length ? '미리보기' : '첫 기록을 기다려요'}
          </span>
        </div>
        {error ? (
          <p className="archive-schedule-feedback-error" role="status">
            {error}
          </p>
        ) : null}
        {!loading && !error && reviews.length === 0 && (
          <p className="archive-schedule-review-empty">
            아직 등록된 후기가 없어요. 이 날의 기억을 처음으로 남겨 주세요.
          </p>
        )}
        {reviews.map((review) => (
          <article className="archive-schedule-review-card" key={review.id}>
            <div className="archive-schedule-review-meta">
              <strong>{review.author_name}</strong>
              <span
                className="archive-schedule-review-stars"
                aria-label={`${review.rating}점`}
              >
                {'★'.repeat(review.rating)}
                {'☆'.repeat(5 - review.rating)}
              </span>
              <time dateTime={review.created_at}>
                {formatReviewDate(review.created_at)}
              </time>
            </div>
            <p>{review.body}</p>
          </article>
        ))}
        <Link
          to={`/schedule/${scheduleId}`}
          className="archive-schedule-all-reviews"
        >
          후기 전체 보기 및 작성 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

export default ArchiveScheduleFeedback;
