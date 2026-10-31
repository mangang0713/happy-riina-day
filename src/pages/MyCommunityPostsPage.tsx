/**
 * 이 페이지는 작성자가 올린 글과 숨김·이의제기 상태 및 결과를 확인하도록 합니다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import {
  getMyCommunityContent,
  submitCommunityAppeal,
} from '../features/community/api';
import type {
  CommunityAppealResult,
  MyCommunityContent,
} from '../features/community/types';
import './CommunityPages.css';

function formatDate(value: string | null) {
  if (!value) return '확인 중';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
    hourCycle: 'h23',
  }).format(new Date(value));
}

/** 작성자 본인이 숨김 사유·이의제기 신청·판정 결과를 추적합니다. */
function MyCommunityPostsPage() {
  const { user, loading, configured } = useAuth();
  const [posts, setPosts] = useState<MyCommunityContent[]>([]);
  const [appealResults, setAppealResults] = useState<CommunityAppealResult[]>(
    [],
  );
  const [loadedForUserId, setLoadedForUserId] = useState<string>();
  const [failedForUserId, setFailedForUserId] = useState<string>();
  const [appealTarget, setAppealTarget] = useState<string>();
  const [appealReason, setAppealReason] = useState('');
  const [busyId, setBusyId] = useState<string>();
  const [message, setMessage] = useState('');
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'all' | 'hidden' | 'pending' | 'results'
  >('all');
  const appealConfirmationRef = useRef<HTMLDialogElement>(null);

  const refresh = useCallback(async () => {
    if (!configured || !user) return;
    setFailedForUserId(undefined);
    try {
      const content = await getMyCommunityContent();
      setPosts(content.posts);
      setAppealResults(content.appealResults);
      setLoadedForUserId(user.id);
    } catch (error) {
      setFailedForUserId(user.id);
      setMessage(
        error instanceof Error
          ? error.message
          : '내 게시글을 불러오지 못했습니다.',
      );
    }
  }, [configured, user]);

  // 계정이 바뀌면 새 계정의 응답이 오기 전까지 이전 계정의 목록을 숨깁니다.
  const hasLoadedForCurrentUser = Boolean(user && loadedForUserId === user.id);
  const isLoadingCurrentUser = Boolean(
    configured &&
      user &&
      !hasLoadedForCurrentUser &&
      failedForUserId !== user.id,
  );

  // Fetching begins after mount; state changes happen when the request settles.

  useEffect(() => {
    // 작성자 화면 진입 시 보존·이의제기 상태의 최신 자료를 불러옵니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const dialog = appealConfirmationRef.current;
    if (!dialog) return;
    if (appealSubmitted && !dialog.open) dialog.showModal();
    if (!appealSubmitted && dialog.open) dialog.close();
  }, [appealSubmitted]);

  async function sendAppeal(post: MyCommunityContent) {
    if (appealReason.trim().length < 2) {
      setMessage('이의제기 내용을 두 글자 이상 적어 주세요.');
      return;
    }
    setBusyId(post.id);
    setMessage('');
    try {
      await submitCommunityAppeal(
        post.content_type,
        post.id,
        appealReason.trim(),
      );
      setAppealTarget(undefined);
      setAppealReason('');
      setAppealSubmitted(true);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '이의제기를 접수하지 못했습니다.',
      );
    } finally {
      setBusyId(undefined);
    }
  }

  const [now] = useState(() => Date.now());
  const tabs = [
    { id: 'all', label: '전체 게시글', count: posts.length },
    {
      id: 'hidden',
      label: '숨겨진 게시글',
      count: posts.filter(
        (post) => post.status === 'hidden' || post.status === 'purging',
      ).length,
    },
    {
      id: 'pending',
      label: '이의제기 중인 게시글',
      count: posts.filter((post) => post.appeal?.status === 'pending').length,
    },
    {
      id: 'results',
      label: '이의제기 결과',
      count:
        posts.filter(
          (post) =>
            post.appeal?.status === 'approved' ||
            post.appeal?.status === 'rejected',
        ).length + appealResults.length,
    },
  ] as const;
  const visiblePosts = posts.filter((post) => {
    if (activeTab === 'hidden') {
      return post.status === 'hidden' || post.status === 'purging';
    }
    if (activeTab === 'pending') return post.appeal?.status === 'pending';
    if (activeTab === 'results') {
      return (
        post.appeal?.status === 'approved' || post.appeal?.status === 'rejected'
      );
    }
    return true;
  });
  const emptyMessages = {
    all: '아직 작성한 게시글이 없습니다.',
    hidden: '숨겨진 게시글이 없습니다.',
    pending: '검토 중인 이의제기가 없습니다.',
    results: '확정된 이의제기 결과가 없습니다.',
  };
  return (
    <section className="community-page">
      <div className="community-heading">
        <span className="community-eyebrow">MY POSTS</span>
        <h1>내 게시글</h1>
        <p>공개 중인 글, 숨겨진 글, 이의제기 결과를 확인할 수 있습니다.</p>
      </div>
      {!configured && (
        <div className="community-alert">Supabase 설정이 필요합니다.</div>
      )}
      {loading && (
        <p className="community-muted">로그인 상태를 확인하고 있습니다.</p>
      )}
      {!loading && configured && !user && (
        <div className="community-alert">
          내 게시글을 보려면{' '}
          <Link to="/account?returnTo=/account/posts">로그인</Link>해 주세요.
        </div>
      )}
      {configured && user && (
        <>
          {isLoadingCurrentUser && (
            <p className="community-muted" role="status">
              내 게시글을 불러오고 있습니다.
            </p>
          )}
          <div
            className="my-post-tabs"
            role="group"
            aria-label="내 게시글 분류"
            hidden={!hasLoadedForCurrentUser}
            style={{
              display: hasLoadedForCurrentUser ? undefined : 'none',
            }}
          >
            {tabs.map((tab) => (
              <button
                className={`my-post-tab${activeTab === tab.id ? ' is-active' : ''}`}
                type="button"
                key={tab.id}
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                <span>{tab.count}</span>
              </button>
            ))}
          </div>
          <div
            className="guestbook-list"
            hidden={!hasLoadedForCurrentUser}
            style={{
              display: hasLoadedForCurrentUser ? undefined : 'none',
            }}
          >
            {visiblePosts.map((post) => {
              const appealOpen = Boolean(
                post.purge_after && now < new Date(post.purge_after).getTime(),
              );
              return (
                <article
                  className="user-post-card moderation-post-card"
                  key={`${post.content_type}-${post.id}`}
                >
                  <header>
                    <strong>
                      {post.content_type === 'guestbook'
                        ? '방명록'
                        : '일정 후기'}{' '}
                      ·{' '}
                      {post.status === 'hidden'
                        ? '숨김'
                        : post.status === 'purging'
                          ? '삭제 처리 중'
                          : '공개'}
                    </strong>
                    <time dateTime={post.created_at}>
                      {formatDate(post.created_at)}
                    </time>
                  </header>
                  {post.status !== 'published' && (
                    <div className="moderation-notice">
                      <p>
                        <b>숨김 사유</b> ·{' '}
                        {post.moderation_reason ?? '운영자가 검토 중입니다.'}
                      </p>
                      <p>
                        숨김 시각 {formatDate(post.hidden_at)} · 삭제 예정{' '}
                        {formatDate(post.purge_after)}
                      </p>
                    </div>
                  )}
                  {post.rating !== null && (
                    <p
                      className="review-rating"
                      aria-label={`${post.rating}/5점`}
                    >
                      {'★'.repeat(post.rating)}
                      {'☆'.repeat(5 - post.rating)}
                    </p>
                  )}
                  <p className="user-post-body">{post.body}</p>
                  {!!post.media.length && (
                    <div className="user-photo-grid">
                      {post.media.map(
                        (media) =>
                          media.signed_url && (
                            <figure className="user-photo-item" key={media.id}>
                              <img
                                src={media.signed_url}
                                loading="lazy"
                                alt="내 게시글 첨부 사진"
                              />
                            </figure>
                          ),
                      )}
                    </div>
                  )}
                  {post.status === 'purging' ? (
                    <p className="community-small">
                      보관 기간이 지나 사진과 게시물을 영구 삭제하고 있습니다.
                    </p>
                  ) : post.appeal ? (
                    <div className="appeal-status">
                      <strong>
                        {post.appeal.status === 'pending'
                          ? '이의제기 검토 중'
                          : post.appeal.status === 'approved'
                            ? '이의제기 승인 · 게시물 복원'
                            : '이의제기 기각'}
                      </strong>
                      <p>
                        <b>제출한 내용</b> · {post.appeal.reason}
                      </p>
                      {post.appeal.decision_reason && (
                        <p>
                          <b>운영자 답변</b> · {post.appeal.decision_reason}
                        </p>
                      )}
                      {post.appeal.status === 'pending' && (
                        <p>
                          검토가 끝날 때까지 게시물과 사진은 삭제되지 않습니다.
                        </p>
                      )}
                    </div>
                  ) : post.status === 'hidden' && appealOpen ? (
                    appealTarget === post.id ? (
                      <form
                        className="community-form appeal-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void sendAppeal(post);
                        }}
                      >
                        <label htmlFor={`appeal-${post.id}`}>
                          이의제기 내용
                        </label>
                        <textarea
                          id={`appeal-${post.id}`}
                          value={appealReason}
                          maxLength={1000}
                          rows={4}
                          required
                          placeholder="숨김 조치를 다시 검토해 달라는 이유를 적어 주세요."
                          onChange={(event) =>
                            setAppealReason(event.target.value)
                          }
                        />
                        <span className="community-small">
                          7일 안에 제출할 수 있습니다. 제출하면 검토가 끝날
                          때까지 게시물을 보존합니다.
                        </span>
                        <div className="post-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => {
                              setAppealTarget(undefined);
                              setAppealReason('');
                            }}
                          >
                            취소
                          </button>
                          <button
                            className="primary-button"
                            type="submit"
                            disabled={busyId === post.id}
                          >
                            {busyId === post.id ? '접수 중…' : '이의제기 제출'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        className="secondary-button appeal-open-button"
                        type="button"
                        onClick={() => {
                          setAppealTarget(post.id);
                          setAppealReason('');
                          setMessage('');
                        }}
                      >
                        이의제기
                      </button>
                    )
                  ) : (
                    post.status === 'hidden' && (
                      <p className="community-small">
                        이의제기 기간이 끝났습니다. 영구 삭제 처리를 기다리는
                        중입니다.
                      </p>
                    )
                  )}
                </article>
              );
            })}
            {activeTab === 'results' &&
              appealResults.map((result) => (
                <article
                  className="user-post-card moderation-post-card"
                  key={`appeal-result-${result.id}`}
                >
                  <header>
                    <strong>
                      {result.content_type === 'guestbook'
                        ? '방명록'
                        : '일정 후기'}{' '}
                      · 삭제됨
                    </strong>
                    <time dateTime={result.content_created_at}>
                      게시물 작성 {formatDate(result.content_created_at)}
                    </time>
                  </header>
                  <div className="appeal-status">
                    <strong>이의제기 기각</strong>
                    <p>
                      <b>운영자 답변</b> · {result.decision_reason}
                    </p>
                    <p>
                      게시글과 사진은 삭제되었으며, 이 결과 안내는{' '}
                      {formatDate(result.expires_at)}에 삭제됩니다.
                    </p>
                  </div>
                </article>
              ))}
            {hasLoadedForCurrentUser &&
              visiblePosts.length === 0 &&
              !(activeTab === 'results' && appealResults.length > 0) && (
                <p className="empty-state">{emptyMessages[activeTab]}</p>
              )}
          </div>
        </>
      )}
      {message && (
        <p className="community-message" role="status">
          {message}
        </p>
      )}
      <dialog
        className="report-confirmation"
        ref={appealConfirmationRef}
        aria-labelledby="appeal-confirmation-title"
        onClose={() => setAppealSubmitted(false)}
      >
        <div className="report-dialog-content report-confirmation-content">
          <span className="report-confirmation-icon" aria-hidden="true">
            ✓
          </span>
          <h2 id="appeal-confirmation-title">이의제기를 접수했어요</h2>
          <p>
            검토가 끝날 때까지 게시물과 사진은 보존됩니다. 진행 상태는 내
            게시글의 이의제기 탭에서 확인할 수 있어요.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setAppealSubmitted(false)}
          >
            확인
          </button>
        </div>
      </dialog>
    </section>
  );
}

export default MyCommunityPostsPage;
