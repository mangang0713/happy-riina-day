/**
 * 이 컴포넌트는 공통 헤더와 프로필 메뉴를 제공하고 모든 페이지의 전역 레이아웃을 감쌉니다.
 */

import {
  NavLink,
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { useEffect, useRef, useState } from 'react';
import { getProfile } from '../../features/community/api';
import AdminNavigationLink from './AdminNavigationLink';

const accountMenuItemClass =
  'flex min-h-11 w-full items-center justify-start rounded-[9px] border-0 bg-transparent px-3 text-left text-sm font-medium text-muted no-underline transition-colors hover:bg-section hover:text-brand-green focus-visible:outline-3 focus-visible:outline-brand-green focus-visible:outline-offset-1';

/** 모든 페이지에서 메뉴와 프로필 드롭다운·로그인 상태를 일관되게 표시합니다. */
function SiteLayout() {
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const profileImageUrl = [
    user?.user_metadata.avatar_url,
    user?.user_metadata.picture,
  ].find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError('');
    try {
      const error = await signOut();
      if (error) setSignOutError(error);
      else setProfileMenuOpen(false);
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : '로그아웃하지 못했습니다.',
      );
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    if (!profileMenuOpen) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false);
        profileMenuButtonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (loading || !user || location.pathname === '/account/setup') return;
    let active = true;
    void getProfile(user.id)
      .then((profile) => {
        const displayName = profile?.display_name.trim() ?? '';
        if (active && (!displayName || displayName === 'H1-KEY 팬')) {
          const next = `${location.pathname}${location.search}`;
          navigate(`/account/setup?next=${encodeURIComponent(next)}`, {
            replace: true,
          });
        }
      })
      .catch(() => {
        // 데이터베이스 준비 전에는 로그인한 사용자의 기존 화면을 막지 않습니다.
      });
    return () => {
      active = false;
    };
  }, [loading, user, location.pathname, location.search, navigate]);

  return (
    <div className="site-shell flex min-h-dvh flex-col bg-page text-text">
      <header className="relative z-[8] grid min-h-[58px] grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-surface/[0.96] pl-[max(20px,env(safe-area-inset-left,0px))] pr-[max(20px,env(safe-area-inset-right,0px))] shadow-[0_2px_12px_rgb(35_50_36_/_8%)] max-[600px]:min-h-[54px] max-[600px]:grid-cols-[minmax(0,1fr)_auto_auto] max-[600px]:gap-1 max-[600px]:pl-[max(10px,env(safe-area-inset-left,0px))] max-[600px]:pr-[max(10px,env(safe-area-inset-right,0px))]">
        <Link
          className="inline-flex w-fit items-center gap-[9px] text-[13px] font-extrabold tracking-[.06em] text-inherit no-underline max-[600px]:gap-1.5 max-[600px]:whitespace-nowrap max-[600px]:text-[11px] max-[600px]:tracking-[.02em]"
          to="/"
          aria-label="H1-KEY Activity Archive 홈"
        >
          <img
            className="block h-7 w-7 shrink-0 max-[600px]:h-6 max-[600px]:w-6"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            aria-hidden="true"
          />
          <span>
            H1-KEY <b className="text-brand-green">ARCHIVE</b>
          </span>
        </Link>
        <nav
          className="flex items-center gap-1 max-[600px]:gap-0"
          aria-label="주요 메뉴"
        >
          <NavLink
            className={({ isActive }) =>
              `inline-flex min-h-10 items-center rounded-[10px] px-[13px] text-sm font-medium text-muted no-underline transition-colors hover:bg-section hover:text-brand-green focus-visible:outline-3 focus-visible:outline-brand-green focus-visible:outline-offset-2 max-[600px]:px-[7px] max-[600px]:text-xs max-[600px]:whitespace-nowrap ${isActive ? 'bg-section text-brand-green' : ''}`
            }
            to="/archive"
          >
            지도
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `inline-flex min-h-10 items-center rounded-[10px] px-[13px] text-sm font-medium text-muted no-underline transition-colors hover:bg-section hover:text-brand-green focus-visible:outline-3 focus-visible:outline-brand-green focus-visible:outline-offset-2 max-[600px]:px-[7px] max-[600px]:text-xs max-[600px]:whitespace-nowrap ${isActive ? 'bg-section text-brand-green' : ''}`
            }
            to="/guestbook"
          >
            방명록
          </NavLink>
        </nav>
        <div
          className="relative flex flex-col items-end justify-self-end"
          ref={accountMenuRef}
        >
          {loading ? (
            <span className="px-2.5 text-xs text-muted">확인 중</span>
          ) : user ? (
            <>
              <button
                className="grid h-[42px] w-[42px] place-items-center rounded-full border border-border bg-section p-0 transition-colors hover:border-brand-green hover:bg-brand-lime focus-visible:outline-3 focus-visible:outline-brand-green focus-visible:outline-offset-3 max-[600px]:h-10 max-[600px]:w-10"
                type="button"
                ref={profileMenuButtonRef}
                aria-label={
                  profileMenuOpen ? '계정 메뉴 닫기' : '계정 메뉴 열기'
                }
                aria-expanded={profileMenuOpen}
                aria-controls="account-menu"
                onClick={() => setProfileMenuOpen((isOpen) => !isOpen)}
              >
                <span
                  className="relative grid h-full w-full place-items-center overflow-hidden rounded-full"
                  aria-hidden="true"
                >
                  <svg
                    className="h-[23px] w-[23px] fill-brand-green stroke-brand-green [stroke-width:1.5] [stroke-linecap:round]"
                    viewBox="0 0 24 24"
                    focusable="false"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
                  </svg>
                  {profileImageUrl && (
                    <img
                      className="absolute inset-0 block h-full w-full rounded-[inherit] object-cover"
                      src={profileImageUrl}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </span>
              </button>
              {profileMenuOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+9px)] z-20 grid w-[210px] rounded-[14px] border border-border bg-surface p-[7px] shadow-[0_14px_36px_rgb(35_50_36_/_18%)]"
                  id="account-menu"
                  aria-label="계정 메뉴"
                >
                  <Link
                    className={accountMenuItemClass}
                    to="/account"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    내 계정
                  </Link>
                  <Link
                    className={accountMenuItemClass}
                    to="/account/posts"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    내 게시글
                  </Link>
                  <AdminNavigationLink
                    className={accountMenuItemClass}
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <button
                    className={`${accountMenuItemClass} cursor-pointer disabled:cursor-wait disabled:opacity-60`}
                    type="button"
                    disabled={signingOut}
                    onClick={() => void handleSignOut()}
                  >
                    {signingOut ? '로그아웃 중…' : '로그아웃'}
                  </button>
                </div>
              )}
              {signOutError && (
                <span
                  className="max-w-[min(320px,80vw)] text-right text-[11px] text-[#a61b2b]"
                  role="alert"
                >
                  {signOutError}
                </span>
              )}
            </>
          ) : (
            <Link
              className="inline-flex min-h-10 items-center rounded-[10px] px-[13px] text-sm font-medium text-muted no-underline hover:bg-section hover:text-brand-green focus-visible:outline-3 focus-visible:outline-brand-green focus-visible:outline-offset-2"
              to="/account"
            >
              로그인
            </Link>
          )}
        </div>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="flex flex-wrap justify-center gap-x-3 gap-y-0 border-t border-border bg-surface px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom,0px))]">
        <Link
          className="inline-flex min-h-9 items-center text-[11px] text-muted no-underline"
          to="/policy/privacy"
        >
          개인정보 안내
        </Link>
        <Link
          className="inline-flex min-h-9 items-center text-[11px] text-muted no-underline"
          to="/policy/community"
        >
          커뮤니티 운영 원칙
        </Link>
        <span className="inline-flex min-h-9 items-center whitespace-nowrap text-[11px] text-muted">
          기록·제작
          <a
            className="ml-1 font-medium text-brand-green no-underline transition-colors hover:text-text hover:underline focus-visible:outline-2 focus-visible:outline-brand-green focus-visible:outline-offset-2"
            href="https://x.com/hessxl_"
            target="_blank"
            rel="noreferrer"
            aria-label="X에서 @hessxl_ 프로필 열기"
          >
            @hessxl_
          </a>
        </span>
      </footer>
    </div>
  );
}

export default SiteLayout;
