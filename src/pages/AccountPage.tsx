/**
 * 이 페이지는 로그인 계정의 프로필 표시 이름과 인증 상태를 관리합니다.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import type { SocialProvider } from '../features/auth/types';
import {
  deleteAccount,
  getProfile,
  updateProfile,
} from '../features/community/api';
import { isWorkerBackend } from '../features/community/backendMode';
import './CommunityPages.css';

/** 로그인 사용자에게 프로필 편집과 계정 작업을 제공하는 계정 화면입니다. */
function AccountPage() {
  const { user, loading, configured, providers, signIn, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    const suggestedName = user.suggestedName;
    getProfile(user.id)
      .then((profile) => {
        const currentName = profile?.display_name ?? suggestedName;
        setDisplayName(currentName);
        setSavedDisplayName(currentName);
      })
      .catch((error: unknown) => {
        setDisplayName(suggestedName);
        setSavedDisplayName(suggestedName);
        setMessage(
          error instanceof Error
            ? error.message
            : '프로필을 불러오지 못했습니다.',
        );
      });
  }, [user]);

  async function handleSignIn(provider: SocialProvider) {
    setBusy(true);
    setMessage('');
    const destination =
      new URLSearchParams(location.search).get('returnTo') ?? '/guestbook';
    const returnTo = `/account/setup?next=${encodeURIComponent(destination)}`;
    const error = await signIn(provider, returnTo);
    if (error) setMessage(error);
    setBusy(false);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setProfileSaved(false);
    try {
      await updateProfile(displayName);
      setSavedDisplayName(displayName.trim());
      setProfileSaved(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '저장하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    if (
      !window.confirm(
        '계정을 삭제할까요? 글은 익명으로 남고 좋아요와 첨부 사진은 삭제됩니다.',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await deleteAccount();
      if (!isWorkerBackend) await signOut();
      navigate('/');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '계정을 삭제하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="community-page account-page">
      <div className="community-heading">
        <span className="community-eyebrow">ACCOUNT</span>
        <h1>계정</h1>
        <p>기록을 남기거나 반응을 표시하려면 로그인해 주세요.</p>
      </div>
      {!configured && (
        <div className="community-alert" role="status">
          로그인 서버 설정을 기다리는 중입니다. 필요한 환경 변수를 등록해
          주세요.
        </div>
      )}
      {loading && (
        <p className="community-muted">로그인 상태를 확인하고 있습니다.</p>
      )}
      {!loading && configured && !user && (
        <div className="account-card">
          <h2>소셜 계정으로 계속하기</h2>
          <p>
            로그인 정보는 공개되지 않습니다. 공개 화면에는 직접 선택한 표시
            이름만 사용합니다.
          </p>
          {providers === null ? (
            <p className="community-muted">로그인 방법을 확인하고 있습니다.</p>
          ) : providers.length ? (
            <div className="provider-buttons">
              {providers.map((provider) => (
                <button
                  key={provider}
                  type="button"
                  className={`provider-button${provider === 'x' ? ' provider-x' : ''}`}
                  disabled={busy}
                  onClick={() => void handleSignIn(provider)}
                >
                  {provider === 'x'
                    ? 'X로 계속하기'
                    : provider === 'google'
                      ? 'Google로 계속하기'
                      : 'Kakao로 계속하기'}
                </button>
              ))}
            </div>
          ) : (
            <p className="community-muted">
              현재 사용할 수 있는 소셜 로그인 방법이 설정되지 않았습니다.
            </p>
          )}
          <p className="community-small">
            X 로그인은 계정 확인용이며 X 게시물에 접근하거나 자동 수집하지
            않습니다.
          </p>
        </div>
      )}
      {!loading && user && (
        <div className="account-card">
          <h2>프로필</h2>
          <p className="account-current-name">
            현재 공개 표시 이름:{' '}
            <strong>{savedDisplayName || '아직 설정되지 않음'}</strong>
          </p>
          <form
            className="community-form"
            onSubmit={(event) => void handleSaveProfile(event)}
          >
            <label htmlFor="display-name">공개 표시 이름</label>
            <input
              id="display-name"
              value={displayName}
              maxLength={40}
              required
              onChange={(event) => {
                setDisplayName(event.target.value);
                setProfileSaved(false);
              }}
            />
            <button className="primary-button" disabled={busy}>
              저장
            </button>
            {profileSaved && (
              <p className="account-save-feedback" role="status">
                공개 표시 이름을 저장했어요.
              </p>
            )}
          </form>
          <p className="community-small">
            로그인 이메일은 공개 화면에 표시되지 않습니다.
          </p>
          <div className="account-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void signOut().then((error) =>
                  error ? setMessage(error) : navigate('/'),
                )
              }
            >
              로그아웃
            </button>
            <div className="account-danger-zone">
              <span>계정과 연결된 반응·사진이 삭제됩니다.</span>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => void handleDeleteAccount()}
              >
                계정 삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {message && (
        <p className="community-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export default AccountPage;
