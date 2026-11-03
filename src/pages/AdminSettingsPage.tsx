/**
 * 이 페이지는 커뮤니티 게시, 사진 업로드, 미디어 열람의 운영 중단 스위치를 관리합니다.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import {
  getAdminCommunitySettings,
  updateAdminCommunitySettings,
} from '../features/community/api';
import type { AdminCommunitySettings } from '../features/community/types';
import './CommunityPages.css';

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)}MB`;

/** 운영 중 문제 발생 시 커뮤니티 기능과 사진 전달을 관리자가 멈춥니다. */
function AdminSettingsPage() {
  const { user, configured } = useAuth();
  const [settings, setSettings] = useState<AdminCommunitySettings>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setSettings(await getAdminCommunitySettings());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '운영 설정을 불러오지 못했습니다.',
      );
    }
  }, []);

  // 관리자 권한을 확인하는 원격 요청 결과로 화면 상태를 갱신합니다.

  useEffect(() => {
    if (user && configured) {
      // 로그인·설정 조건이 갖춰지면 서버의 운영 스위치를 조회합니다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh();
    }
  }, [user, configured, refresh]);

  async function update(
    key: 'community_enabled' | 'uploads_enabled' | 'media_views_enabled',
    checked: boolean,
  ) {
    setBusy(true);
    setMessage('');
    try {
      await updateAdminCommunitySettings({ [key]: checked });
      await refresh();
      setMessage('운영 설정을 저장했습니다.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '운영 설정을 저장하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="community-page">
      <div className="community-heading">
        <span className="community-eyebrow">ADMINISTRATION</span>
        <h1>운영 설정</h1>
        <p>
          문제가 생기면 사용자 쓰기와 사진 제공을 빠르게 중단할 수 있습니다.
        </p>
      </div>
      {!configured && (
        <div className="community-alert">Supabase 설정이 필요합니다.</div>
      )}
      {configured && !user && (
        <div className="community-alert">
          관리자 로그인이 필요합니다.{' '}
          <Link to="/account?returnTo=/admin/settings">로그인</Link>
        </div>
      )}
      {settings && (
        <>
          <div className="account-card">
            <h2>기능 중단 스위치</h2>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={settings.community_enabled}
                disabled={busy}
                onChange={(event) =>
                  void update('community_enabled', event.target.checked)
                }
              />{' '}
              방명록·좋아요·후기·신고 쓰기 허용
            </label>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={settings.uploads_enabled}
                disabled={busy}
                onChange={(event) =>
                  void update('uploads_enabled', event.target.checked)
                }
              />{' '}
              사용자 사진 업로드 허용
            </label>
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={settings.media_views_enabled}
                disabled={busy}
                onChange={(event) =>
                  void update('media_views_enabled', event.target.checked)
                }
              />{' '}
              사용자 사진 보기 허용
            </label>
            <p className="community-small">
              사용자 기능을 중단해도 정적 지도, 일정, 세트리스트와 X 아카이브는
              계속 열립니다.
            </p>
          </div>
          <div className="account-card">
            <h2>데이터베이스 사용량</h2>
            <p>
              {mb(settings.database_used_bytes)} · 경고{' '}
              {mb(settings.database_warning_bytes)} / 쓰기 중단{' '}
              {mb(settings.database_stop_bytes)}
            </p>
            <progress
              className="storage-progress"
              value={Math.min(
                settings.database_used_bytes,
                settings.database_stop_bytes,
              )}
              max={settings.database_stop_bytes}
              aria-label="Supabase 데이터베이스 사용량"
            />
          </div>
          <div className="account-card">
            <h2>사진 저장소</h2>
            <p>
              {mb(settings.storage_used_bytes)} /{' '}
              {mb(settings.storage_limit_bytes)} 사용 · 경고 700MB · 업로드 중단
              800MB
            </p>
            <progress
              className="storage-progress"
              value={settings.storage_used_bytes}
              max={settings.storage_limit_bytes}
              aria-label="사용자 사진 저장 공간 사용량"
            />
            <p className="community-small">
              월 전송량은 Supabase 대시보드에서 확인합니다.{' '}
              {(settings.egress_warning_bytes / 1024 ** 3).toFixed(1)}GB에서
              경고하고 4GB에 가까워지면 운영 설정에서 사용자 기능과 사진 보기를
              중단해 주세요.
            </p>
          </div>
          <Link className="back-link" to="/admin/reports">
            ← 신고 검토
          </Link>
        </>
      )}
      {message && (
        <p className="community-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export default AdminSettingsPage;
