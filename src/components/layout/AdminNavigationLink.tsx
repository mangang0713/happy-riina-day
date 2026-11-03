/**
 * 이 컴포넌트는 현재 사용자가 관리자일 때 관리자 화면으로 가는 내비게이션을 제공합니다.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../features/auth/authContext';
import {
  claimHessxlAdmin,
  isCurrentArchiveAdmin,
} from '../../features/community/adminApi';

/** 권한이 있는 계정에만 관리자 기능 진입점을 표시합니다. */
function AdminNavigationLink({
  onClick,
  className,
}: {
  onClick?: () => void;
  className: string;
}) {
  const { user } = useAuth();
  const [adminCheck, setAdminCheck] = useState<{
    userId: string;
    isAdmin: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) return;

    void (async () => {
      try {
        await claimHessxlAdmin();
        const admin = await isCurrentArchiveAdmin();
        if (active) setAdminCheck({ userId: user.id, isAdmin: admin });
      } catch {
        if (active) setAdminCheck({ userId: user.id, isAdmin: false });
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  return user && adminCheck?.userId === user.id && adminCheck.isAdmin ? (
    <Link className={className} to="/admin/reports" onClick={onClick}>
      운영
    </Link>
  ) : null;
}

export default AdminNavigationLink;
