import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import type { WorkerVariables } from './env';

/** 사용자 사진의 검증, 저장량 예약, 비공개 객체 전달과 삭제를 맡습니다. */
// 업로드 수·계정별 용량·전체 저장 공간 제한은 기존 무료 운영 정책을 따릅니다.
const ACCOUNT_IMAGE_LIMIT = 10;
const ACCOUNT_BYTE_LIMIT = 10 * 1024 * 1024;
export const MAX_MEDIA_FILE_BYTES = 1024 * 1024;
const MAX_DATABASE_BYTES = 400 * 1024 * 1024;

/** 사용자 사진을 연결할 수 있는 게시물 종류입니다. */
export type MediaParentType = 'guestbook' | 'review';
/** 파일 바이트에서 확인해 허용하는 이미지 형식입니다. */
export type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

/** 사진 검증·권한·할당량 처리 중 클라이언트에 안전하게 전달할 오류입니다. */
export class MediaError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 429 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** 사용자가 보낸 파일 형식 선언 대신 실제 바이트 서명으로 허용 이미지인지 확인합니다. */
export function detectImageContentType(
  bytes: Uint8Array,
): ImageContentType | null {
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  if (isJpeg) return 'image/jpeg';

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value)
  ) {
    return 'image/png';
  }

  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  return isWebp ? 'image/webp' : null;
}

