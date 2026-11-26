/**
 * 이 모듈은 일정 사진 URL을 검증하고 팝업 안에서 사진 미리보기를 구성합니다.
 */

import './PhotoGallery.css';

const officialMediaPrefix = `${import.meta.env.BASE_URL}media/official/`;

function getSafePhotoUrls(urls: string[]) {
  return urls.filter((value) => {
    if (value.startsWith(officialMediaPrefix)) return true;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  });
}

// 사진은 페이지 안에서 확대합니다. X 게시물 임베드 iframe의 클릭은 브라우저 보안상 가로챌 수 없습니다.
export function renderPhotoGallery(
  container: HTMLElement,
  urls: string[],
  headingText = '사진 미리보기',
) {
  const photos = getSafePhotoUrls(urls);
  if (!photos.length) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const section = document.createElement('section');
  section.className = 'archive-photo-gallery';

  const heading = document.createElement('h3');
  heading.textContent = headingText;
  section.append(heading);

  const grid = document.createElement('div');
  grid.className = 'archive-photo-grid';
  section.append(grid);

  let dialog: HTMLElement | undefined;
  let previousFocus: HTMLElement | undefined;
  let activeIndex = 0;

  const closeDialog = () => {
    dialog?.remove();
    dialog = undefined;
    previousFocus?.focus();
    previousFocus = undefined;
  };

  const showPhoto = (index: number) => {
    activeIndex = (index + photos.length) % photos.length;
    const image = dialog?.querySelector('img');
    const counter = dialog?.querySelector<HTMLOutputElement>(
      '.archive-photo-counter',
    );
    if (image) {
      image.src = photos[activeIndex];
      image.alt = `사진 ${activeIndex + 1}`;
    }
    if (counter) counter.value = `${activeIndex + 1} / ${photos.length}`;
  };

  const openDialog = (index: number, trigger: HTMLElement) => {
    if (dialog) return;
    previousFocus = trigger;
    dialog = document.createElement('div');
    dialog.className = 'archive-photo-viewer';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '사진 미리보기');

    const frame = document.createElement('div');
    frame.className = 'archive-photo-viewer-frame';
    const image = document.createElement('img');
    image.alt = '';
    frame.append(image);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'archive-photo-viewer-close';
    close.setAttribute('aria-label', '사진 미리보기 닫기');
    close.textContent = '×';
    close.addEventListener('click', closeDialog, { signal });

    const controls = document.createElement('div');
    controls.className = 'archive-photo-viewer-controls';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.setAttribute('aria-label', '이전 사진');
    previous.textContent = '‹';
    previous.addEventListener('click', () => showPhoto(activeIndex - 1), {
      signal,
    });
    const counter = document.createElement('output');
    counter.className = 'archive-photo-counter';
    const next = document.createElement('button');
    next.type = 'button';
    next.setAttribute('aria-label', '다음 사진');
    next.textContent = '›';
    next.addEventListener('click', () => showPhoto(activeIndex + 1), {
      signal,
    });
    controls.append(previous, counter, next);

    dialog.append(close, frame, controls);
    dialog.addEventListener(
      'click',
      (event) => {
        if (event.target === dialog) closeDialog();
      },
      { signal },
    );
    dialog.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          closeDialog();
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          showPhoto(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
        }
        // 확대 중에는 키보드가 뒤쪽 지도·행사 패널로 빠지지 않게 합니다.
        if (event.key === 'Tab') {
          const controls = [close, previous, next];
          const activeControl = controls.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          if (event.shiftKey && activeControl <= 0) {
            event.preventDefault();
            next.focus();
          } else if (
            !event.shiftKey &&
            (activeControl === controls.length - 1 || activeControl === -1)
          ) {
            event.preventDefault();
            close.focus();
          }
        }
      },
      { signal },
    );
    document.body.append(dialog);
    showPhoto(index);
    close.focus();
  };

  photos.forEach((url, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'archive-photo-thumb';
    button.setAttribute('aria-label', `사진 ${index + 1} 크게 보기`);
    const image = document.createElement('img');
    image.src = url;
    image.alt = `사진 ${index + 1}`;
    image.loading = 'lazy';
    button.append(image);
    button.addEventListener('click', () => openDialog(index, button), {
      signal,
    });
    grid.append(button);
  });

  container.append(section);
  signal.addEventListener('abort', closeDialog, { once: true });
  return () => {
    controller.abort();
    section.remove();
  };
}
