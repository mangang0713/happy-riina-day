import type { Pool } from 'pg';

/** Better Auth가 계정을 지우기 전에 콘텐츠를 익명화하고 계정 소유 사진·반응을 정리합니다. */
export async function anonymizeAccountCommunityData(
  database: Pool,
  mediaBucket: R2Bucket,
  userId: string,
) {
  const client = await database.connect();

  try {
    await client.query('begin');

    // 업로드와 같은 전역 설정 잠금 순서를 사용해 사용량 정산 경쟁을 막습니다.
    await client.query(
      'select id from community_settings where id = true for update',
    );
    const account = await client.query<{ id: string }>(
      'select id from "user" where id = $1 for update',
      [userId],
    );
    if (!account.rows[0]) {
      throw new Error('Account data is no longer available.');
    }

    // 진행 중인 업로드가 끝날 때까지 기다린 뒤 계정 소유 파일 목록을 확정합니다.
    await client.query(
      'select user_id from user_media_usage where user_id = $1 for update',
      [userId],
    );
    const media = await client.query<{
      object_path: string;
      byte_size: number;
    }>(
      `select object_path, byte_size
       from community_media
       where owner_id = $1
       for update`,
      [userId],
    );
    const reservations = await client.query<{
      object_path: string | null;
      byte_size: number;
    }>(
      `select object_path, byte_size
       from media_quota_reservations
       where user_id = $1
       for update`,
      [userId],
    );

    const objectPaths = [
      ...media.rows.map((item) => item.object_path),
      ...reservations.rows.flatMap((item) =>
        item.object_path ? [item.object_path] : [],
      ),
    ];
    if (objectPaths.length) {
      // R2 삭제는 반복해도 안전하므로 일부 실패 뒤 재시도할 수 있습니다.
      await mediaBucket.delete(objectPaths);
    }

    const usedBytes = media.rows.reduce(
      (total, item) => total + BigInt(item.byte_size),
      0n,
    );
    const reservedBytes = reservations.rows.reduce(
      (total, item) => total + BigInt(item.byte_size),
      0n,
    );

    await client.query('delete from community_media where owner_id = $1', [
      userId,
    ]);
    await client.query(
      'delete from media_quota_reservations where user_id = $1',
      [userId],
    );
    await client.query(
      `update community_settings
       set storage_used_bytes = greatest(0, storage_used_bytes - $1::bigint),
           storage_reserved_bytes = greatest(0, storage_reserved_bytes - $2::bigint),
           updated_at = now()
       where id = true`,
      [usedBytes.toString(), reservedBytes.toString()],
    );

    // 작성한 방명록과 후기는 기록으로 남기되 계정과 공개 이름 연결을 끊습니다.
    await client.query(
      `update guestbook_posts
       set user_id = null, author_name = '익명 사용자', updated_at = now()
       where user_id = $1`,
      [userId],
    );
    await client.query(
      `update schedule_reviews
       set user_id = null, author_name = '익명 사용자', updated_at = now()
       where user_id = $1`,
      [userId],
    );

    // 좋아요와 이의제기 신청은 계정과 함께 제거합니다. 신고는 처리 기록을 보존하고
    // 사용자 FK의 ON DELETE 동작으로 신고자 연결만 끊습니다.
    await client.query('delete from schedule_likes where user_id = $1', [
      userId,
    ]);
    await client.query('delete from content_appeals where author_id = $1', [
      userId,
    ]);

    await client.query('commit');
    return {
      anonymized: true,
      deletedMediaCount: media.rows.length,
      deletedMediaBytes: usedBytes.toString(),
      releasedReservationCount: reservations.rows.length,
      releasedReservationBytes: reservedBytes.toString(),
    };
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
