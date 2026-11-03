/**
 * 이 페이지는 관리자가 신고와 숨긴 콘텐츠를 검토하고 복원·삭제·이의제기를 처리합니다.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import {
  getAdminHiddenContent,
  getAdminReports,
  moderateReport,
  resolveCommunityAppeal,
  restoreHiddenCommunityContent,
} from '../features/community/api';
import type {
  ContentReport,
  HiddenCommunityContent,
} from '../features/community/types';
import AppealDecisionDialog, {
  type AppealDecision,
} from '../components/community/AppealDecisionDialog';
import ModerationReasonDialog from '../components/community/ModerationReasonDialog';
import './CommunityPages.css';

type AdminTab = 'reports' | 'hidden';

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

/** 관리자 권한이 확인된 사용자만 신고와 숨김 상태를 조정합니다. */
function AdminReportsPage() {
  const { user, configured } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('reports');
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [hiddenContent, setHiddenContent] = useState<HiddenCommunityContent[]>(
    [],
  );
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string>();
  const [hideReportTarget, setHideReportTarget] =
    useState<ContentReport | null>(null);
  const [hideReportError, setHideReportError] = useState('');
  const [hideReportSuccess, setHideReportSuccess] = useState('');
  const [appealDecisionTarget, setAppealDecisionTarget] = useState<{
    item: HiddenCommunityContent;
    decision: AppealDecision;
  } | null>(null);
  const [appealDecisionError, setAppealDecisionError] = useState('');
  const [appealDecisionSuccess, setAppealDecisionSuccess] = useState('');

  const refreshReports = useCallback(async () => {
    if (!configured || !user) return;
    try {
      setReports(await getAdminReports());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '신고 목록을 불러오지 못했습니다.',
      );
    }
  }, [configured, user]);

  const refreshHiddenContent = useCallback(async () => {
    if (!configured || !user) return;
    try {
      setHiddenContent(await getAdminHiddenContent());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '숨김 게시물을 불러오지 못했습니다.',
      );
    }
  }, [configured, user]);

  // Fetching begins after mount; state changes happen when the request settles.

  useEffect(() => {
    // 화면 진입 시 서버의 최신 신고·숨김 목록을 불러옵니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshReports();
  }, [refreshReports]);

  async function decide(report: ContentReport, decision: 'dismiss' | 'hide') {
    if (decision === 'hide') {
      setHideReportTarget(report);
      setHideReportError('');
      setHideReportSuccess('');
      return;
    }
    setBusyId(report.id);
    setMessage('');
    try {
      await moderateReport(report.id, decision);
      await refreshReports();
      setMessage('신고를 기각했습니다.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '신고를 처리하지 못했습니다.',
      );
    } finally {
      setBusyId(undefined);
    }
  }

  async function submitReportHide(reason: string) {
    if (!hideReportTarget) return;
    setBusyId(hideReportTarget.id);
    setHideReportError('');
    try {
      await moderateReport(hideReportTarget.id, 'hide', reason);
      await refreshReports();
      await refreshHiddenContent();
      setHideReportSuccess(
        '작성자는 내 게시글에서 7일 안에 이의제기할 수 있습니다.',
      );
    } catch (error) {
      setHideReportError(
        error instanceof Error ? error.message : '게시물을 숨기지 못했습니다.',
      );
    } finally {
      setBusyId(undefined);
    }
  }

  function closeHideReportDialog() {
    if (hideReportTarget && busyId === hideReportTarget.id) return;
    setHideReportTarget(null);
    setHideReportError('');
    setHideReportSuccess('');
  }

  async function restoreContent(item: HiddenCommunityContent) {
    if (
      !window.confirm(
        '이 게시물을 다시 공개할까요? 진행 중인 이의제기도 승인 처리됩니다.',
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setMessage('');
    try {
      await restoreHiddenCommunityContent(item.content_type, item.id);
      await refreshHiddenContent();
      setMessage('게시물을 다시 공개했습니다.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '게시물을 복원하지 못했습니다.',
      );
    } finally {
      setBusyId(undefined);
    }
  }

  async function resolveAppeal(
    item: HiddenCommunityContent,
    decision: 'approve' | 'reject',
  ) {
    const appeal = item.appeal;
    if (!appeal || appeal.status !== 'pending') return;
    setAppealDecisionTarget({ item, decision });
    setAppealDecisionError('');
    setAppealDecisionSuccess('');
  }

  async function submitAppealDecision(reason: string) {
    if (!appealDecisionTarget || !appealDecisionTarget.item.appeal) return;
    const { item, decision } = appealDecisionTarget;
    const appeal = item.appeal;
    if (!appeal) return;
    setBusyId(appeal.id);
    setAppealDecisionError('');
    try {
      await resolveCommunityAppeal(appeal.id, decision, reason);
      setHiddenContent((current) =>
        current.filter(
          (entry) =>
            entry.id !== item.id || entry.content_type !== item.content_type,
        ),
      );
      void refreshHiddenContent();
      setAppealDecisionSuccess(
        decision === 'approve'
          ? '숨김 게시물을 다시 공개했습니다.'
          : '게시글과 사진을 삭제했습니다. 작성자는 내 게시글에서 7일간 기각 사유를 확인할 수 있습니다.',
      );
    } catch (error) {
      setAppealDecisionError(
        error instanceof Error
          ? error.message
          : '이의제기를 처리하지 못했습니다.',
      );
    } finally {
      setBusyId(undefined);
    }
  }

  function closeAppealDecisionDialog() {
    const appealId = appealDecisionTarget?.item.appeal?.id;
    if (appealId && busyId === appealId) return;
    setAppealDecisionTarget(null);
    setAppealDecisionError('');
    setAppealDecisionSuccess('');
  }

  return (
    <section className="community-page">
      <div className="community-heading">
        <span className="community-eyebrow">MODERATION</span>
        <h1>커뮤니티 관리</h1>
        <p>
          신고를 검토하고, 숨김 사유와 이의제기 상태를 관리합니다. 7일이 지나면
          글·사진·신고 인용문이 자동 삭제되어 관리자도 다시 볼 수 없습니다.
        </p>
      </div>
      {!configured && (
        <div className="community-alert">Supabase 설정이 필요합니다.</div>
      )}
      {configured && !user && (
        <div className="community-alert">
          관리자 로그인이 필요합니다.{' '}
          <Link to="/account?returnTo=/admin/reports">로그인</Link>
        </div>
      )}
      {configured && user && (
        <>
          <div
            className="admin-review-tabs"
            role="group"
            aria-label="커뮤니티 관리 항목"
          >
            <button
              type="button"
              aria-pressed={activeTab === 'reports'}
              className={`admin-review-tab${activeTab === 'reports' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              미처리 신고 <span>{reports.length}</span>
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'hidden'}
              className={`admin-review-tab${activeTab === 'hidden' ? ' is-active' : ''}`}
              onClick={() => {
                setActiveTab('hidden');
                void refreshHiddenContent();
              }}
            >
              숨김 게시물 <span>{hiddenContent.length}</span>
            </button>
          </div>

          {activeTab === 'reports' && (
            <div aria-label="미처리 신고">
              {reports.map((report) => (
                <article className="user-post-card report-card" key={report.id}>
                  <header>
                    <strong>
                      {report.content_type === 'guestbook'
                        ? '방명록'
                        : '일정 후기'}{' '}
                      신고
                    </strong>
                    <time dateTime={report.created_at}>
                      {formatDate(report.created_at)}
                    </time>
                  </header>
                  <p>
                    <b>작성자:</b> {report.target_author}
                  </p>
                  <p>
                    <b>신고 사유:</b> {report.reason}
                  </p>
                  {report.details && <p>{report.details}</p>}
                  <blockquote>{report.target_excerpt}</blockquote>
                  <div className="post-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busyId === report.id}
                      onClick={() => void decide(report, 'dismiss')}
                    >
                      기각
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busyId === report.id}
                      onClick={() => void decide(report, 'hide')}
                    >
                      {busyId === report.id
                        ? '처리 중…'
                        : '사유를 남기고 7일 숨김'}
                    </button>
                  </div>
                </article>
              ))}
              {reports.length === 0 && (
                <p className="empty-state">현재 미처리 신고가 없습니다.</p>
              )}
            </div>
          )}

          {activeTab === 'hidden' && (
            <div aria-label="숨김 게시물">
              {hiddenContent.map((item) => (
                <article
                  className="user-post-card report-card"
                  key={`${item.content_type}-${item.id}`}
                >
                  <header>
                    <strong>
                      {item.content_type === 'guestbook'
                        ? '방명록'
                        : '일정 후기'}{' '}
                      · 숨김
                    </strong>
                    <time dateTime={item.hidden_at ?? item.created_at}>
                      숨김 {formatDate(item.hidden_at)}
                    </time>
                  </header>
                  <p>
                    <b>작성자:</b> {item.author_name}
                    {item.rating !== null && ` · 별점 ${item.rating}/5`}
                  </p>
                  <div className="moderation-notice">
                    <p>
                      <b>숨김 사유</b> ·{' '}
                      {item.moderation_reason ?? '사유가 기록되지 않았습니다.'}
                    </p>
                    <p>자동 삭제 예정 {formatDate(item.purge_after)}</p>
                  </div>
                  <blockquote>{item.body}</blockquote>
                  {!!item.media.length && (
                    <div className="admin-hidden-photo-grid">
                      {item.media.map(
                        (media) =>
                          media.signed_url && (
                            <figure key={media.id}>
                              <img
                                src={media.signed_url}
                                loading="lazy"
                                alt="숨김 게시물 첨부 사진"
                              />
                            </figure>
                          ),
                      )}
                    </div>
                  )}
                  {item.appeal && (
                    <div className="appeal-status">
                      <strong>
                        이의제기 ·{' '}
                        {item.appeal.status === 'pending'
                          ? '검토 대기'
                          : item.appeal.status === 'approved'
                            ? '승인'
                            : '기각'}
                      </strong>
                      <p>
                        <b>접수:</b> {formatDate(item.appeal.submitted_at)}
                      </p>
                      <p>{item.appeal.reason}</p>
                      {item.appeal.decision_reason && (
                        <p>
                          <b>운영자 답변:</b> {item.appeal.decision_reason}
                        </p>
                      )}
                      {item.appeal.status === 'pending' && (
                        <div className="post-actions">
                          <button
                            className="primary-button"
                            type="button"
                            disabled={busyId === item.appeal.id}
                            onClick={() => void resolveAppeal(item, 'approve')}
                          >
                            승인하고 복원
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            disabled={busyId === item.appeal.id}
                            onClick={() => void resolveAppeal(item, 'reject')}
                          >
                            이의제기 기각
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="post-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void restoreContent(item)}
                    >
                      {busyId === item.id ? '처리 중…' : '다시 공개'}
                    </button>
                  </div>
                </article>
              ))}
              {hiddenContent.length === 0 && (
                <p className="empty-state">
                  현재 숨김 처리된 게시물이 없습니다.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {message && (
        <p className="community-message" role="status">
          {message}
        </p>
      )}
      {hideReportTarget && (
        <ModerationReasonDialog
          subjectLabel={
            hideReportTarget.content_type === 'guestbook'
              ? '방명록'
              : '일정 후기'
          }
          submitting={busyId === hideReportTarget.id}
          error={hideReportError}
          successMessage={hideReportSuccess}
          onSubmit={(reason) => void submitReportHide(reason)}
          onClose={closeHideReportDialog}
        />
      )}
      {appealDecisionTarget && (
        <AppealDecisionDialog
          decision={appealDecisionTarget.decision}
          submitting={busyId === appealDecisionTarget.item.appeal?.id}
          error={appealDecisionError}
          successMessage={appealDecisionSuccess}
          onSubmit={(reason) => void submitAppealDecision(reason)}
          onClose={closeAppealDecisionDialog}
        />
      )}
    </section>
  );
}

export default AdminReportsPage;
