/**
 * 이 페이지는 공개 닉네임이 없는 신규 사용자가 커뮤니티 참여 전에 이름을 설정하게 합니다.
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../features/auth/authContext';
import { getProfile, updateProfile } from '../features/community/api';
import './CommunityPages.css';

function safeNextPath(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.startsWith('/account/setup')
  ) {
    return '/guestbook';
  }
  return value;
}

/** 공개 표시 이름이 없는 계정을 커뮤니티 작성이 가능한 상태로 설정합니다. */
function ProfileSetupPage() {
  const { user, loading, configured } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const nextPath = safeNextPath(searchParams.get('next'));
  const [displayName, setDisplayName] = useState('');
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    void getProfile(user.id)
      .then((profile) => {
        if (!active) return;
        const savedName = profile?.display_name.trim() ?? '';
        if (savedName && savedName !== 'H1-KEY 팬') {
          navigate(nextPath, { replace: true });
          return;
        }
        setDisplayName(
          user.suggestedName.slice(0, 40) ||
            (savedName === 'H1-KEY 팬' ? '' : savedName),
        );
        setChecking(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDisplayName(user.suggestedName.slice(0, 40));
        setMessage(
          error instanceof Error
            ? error.message
            : '프로필을 불러오지 못했습니다.',
        );
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user, navigate, nextPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = displayName.trim();
    if (name.length < 1 || name.length > 40) {
      setMessage('표시 이름은 1~40자로 입력해 주세요.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await updateProfile(name);
      navigate(nextPath, { replace: true });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '표시 이름을 저장하지 못했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  const loginReturnTo = `/account/setup?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  return (
    <section className="community-page profile-setup-page">
      <div className="community-heading">
        <span className="community-eyebrow">PROFILE</span>
        <h1>처음 사용할 이름을 정해 주세요</h1>
        <p>
          방명록과 후기에서 공개될 이름입니다. 로그인 계정 정보와 이메일은
          공개되지 않습니다.
        </p>
      </div>
      {!configured && (
        <div className="community-alert" role="status">
          프로필 저장을 위한 Supabase 설정이 필요합니다.
        </div>
      )}
      {loading || (user && checking) ? (
        <p className="community-muted" role="status">
          프로필을 확인하고 있습니다.
        </p>
      ) : !user ? (
        <div className="account-card">
          <p>로그인 후 공개 표시 이름을 설정할 수 있습니다.</p>
          <Link
            className="primary-button profile-login-link"
            to={`/account?returnTo=${encodeURIComponent(loginReturnTo)}`}
          >
            로그인으로 이동
          </Link>
        </div>
      ) : (
        <form
          className="account-card community-form profile-setup-card"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label htmlFor="setup-display-name">공개 표시 이름</label>
          <input
            id="setup-display-name"
            autoComplete="nickname"
            value={displayName}
            maxLength={40}
            required
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <p className="community-small">
            나중에 내 계정에서 언제든지 변경할 수 있습니다.
          </p>
          <button className="primary-button" disabled={busy || !configured}>
            {busy ? '저장 중…' : '이 이름으로 시작하기'}
          </button>
        </form>
      )}
      {message && (
        <p className="community-message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

export default ProfileSetupPage;
