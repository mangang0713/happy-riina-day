import { afterEach, describe, expect, it, vi } from 'vitest';
import { getXUserInfo } from './auth';

describe('X OAuth profile lookup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps the X profile to Better Auth user fields and preserves the raw provider shape', async () => {
    const profile = {
      id: '1234567890',
      name: 'Test User',
      username: 'test_user',
      profile_image_url: 'https://images.example.test/avatar.jpg',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ data: profile }, { status: 200 })),
    );

    const result = await getXUserInfo('test-access-token');

    expect(result).toEqual({
      data: { data: profile },
      user: {
        name: 'Test User',
        email: 'x-1234567890@accounts.invalid',
        image: 'https://images.example.test/avatar.jpg',
        emailVerified: false,
      },
    });
  });

  it('rejects a non-success response without logging the token or response body', async () => {
    const token = 'sensitive-test-token';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ detail: 'private provider response' }, { status: 403 }),
      );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', fetchMock);

    await expect(getXUserInfo(token)).resolves.toBeNull();

    expect(errorLog).toHaveBeenCalledWith('[auth:x] Profile lookup rejected.', {
      status: 403,
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(token);
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
      'private provider response',
    );
  });

  it('does not make a profile request when the access token is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(getXUserInfo()).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