async function query<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await client.query<T>(sql, values as never[] | undefined);
  } catch {
    throw new MediaError(
      503,
      'DATABASE_UNAVAILABLE',
      '커뮤니티 데이터베이스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
}

async function transaction<T>(
  database: WorkerVariables['database'],
  operation: (client: PoolClient) => Promise<T>,
) {
  let client: PoolClient;
  try {
    client = await database.connect();
  } catch {
    throw new MediaError(
      503,
      'DATABASE_UNAVAILABLE',
      '커뮤니티 데이터베이스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  try {
    await query(client, 'begin');
    const result = await operation(client);
    await query(client, 'commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** 업로드 동시성 잠금을 잡고 중단 스위치·DB 상한을 검사합니다. */
async function lockSettings(client: PoolClient) {
  const { rows } = await query<{
    community_enabled: boolean;
    uploads_enabled: boolean;
    storage_limit_bytes: string;
    storage_used_bytes: string;
    storage_reserved_bytes: string;
    database_bytes: string;
  }>(
    client,
    `
      select community_enabled, uploads_enabled, storage_limit_bytes::text,
             storage_used_bytes::text, storage_reserved_bytes::text,
             pg_database_size(current_database())::text as database_bytes
      from community_settings
      where id = true
      for update
    `,
  );
  const settings = rows[0];
  if (!settings || !settings.community_enabled || !settings.uploads_enabled) {
    throw new MediaError(
      503,
      'UPLOADS_DISABLED',
      '현재 사진 업로드를 사용할 수 없습니다.',
    );
  }
  if (Number(settings.database_bytes) >= MAX_DATABASE_BYTES) {
    throw new MediaError(
      503,
      'DATABASE_LIMIT_REACHED',
      '저장 공간 한도에 도달해 사진 업로드를 잠시 중단했습니다.',
    );
  }
  return settings;
}

function parentTable(parentType: MediaParentType) {
  return parentType === 'guestbook' ? 'guestbook_posts' : 'schedule_reviews';
}

function parentMediaColumn(parentType: MediaParentType) {
  return parentType === 'guestbook'
    ? 'guestbook_post_id'
    : 'schedule_review_id';
}

/** 본인 소유이며 공개 상태인 글만 새 사진 첨부 대상으로 허용합니다. */
async function lockPublishedParent(
  client: PoolClient,
  parentType: MediaParentType,
  parentId: string,
  userId: string,
) {
  const table = parentTable(parentType);
  const { rows } = await query<{ id: string }>(
    client,
    `
      select id from ${table}
      where id = $1 and user_id = $2 and status = 'published'
      for update
    `,
    [parentId, userId],
  );
  if (!rows[0]) {
    throw new MediaError(
      404,
      'MEDIA_PARENT_NOT_FOUND',
      '사진을 연결할 본인의 공개 게시물을 찾을 수 없습니다.',
    );
  }
}

/** 실패·만료 예약을 지우고 계정 및 전체 저장소의 예약량을 되돌립니다. */
async function releaseReservationWithClient(
  client: PoolClient,
  reservationId: string,
) {
  const { rows } = await query<{
    user_id: string;
    byte_size: number;
  }>(
    client,
    `
      select user_id, byte_size
      from media_quota_reservations
      where id = $1
      for update
    `,
    [reservationId],
  );
  const reservation = rows[0];
  if (!reservation) return false;

  await query(
    client,
    `
      update user_media_usage
      set images_reserved = greatest(0, images_reserved - 1),
          bytes_reserved = greatest(0, bytes_reserved - $2), updated_at = now()
      where user_id = $1
    `,
    [reservation.user_id, reservation.byte_size],
  );
  await query(
    client,
    `
      update community_settings
      set storage_reserved_bytes = greatest(0, storage_reserved_bytes - $1),
          updated_at = now()
      where id = true
    `,
    [reservation.byte_size],
  );
  await query(client, 'delete from media_quota_reservations where id = $1', [
    reservationId,
  ]);
  return true;
}

/** 만료된 업로드 예약과 고아 R2 파일을 제한된 묶음으로 정리합니다. */
export async function cleanExpiredMediaUploads(
  database: WorkerVariables['database'],
  bucket: R2Bucket,
  limit = 10,
) {
  let expiredReservations: { id: string }[];
  try {
    const { rows } = await database.query<{ id: string }>(
      `
        select id
        from media_quota_reservations
        where expires_at <= now()
        order by expires_at
        limit $1
      `,
      [Math.max(1, Math.min(25, limit))],
    );
    expiredReservations = rows;
  } catch {
    throw new MediaError(
      503,
      'DATABASE_UNAVAILABLE',
      '만료된 사진 업로드를 확인할 수 없습니다.',
    );
  }

  for (const candidate of expiredReservations) {
    await transaction(database, async (client) => {
      await query(
        client,
        'select id from community_settings where id = true for update',
      );
      const { rows: reservations } = await query<{
        id: string;
        object_path: string | null;
        expired: boolean;
      }>(
        client,
        `
          select id, object_path, (expires_at <= now()) as expired
          from media_quota_reservations
          where id = $1
          for update
        `,
        [candidate.id],
      );
      const reservation = reservations[0];
      if (!reservation?.expired) return;
      if (reservation.object_path) {
        try {
          await bucket.delete(reservation.object_path);
        } catch {
          throw new MediaError(
            503,
            'MEDIA_STORAGE_UNAVAILABLE',
            '만료된 사진 업로드를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          );
        }
      }
      await releaseReservationWithClient(client, reservation.id);
    });
  }
}

/** R2 저장 전에 계정·게시물·전체 용량을 원자적으로 예약해 동시 초과 업로드를 막습니다. */
export async function reserveMediaUpload(
  database: WorkerVariables['database'],
  input: {
    userId: string;
    parentType: MediaParentType;
    parentId: string;
    objectPath: string;
    byteSize: number;
  },
) {
  return transaction(database, async (client) => {
    const settings = await lockSettings(client);
    if (
      BigInt(settings.storage_used_bytes) +
        BigInt(settings.storage_reserved_bytes) +
        BigInt(input.byteSize) >
      BigInt(settings.storage_limit_bytes)
    ) {
      throw new MediaError(
        503,
        'STORAGE_LIMIT_REACHED',
        '사진 저장 공간 한도에 도달했습니다. 새 사진 업로드를 잠시 중단했습니다.',
      );
    }

    await query(
      client,
      'insert into user_media_usage (user_id) values ($1) on conflict do nothing',
      [input.userId],
    );
    const { rows: usageRows } = await query<{
      image_count: number;
      bytes_used: string;
      images_reserved: number;
      bytes_reserved: string;
    }>(
      client,
      `
        select image_count, bytes_used::text, images_reserved, bytes_reserved::text
        from user_media_usage
        where user_id = $1
        for update
      `,
      [input.userId],
    );
    const usage = usageRows[0];
    if (!usage) {
      throw new MediaError(
        503,
        'DATABASE_UNAVAILABLE',
        '사진 한도를 확인할 수 없습니다.',
      );
    }
    if (
      usage.image_count + usage.images_reserved >= ACCOUNT_IMAGE_LIMIT ||
      BigInt(usage.bytes_used) +
        BigInt(usage.bytes_reserved) +
        BigInt(input.byteSize) >
        BigInt(ACCOUNT_BYTE_LIMIT)
    ) {
      throw new MediaError(
        409,
        'USER_MEDIA_QUOTA_REACHED',
        '계정별 사진 한도에 도달했습니다. 기존 사진을 정리한 뒤 다시 시도해 주세요.',
      );
    }

    await lockPublishedParent(
      client,
      input.parentType,
      input.parentId,
      input.userId,
    );
    const mediaColumn = parentMediaColumn(input.parentType);
    const { rows: counts } = await query<{ count: number }>(
      client,
      `
        select (
          (select count(*) from community_media where ${mediaColumn} = $1) +
          (select count(*) from media_quota_reservations
             where parent_type = $2 and parent_id = $1 and expires_at > now())
        )::integer as count
      `,
      [input.parentId, input.parentType],
    );
    if ((counts[0]?.count ?? 0) >= 3) {
      throw new MediaError(
        409,
        'POST_MEDIA_LIMIT_REACHED',
        '게시물당 사진은 최대 3장까지 첨부할 수 있습니다.',
      );
    }

    await query(
      client,
      `
        update user_media_usage
        set images_reserved = images_reserved + 1,
            bytes_reserved = bytes_reserved + $2,
            updated_at = now()
        where user_id = $1
      `,
      [input.userId, input.byteSize],
    );
    await query(
      client,
      `
        update community_settings
        set storage_reserved_bytes = storage_reserved_bytes + $1,
            updated_at = now()
        where id = true
      `,
      [input.byteSize],
    );
    const { rows: reservations } = await query<{ id: string }>(
      client,
      `
        insert into media_quota_reservations
          (user_id, byte_size, parent_type, parent_id, object_path)
        values ($1, $2, $3, $4, $5)
        returning id
      `,
      [
        input.userId,
        input.byteSize,
        input.parentType,
        input.parentId,
        input.objectPath,
      ],
    );
    if (!reservations[0]) {
      throw new MediaError(
        503,
        'DATABASE_UNAVAILABLE',
        '사진 업로드 예약을 저장하지 못했습니다.',
      );
    }
    return reservations[0].id;
  });
}

/** R2 저장 성공분을 DB 메타데이터와 사용량으로 확정합니다. R2와 DB는 한 트랜잭션이 아니므로 실패 시 호출부가 보상 삭제합니다. */
export async function finalizeMediaUpload(
  database: WorkerVariables['database'],
  input: {
    reservationId: string;
    userId: string;
    parentType: MediaParentType;
    parentId: string;
    objectPath: string;
    contentType: ImageContentType;
    byteSize: number;
  },
) {
  return transaction(database, async (client) => {
    await lockSettings(client);
    const { rows: reservations } = await query<{
      id: string;
      user_id: string;
      byte_size: number;
      parent_type: MediaParentType;
      parent_id: string;
      object_path: string;
      expired: boolean;
    }>(
      client,
      `
        select id, user_id, byte_size, parent_type, parent_id, object_path,
               (expires_at <= now()) as expired
        from media_quota_reservations
        where id = $1
        for update
      `,
      [input.reservationId],
    );
    const reservation = reservations[0];
    if (
      !reservation ||
      reservation.expired ||
      reservation.user_id !== input.userId ||
      reservation.parent_type !== input.parentType ||
      reservation.parent_id !== input.parentId ||
      reservation.object_path !== input.objectPath ||
      reservation.byte_size !== input.byteSize
    ) {
      throw new MediaError(
        409,
        'MEDIA_RESERVATION_EXPIRED',
        '사진 업로드 예약이 만료되었습니다. 다시 업로드해 주세요.',
      );
    }

    await lockPublishedParent(
      client,
      input.parentType,
      input.parentId,
      input.userId,
    );
    const mediaColumn = parentMediaColumn(input.parentType);
    const { rows: counts } = await query<{ count: number }>(
      client,
      `
        select (
          (select count(*) from community_media where ${mediaColumn} = $1) +
          (select count(*) from media_quota_reservations
             where parent_type = $2 and parent_id = $1
               and id <> $3 and expires_at > now())
        )::integer as count
      `,
      [input.parentId, input.parentType, input.reservationId],
    );
    if ((counts[0]?.count ?? 0) >= 3) {
      throw new MediaError(
        409,
        'POST_MEDIA_LIMIT_REACHED',
        '게시물당 사진은 최대 3장까지 첨부할 수 있습니다.',
      );
    }

    const mediaColumnName =
      input.parentType === 'guestbook'
        ? 'guestbook_post_id'
        : 'schedule_review_id';
    const { rows } = await query<{ id: string }>(
      client,
      `
        insert into community_media
          (owner_id, ${mediaColumnName}, object_path, content_type, byte_size)
        values ($1, $2, $3, $4, $5)
        returning id
      `,
      [
        input.userId,
        input.parentId,
        input.objectPath,
        input.contentType,
        input.byteSize,
      ],
    );
    if (!rows[0]) {
      throw new MediaError(
        503,
        'DATABASE_UNAVAILABLE',
        '사진 정보를 저장하지 못했습니다.',
      );
    }

    await query(
      client,
      `
        update user_media_usage
        set image_count = image_count + 1,
            bytes_used = bytes_used + $2,
            images_reserved = greatest(0, images_reserved - 1),
            bytes_reserved = greatest(0, bytes_reserved - $2),
            updated_at = now()
        where user_id = $1
      `,
      [input.userId, input.byteSize],
    );
    await query(
      client,
      `
        update community_settings
        set storage_used_bytes = storage_used_bytes + $1,
            storage_reserved_bytes = greatest(0, storage_reserved_bytes - $1),
            updated_at = now()
        where id = true
      `,
      [input.byteSize],
    );
    await query(client, 'delete from media_quota_reservations where id = $1', [
      input.reservationId,
    ]);
    return rows[0].id;
  });
}

/** 확정 전에 실패한 예약을 취소하며 이미 사용 중인 용량은 건드리지 않습니다. */
export async function releaseMediaUpload(
  database: WorkerVariables['database'],
  reservationId: string,
) {
  return transaction(database, async (client) => {
    await query(
      client,
      'select id from community_settings where id = true for update',
    );
    return releaseReservationWithClient(client, reservationId);
  });
}

/** 첨부 사진을 작성자 또는 관리자가 삭제하고 계정·전체 저장량을 함께 정산합니다. */
export async function deleteCommunityMedia(
  database: WorkerVariables['database'],
  bucket: R2Bucket,
  mediaId: string,
  userId: string,
) {
  await transaction(database, async (client) => {
    await query(
      client,
      'select id from community_settings where id = true for update',
    );
    const { rows } = await query<{
      id: string;
      owner_id: string | null;
      object_path: string;
      byte_size: number;
      guestbook_post_id: string | null;
      schedule_review_id: string | null;
    }>(
      client,
      `
        select id, owner_id, object_path, byte_size,
               guestbook_post_id, schedule_review_id
        from community_media
        where id = $1
        for update
      `,
      [mediaId],
    );
    const media = rows[0];
    if (!media) {
      throw new MediaError(404, 'NOT_FOUND', '첨부 사진을 찾을 수 없습니다.');
    }

    const { rows: admins } = await query<{ is_admin: boolean }>(
      client,
      'select exists(select 1 from admin_members where user_id = $1) as is_admin',
      [userId],
    );
    if (media.owner_id !== userId && !admins[0]?.is_admin) {
      throw new MediaError(403, 'FORBIDDEN', '본인 사진만 삭제할 수 있습니다.');
    }

    const parent = media.guestbook_post_id
      ? { table: 'guestbook_posts', id: media.guestbook_post_id }
      : media.schedule_review_id
        ? { table: 'schedule_reviews', id: media.schedule_review_id }
        : null;
    if (!parent) {
      throw new MediaError(
        409,
        'MEDIA_PARENT_NOT_FOUND',
        '사진 게시물을 찾을 수 없습니다.',
      );
    }
    const { rows: parentRows } = await query<{ status: string }>(
      client,
      `select status from ${parent.table} where id = $1 for update`,
      [parent.id],
    );
    if (!parentRows[0] || parentRows[0].status !== 'published') {
      throw new MediaError(
        409,
        'CONTENT_UNDER_REVIEW',
        '숨김 검토 중인 게시물의 사진은 보존 기간 동안 삭제할 수 없습니다.',
      );
    }

    try {
      await bucket.delete(media.object_path);
    } catch {
      throw new MediaError(
        503,
        'MEDIA_STORAGE_UNAVAILABLE',
        '사진 파일을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    }

    if (media.owner_id) {
      await query(
        client,
        `
          update user_media_usage
          set image_count = greatest(0, image_count - 1),
              bytes_used = greatest(0, bytes_used - $2), updated_at = now()
          where user_id = $1
        `,
        [media.owner_id, media.byte_size],
      );
    }
    await query(
      client,
      `
        update community_settings
        set storage_used_bytes = greatest(0, storage_used_bytes - $1),
            updated_at = now()
        where id = true
      `,
      [media.byte_size],
    );
    await query(client, 'delete from community_media where id = $1', [
      media.id,
    ]);
  });
}
