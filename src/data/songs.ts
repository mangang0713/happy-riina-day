/**
 * 이 파일은 세트리스트가 참조하는 곡 ID와 표시 이름의 공통 목록을 보관합니다.
 */

import type { Song } from '../types/archive'

// 사용자 확인 세트리스트에서 실제로 참조되는 곡과 커버 기록입니다.
export const songs: Song[] = [
  { id: 'rose-between-buildings', title: '건물 사이에 피어난 장미' },
  { id: 'to-my-first-love', title: '나의 첫사랑에게' },
  { id: 'lets-get-hot', title: '뜨거워지자' },
  { id: 'it-was-summer', title: '여름이었다' },
  { id: 'romantic-overdose', title: '낭만 한도 초과' },
  { id: 'world-is-not-like-a-movie', title: '세상은 영화같지 않더라' },
  { id: 'low-key-scared-but-h1-key-ready', title: 'Low-key Scared But H1-KEY Ready' },
  { id: 'good-for-u', title: 'Good For U' },
  { id: 'heart-light', title: 'Heart Light' },
  { id: 'dont-let-the-light-go-out', title: '불빛을 꺼트리지 마' },
  { id: 'kawaii-dakeja-dame-desuka-cover', title: 'かわいいだけじゃだめですか？(cover)' },
  { id: 'shake-it-cover', title: 'Shake It(cover)' },
  { id: 'seoul', title: 'SEOUL' },
]
