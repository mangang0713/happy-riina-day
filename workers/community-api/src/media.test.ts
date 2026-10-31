// 이미지 파일명이나 브라우저 MIME 선언을 믿지 않고 실제 파일 시그니처를 검사합니다.
import { describe, expect, it } from 'vitest';
import { detectImageContentType } from './media';

describe('detectImageContentType', () => {
  it('recognizes supported image signatures', () => {
    expect(detectImageContentType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(
      'image/jpeg',
    );
    expect(
      detectImageContentType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
    expect(
      detectImageContentType(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
          0x50,
        ]),
      ),
    ).toBe('image/webp');
  });

  it('rejects unsupported and truncated signatures', () => {
    expect(detectImageContentType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(
      detectImageContentType(new Uint8Array([0x52, 0x49, 0x46, 0x46])),
    ).toBeNull();
    expect(
      detectImageContentType(new TextEncoder().encode('not an image')),
    ).toBeNull();
  });
});
