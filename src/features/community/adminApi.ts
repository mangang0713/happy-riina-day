/**
 * 이 모듈은 현재 계정의 관리자 여부를 확인하고 관리자 전용 초기 설정 요청을 보냅니다.
 */

import { supabase } from '../../lib/supabase/client';
import { isWorkerBackend } from './backendMode';
import { getWorkerAdminStatus } from './workerApi';

/** Supabase 미설정 상태에서 관리자 기능이 조용히 실패하지 않도록 확인합니다. */
function requireClient() {
  if (!supabase) throw new Error('Supabase 연결 설정이 필요합니다.');
  return supabase;
}

/** Supabase에서는 최초 관리자 연결을 요청하고, Worker에서는 수동 등록을 존중해 건너뜁니다. */
export async function claimHessxlAdmin() {
  if (isWorkerBackend) {
    return false;
  }
  const { data, error } = await requireClient().rpc('claim_hessxl_admin');
  if (error) throw new Error(error.message);
  return data === true;
}

/** 커뮤니티 화면이 관리자 전용 메뉴를 표시할지 판단하는 권한 확인입니다. */
export async function isCurrentArchiveAdmin() {
  if (isWorkerBackend) {
    const { isAdmin } = await getWorkerAdminStatus();
    return isAdmin;
  }
  const { data, error } = await requireClient().rpc('is_current_archive_admin');
  if (error) throw new Error(error.message);
  return data === true;
}
