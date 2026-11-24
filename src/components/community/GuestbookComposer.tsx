/**
 * 이 컴포넌트는 방명록 작성·수정과 사진 선택·미리보기·업로드 요청을 담당합니다.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  acceptCommunityTerms,
  getCommunityErrorDetails,
  GuestbookPhotoUploadError,
  resumeGuestbookPhotoUploads,
  saveGuestbookPost,
} from '../../features/community/api';
import type { GuestbookPost } from '../../features/community/types';
import TurnstileWidget from '../security/TurnstileWidget';
import { useTurnstileToken } from '../security/useTurnstileToken';

const MAX_POST_IMAGES = 3;

type GuestbookComposerProps = {
  editingPostId?: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  page: number;
  posts: GuestbookPost[];
  loadPosts: (
    page?: number,
    append?: boolean,
  ) => Promise<GuestbookPost[] | null | undefined>;
  onMessage: (message: string) => void;
};

/** 사용자가 동의·봇 확인·사진 제한을 지키며 방명록을 작성하도록 합니다. */
function GuestbookComposer({
  editingPostId,
  busy,
  setBusy,
  page,
  posts,
  loadPosts,
  onMessage,
}: GuestbookComposerProps) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<
    Array<{ file: File; url: string }>
  >([]);
  const previewUrlsRef = useRef<string[]>([]);
  const [resumePostId, setResumePostId] = useState<string>();
  const [submissionError, setSubmissionError] = useState<{
    code: string;
    message: string;
  } | null>(null);
  const {
    token: turnstileToken,
    resetKey: turnstileResetKey,
    onToken: setTurnstileToken,
    requestFreshToken,
    reset: resetTurnstile,
  } = useTurnstileToken();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [consentError, setConsentError] = useState('');
  const consentCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function replaceSelectedPhotos(nextFiles: File[]) {
    setSubmissionError(null);
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const previews = nextFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    previewUrlsRef.current = previews.map((preview) => preview.url);
    setFiles(nextFiles);
    setPhotoPreviews(previews);
  }

  function addSelectedPhotos(newFiles: File[]) {
    const fileKey = (file: File) =>
      `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    const existing = new Set(files.map(fileKey));
    const additions = newFiles.filter((file) => {
      const key = fileKey(file);
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    const remaining = MAX_POST_IMAGES - files.length;
    if (additions.length > remaining) {
      onMessage(
        `사진은 게시물당 최대 ${MAX_POST_IMAGES}장까지 선택할 수 있어 ${remaining}장만 추가했습니다.`,
      );
    } else if (additions.length < newFiles.length) {
      onMessage('이미 선택한 사진은 중복으로 추가하지 않았습니다.');
    } else {
      onMessage('');
    }
    replaceSelectedPhotos([...files, ...additions.slice(0, remaining)]);
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingPostId) return;
    if (body.trim().length < 2) {
      onMessage('축하 글을 두 글자 이상 입력해 주세요.');
      return;
    }
    if (files.length > MAX_POST_IMAGES) {
      onMessage(
        `사진은 게시물당 최대 ${MAX_POST_IMAGES}장까지 선택할 수 있습니다.`,
      );
      return;
    }
    const invalidFile = files.find(
      (file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    );
    if (invalidFile) {
      onMessage(
        'JPG, PNG, WebP 사진을 선택해 주세요. 1MB가 넘는 사진은 업로드 전에 자동으로 줄입니다.',
      );
      return;
    }
    if (!termsAccepted) {
      setConsentError('글을 등록하려면 공개 안내를 확인하고 동의해 주세요.');
      consentCheckboxRef.current?.focus();
      return;
    }
    setConsentError('');
    setBusy(true);
    onMessage('');
    setSubmissionError(null);
    const continuingUpload = Boolean(resumePostId);
    try {
      await acceptCommunityTerms();
      if (continuingUpload && resumePostId) {
        await resumeGuestbookPhotoUploads(
          files,
          resumePostId,
          requestFreshToken,
        );
      } else {
        await saveGuestbookPost(
          body.trim(),
          files,
          undefined,
          turnstileToken,
          requestFreshToken,
        );
      }
      setBody('');
      replaceSelectedPhotos([]);
      setResumePostId(undefined);
      await loadPosts();
      resetTurnstile();
      setTermsAccepted(false);
      onMessage(
        continuingUpload
          ? '남은 사진을 글에 추가했습니다.'
          : '축하 글을 등록했습니다.',
      );
    } catch (error) {
      const details = getCommunityErrorDetails(error);
      if (error instanceof GuestbookPhotoUploadError) {
        const previousPhotoCount =
          posts.find((post) => post.id === error.postId)?.media?.length ?? 0;
        const refreshedPosts = await loadPosts(error.createdPost ? 0 : page);
        const refreshedPhotoCount = refreshedPosts?.find(
          (post) => post.id === error.postId,
        )?.media?.length;
        const confirmedPhotoCount = Math.min(
          error.totalPhotoCount,
          Math.max(
            error.uploadedPhotoCount,
            refreshedPhotoCount === undefined
              ? 0
              : Math.max(0, refreshedPhotoCount - previousPhotoCount),
          ),
        );

        if (confirmedPhotoCount === error.totalPhotoCount) {
          setBody('');
          replaceSelectedPhotos([]);
          setResumePostId(undefined);
          resetTurnstile();
          setTermsAccepted(false);
          onMessage(
            `요청 응답은 실패했지만 글과 사진 ${confirmedPhotoCount}장을 남겨진 글에서 확인했습니다.`,
          );
        } else {
          setResumePostId(error.postId);
          replaceSelectedPhotos(files.slice(confirmedPhotoCount));
          resetTurnstile();
          onMessage(
            refreshedPosts
              ? `글은 저장되었습니다. 사진 ${confirmedPhotoCount}/${error.totalPhotoCount}장이 연결된 것을 확인했습니다. 남은 사진은 이 글을 새로 등록하지 말고 다시 첨부할 수 있습니다.`
              : '글 저장 요청은 완료됐지만 목록에서 사진 상태를 다시 확인하지 못했습니다. 새 글을 다시 만들지 말고 남겨진 글을 새로고침해 확인해 주세요.',
          );
          setSubmissionError(details);
        }
      } else {
        setSubmissionError(details);
        resetTurnstile();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="community-form guestbook-form"
        onSubmit={(event) => void submitPost(event)}
      >
        <label htmlFor="guestbook-body">축하 글</label>
        <textarea
          id="guestbook-body"
          value={body}
          maxLength={1200}
          rows={4}
          placeholder="리이나에게 전하고 싶은 마음을 적어 주세요."
          onChange={(event) => setBody(event.target.value)}
        />
        <div className="form-footer">
          <label className="file-picker" htmlFor="guestbook-images">
            사진 추가 (최대 3장)
          </label>
          <input
            id="guestbook-images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              addSelectedPhotos(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <button
            className="primary-button"
            disabled={busy || Boolean(editingPostId)}
          >
            {busy ? '등록 중…' : resumePostId ? '남은 사진 추가' : '등록'}
          </button>
          <span>
            {files.length}/{MAX_POST_IMAGES}장 선택 · {body.length}/1200자 ·
            계정당 사진 10장, 총 10MB까지
          </span>
        </div>
        {photoPreviews.length > 0 && (
          <div
            className="guestbook-photo-previews"
            aria-label="업로드할 사진 미리보기"
          >
            {photoPreviews.map(({ file, url }, index) => (
              <figure key={`${file.name}-${file.lastModified}-${index}`}>
                <img src={url} alt={`${file.name} 미리보기`} />
                <figcaption>{file.name}</figcaption>
                <button
                  type="button"
                  aria-label={`${file.name} 사진 제거`}
                  onClick={() =>
                    replaceSelectedPhotos(
                      files.filter((_, fileIndex) => fileIndex !== index),
                    )
                  }
                >
                  ×
                </button>
              </figure>
            ))}
          </div>
        )}
        <label className="consent-field">
          <input
            ref={consentCheckboxRef}
            type="checkbox"
            checked={termsAccepted}
            aria-invalid={consentError ? true : undefined}
            aria-describedby={
              consentError ? 'guestbook-consent-error' : undefined
            }
            onChange={(event) => {
              setTermsAccepted(event.target.checked);
              if (event.target.checked) setConsentError('');
            }}
          />
          <span>
            <Link to="/policy/privacy" target="_blank" rel="noreferrer">
              개인정보·공개 안내
            </Link>
            를 확인했고, 글과 선택한 사진이 공개되는 데 동의합니다.
          </span>
        </label>
        {consentError && (
          <p
            className="consent-error"
            id="guestbook-consent-error"
            role="alert"
          >
            {consentError}
          </p>
        )}
        <div
          className="guestbook-turnstile"
          role="group"
          aria-label="Cloudflare 보안 확인"
        >
          <TurnstileWidget
            onToken={setTurnstileToken}
            resetKey={turnstileResetKey}
            appearance="interaction-only"
          />
        </div>
        {resumePostId && (
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setResumePostId(undefined);
              setBody('');
              replaceSelectedPhotos([]);
            }}
          >
            사진 이어 올리기 취소
          </button>
        )}
      </form>
      {submissionError && (
        <div className="community-error-details" role="alert">
          <strong>등록 요청 오류 · {submissionError.code}</strong>
          <span>{submissionError.message}</span>
        </div>
      )}
    </>
  );
}

export default GuestbookComposer;
