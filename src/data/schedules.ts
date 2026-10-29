/**
 * 이 파일은 스프레드시트에서 검증해 반영한 일정 원본과 일정별 X 게시물 연결을 보관합니다.
 */

import type { Schedule } from '../types/archive'
import { locations } from './locations'
import { songs } from './songs'
import { photoPostsByScheduleId } from './schedulePhotos'
import { officialScheduleMediaByScheduleId } from './officialScheduleMedia'

// 사용자 확인 스프레드시트의 일정과 세트리스트입니다.
export const schedules: Schedule[] = [
  {
    "id": "schedule-2026-02-21-01",
    "locationId": "venue-001",
    "eventFormat": "in-person",
    "title": "🎂HAPPY RIINA DAY🎂",
    "date": "2026-02-21",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-02-26-01",
    "locationId": "venue-002",
    "eventFormat": "in-person",
    "title": "2026학년도 영남대학교 입학식 및 신입생 환영회",
    "date": "2026-02-26",
    "startTime": "14:30",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "world-is-not-like-a-movie",
      "low-key-scared-but-h1-key-ready",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-02-27-01",
    "locationId": "venue-003",
    "eventFormat": "in-person",
    "title": "2026 ONE FORCE",
    "date": "2026-02-27",
    "startTime": "14:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-03-05-01",
    "locationId": "venue-004",
    "eventFormat": "in-person",
    "title": "Mnet 엠카운트다운",
    "date": "2026-03-05",
    "startTime": "18:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-06-01",
    "locationId": "venue-005",
    "eventFormat": "in-person",
    "title": "KBS2 뮤직뱅크",
    "date": "2026-03-06",
    "startTime": "17:05",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-07-01",
    "locationId": "venue-006",
    "eventFormat": "in-person",
    "title": "MBC 쇼! 음악중심",
    "date": "2026-03-07",
    "startTime": "15:20",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-08-01",
    "locationId": "venue-007",
    "eventFormat": "in-person",
    "title": "SBS 인기가요",
    "date": "2026-03-08",
    "startTime": "15:20",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-08-02",
    "locationId": "venue-008",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (메이크스타 1차)",
    "date": "2026-03-08",
    "startTime": "19:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-10-01",
    "locationId": "venue-009",
    "eventFormat": "in-person",
    "title": "EBS 라디오 청소년소통프로젝트 경청",
    "date": "2026-03-10",
    "startTime": "22:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-03-11-01",
    "locationId": "venue-010",
    "eventFormat": "in-person",
    "title": "MBC M 쇼! 챔피언",
    "date": "2026-03-11",
    "startTime": "17:00",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-11-02",
    "locationId": "venue-011",
    "eventFormat": "in-person",
    "title": "2026 경상대학 X 사회과학대학 X 생명나노과학대학 연합 해오름제",
    "date": "2026-03-11",
    "startTime": "20:50",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "world-is-not-like-a-movie",
      "it-was-summer"
    ]
  },
  {
    "id": "schedule-2026-03-12-01",
    "locationId": "venue-004",
    "eventFormat": "in-person",
    "title": "Mnet 엠카운트다운",
    "date": "2026-03-12",
    "startTime": "18:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-13-01",
    "locationId": "venue-005",
    "eventFormat": "in-person",
    "title": "KBS2 뮤직뱅크",
    "date": "2026-03-13",
    "startTime": "17:05",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-13-02",
    "locationId": "venue-012",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (디어마이뮤즈 1차)",
    "date": "2026-03-13",
    "startTime": "20:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-14-01",
    "locationId": "venue-006",
    "eventFormat": "in-person",
    "title": "MBC 쇼! 음악중심",
    "date": "2026-03-14",
    "startTime": "15:20",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-15-01",
    "locationId": "venue-007",
    "eventFormat": "in-person",
    "title": "SBS 인기가요",
    "date": "2026-03-15",
    "startTime": "15:30",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-15-02",
    "locationId": "venue-013",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (제이제이뮤즈 1차)",
    "date": "2026-03-15",
    "startTime": "18:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-18-01",
    "locationId": "venue-010",
    "eventFormat": "in-person",
    "title": "MBC M 쇼! 챔피언",
    "date": "2026-03-18",
    "startTime": "17:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-19-01",
    "locationId": "venue-004",
    "eventFormat": "in-person",
    "title": "Mnet 엠카운트다운",
    "date": "2026-03-19",
    "startTime": "18:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-20-01",
    "locationId": "venue-005",
    "eventFormat": "in-person",
    "title": "KBS2 뮤직뱅크",
    "date": "2026-03-20",
    "startTime": "17:05",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-21-01",
    "locationId": "venue-006",
    "eventFormat": "in-person",
    "title": "MBC 쇼! 음악중심",
    "date": "2026-03-21",
    "startTime": "15:20",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-22-01",
    "locationId": "venue-007",
    "eventFormat": "in-person",
    "title": "SBS 인기가요",
    "date": "2026-03-22",
    "startTime": "15:20",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-22-02",
    "locationId": "venue-014",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (마이스타굿즈 1차)",
    "date": "2026-03-22",
    "startTime": "18:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-25-01",
    "locationId": "venue-010",
    "eventFormat": "in-person",
    "title": "MBC M 쇼! 챔피언",
    "date": "2026-03-25",
    "startTime": "17:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-27-01",
    "locationId": "venue-005",
    "eventFormat": "in-person",
    "title": "KBS2 뮤직뱅크",
    "date": "2026-03-27",
    "startTime": "17:05",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-27-02",
    "locationId": "venue-014",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (케이타운포유 1차)",
    "date": "2026-03-27",
    "startTime": "20:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-29-01",
    "locationId": "venue-007",
    "eventFormat": "in-person",
    "title": "SBS 인기가요",
    "date": "2026-03-29",
    "startTime": "15:15",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-29-02",
    "locationId": "venue-015",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (디어마이뮤즈 2차)",
    "date": "2026-03-29",
    "startTime": "18:30",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-03-31-01",
    "locationId": "venue-016",
    "eventFormat": "in-person",
    "title": "ENA 케이팝업 차트쇼",
    "date": "2026-03-31",
    "startTime": "17:40",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-03-01",
    "locationId": "venue-017",
    "eventFormat": "in-person",
    "title": "제 64회 경북도민체육대회",
    "date": "2026-04-03",
    "startTime": "16:30",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "good-for-u",
      "it-was-summer",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-04-05-01",
    "locationId": "venue-008",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (메이크스타 2차)",
    "date": "2026-04-05",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-09-01",
    "locationId": "venue-018",
    "eventFormat": "in-person",
    "title": "2026학년도 목원대학교 입춘제 [함께 이어, 봄]",
    "date": "2026-04-09",
    "startTime": "19:30",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "good-for-u",
      "it-was-summer",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-04-10-01",
    "locationId": "venue-019",
    "eventFormat": "in-person",
    "title": "arirang TV SIMPLY K-POP",
    "date": "2026-04-10",
    "startTime": "13:00",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-10-02",
    "locationId": "venue-020",
    "eventFormat": "in-person",
    "title": "<지금은 라디오시대> 봄맞이 공개방송 나왔다구YO!",
    "date": "2026-04-10",
    "startTime": "16:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "it-was-summer",
      "rose-between-buildings"
    ]
  },
  {
    "id": "schedule-2026-04-11-01",
    "locationId": "venue-021",
    "eventFormat": "in-person",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 상하이 대면 팬이벤트 (iminitv)",
    "date": "2026-04-11",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-04-17-01",
    "locationId": "venue-022",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (케이팝투게더 1차)",
    "date": "2026-04-17",
    "startTime": "20:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-18-01",
    "locationId": "venue-023",
    "eventFormat": "in-person",
    "title": "SBS 열혈농구단 전국 최강전 2경기",
    "date": "2026-04-18",
    "startTime": "15:00",
    "setlistStatus": "known",
    "setlist": [
      "it-was-summer"
    ]
  },
  {
    "id": "schedule-2026-04-19-01",
    "locationId": "venue-024",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (마이스타굿즈 2차)",
    "date": "2026-04-19",
    "startTime": "17:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-24-01",
    "locationId": "venue-025",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (에버라인 2차)",
    "date": "2026-04-24",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-25-01",
    "locationId": "venue-026",
    "eventFormat": "in-person",
    "title": "EBS 라디오 청소년소통프로젝트 경청 공개방송",
    "date": "2026-04-25",
    "startTime": "17:00",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "it-was-summer",
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-25-02",
    "locationId": "venue-027",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (디어마이뮤즈 3차)",
    "date": "2026-04-25",
    "startTime": "20:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-04-30-01",
    "locationId": "venue-028",
    "eventFormat": "in-person",
    "title": "2026년도 전북대학교 동아리 대축제 동인제",
    "date": "2026-04-30",
    "startTime": "18:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-02-01",
    "locationId": "venue-029",
    "eventFormat": "in-person",
    "title": "SBS 파워FM 황제성의 황제파워 공개방송 In 제65회 성웅 이순신축제",
    "date": "2026-05-02",
    "startTime": "19:30",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "it-was-summer",
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-05-03-01",
    "locationId": "venue-024",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (케이팝투게더 2차)",
    "date": "2026-05-03",
    "startTime": "16:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-05-04-01",
    "locationId": "venue-030",
    "eventFormat": "in-person",
    "title": "우송정보대학 우정 Culture Festival",
    "date": "2026-05-04",
    "startTime": "21:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-07-01",
    "locationId": "venue-031",
    "eventFormat": "in-person",
    "title": "포항공과대학교 2026 해맞이한마당",
    "date": "2026-05-07",
    "startTime": "22:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-08-01",
    "locationId": "venue-032",
    "eventFormat": "in-person",
    "title": "2026 유성온천 문화축제",
    "date": "2026-05-08",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-09-01",
    "locationId": "venue-033",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 카페&영상통화 팬사인회 (에버라인 3차)",
    "date": "2026-05-09",
    "startTime": "14:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-05-10-01",
    "locationId": "venue-034",
    "eventFormat": "in-person",
    "title": "제 68회 밀양아리랑대축제 [밀양시민 열린음악회]",
    "date": "2026-05-10",
    "startTime": "20:10",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-11-01",
    "locationId": "venue-035",
    "eventFormat": "in-person",
    "title": "예원예술대학교 만인동락제",
    "date": "2026-05-11",
    "startTime": "20:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "good-for-u",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-05-12-01",
    "locationId": "venue-036",
    "eventFormat": "in-person",
    "title": "KBS1 2026 FIFA 북중미 월드컵 D-30 기획 <승리를 위하여!>",
    "date": "2026-05-12",
    "startTime": "19:20",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings"
    ]
  },
  {
    "id": "schedule-2026-05-12-02",
    "locationId": "venue-037",
    "eventFormat": "in-person",
    "title": "2026 한세대학교 오순절 축제 '하리: 피어나리'",
    "date": "2026-05-12",
    "startTime": "21:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "good-for-u",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-05-13-01",
    "locationId": "venue-038",
    "eventFormat": "in-person",
    "title": "2026 가천 Water Festival : Dive into U",
    "date": "2026-05-13",
    "startTime": "17:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-13-02",
    "locationId": "venue-039",
    "eventFormat": "in-person",
    "title": "2026 DANFESTA 단국대학교 대동제 🎇 落花流水(낙화유수) ; 만 개 🎇",
    "date": "2026-05-13",
    "startTime": "17:00",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-14-01",
    "locationId": "venue-040",
    "eventFormat": "in-person",
    "title": "2026 대구대학교 대동제 여:흥",
    "date": "2026-05-14",
    "startTime": "19:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "world-is-not-like-a-movie",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-05-15-01",
    "locationId": "venue-041",
    "eventFormat": "in-person",
    "title": "2026년 숭실대학교 대동제 ‘청람:淸覽’",
    "date": "2026-05-15",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "romantic-overdose",
      "it-was-summer",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-05-16-01",
    "locationId": "venue-042",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (마이스타굿즈 3차)",
    "date": "2026-05-16",
    "startTime": "14:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-05-17-01",
    "locationId": "venue-043",
    "eventFormat": "in-person",
    "title": "하나은행 K리그2 2026 12R [성남FC vs 경남FC]",
    "date": "2026-05-17",
    "startTime": "16:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "it-was-summer"
    ]
  },
  {
    "id": "schedule-2026-05-19-01",
    "eventFormat": "online",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 영상통화 팬사인회 (imini tv)",
    "date": "2026-05-19",
    "startTime": "20:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-05-20-01",
    "locationId": "venue-044",
    "eventFormat": "in-person",
    "title": "2026학년도 제29회 위덕대학교 미르대동제",
    "date": "2026-05-20",
    "startTime": "19:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "it-was-summer",
      "romantic-overdose",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-05-21-01",
    "locationId": "venue-045",
    "eventFormat": "in-person",
    "title": "신안산대학교 2026 제32회 SAU FESTIVAL",
    "date": "2026-05-21",
    "startTime": "19:30",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-23-01",
    "locationId": "venue-046",
    "eventFormat": "in-person",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 광저우 대면 팬이벤트 (iminitv)_중국 마지막 이벤트",
    "date": "2026-05-23",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-05-26-01",
    "locationId": "venue-047",
    "eventFormat": "in-person",
    "title": "한국에너지공과대학교 2026 KENTECH Festival : Liberté",
    "date": "2026-05-26",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "it-was-summer",
      "romantic-overdose",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-05-27-01",
    "locationId": "venue-048",
    "eventFormat": "in-person",
    "title": "2026 차 의과학대학교 통합축제 “녹음을 녹음하다”",
    "date": "2026-05-27",
    "startTime": "21:00",
    "orderInDay": 2,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "it-was-summer",
      "romantic-overdose",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-05-27-02",
    "locationId": "venue-049",
    "eventFormat": "in-person",
    "title": "대진대학교 단과대학 연합 '작전명 청춘'",
    "date": "2026-05-27",
    "startTime": "21:00",
    "orderInDay": 1,
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "romantic-overdose",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-05-29-01",
    "locationId": "venue-027",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 포토&대면&영상통화 팬사인회 (디어마이뮤즈 4차)",
    "date": "2026-05-29",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-05-30-01",
    "locationId": "venue-008",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (메이크스타 3차)",
    "date": "2026-05-30",
    "startTime": "13:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-06-05-01",
    "locationId": "venue-050",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (제이제이뮤즈 2차)",
    "date": "2026-06-05",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-06-12-01",
    "locationId": "venue-051",
    "eventFormat": "in-person",
    "title": "제36회 한산모시문화제",
    "date": "2026-06-12",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "it-was-summer"
    ]
  },
  {
    "id": "schedule-2026-06-13-01",
    "locationId": "venue-027",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&포토&영상통화 팬사인회 (에버라인 4차)",
    "date": "2026-06-13",
    "startTime": "15:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-06-16-01",
    "eventFormat": "online",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 영상통화 팬사인회 (마이스타굿즈 4차)",
    "date": "2026-06-16",
    "startTime": "19:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-06-19-01",
    "eventFormat": "online",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 영상통화 팬사인회 (디어마이뮤즈 5차)",
    "date": "2026-06-19",
    "startTime": "19:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-06-28-01",
    "locationId": "venue-052",
    "eventFormat": "in-person",
    "title": "2026 H1-KEY 1st FANMEETING in Japan : THE FIRST KEY",
    "date": "2026-06-28",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose",
      "kawaii-dakeja-dame-desuka-cover",
      "rose-between-buildings"
    ]
  },
  {
    "id": "schedule-2026-07-05-01",
    "locationId": "venue-015",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&포토&영상통화 팬사인회 (에버라인 5차)",
    "date": "2026-07-05",
    "startTime": "13:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-07-08-01",
    "eventFormat": "online",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 영상통화 팬사인회 (마이스타굿즈 5차)",
    "date": "2026-07-08",
    "startTime": "19:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-07-18-01",
    "locationId": "venue-053",
    "eventFormat": "in-person",
    "title": "2026 YEOSU with MyK FESTA",
    "date": "2026-07-18",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-07-24-01",
    "locationId": "venue-008",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (메이크스타 4차)",
    "date": "2026-07-24",
    "startTime": "20:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-07-25-01",
    "locationId": "venue-054",
    "eventFormat": "in-person",
    "title": "제29회 보령머드축제 K-POP SUPER LIVE",
    "date": "2026-07-25",
    "startTime": "19:20",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "it-was-summer"
    ]
  },
  {
    "id": "schedule-2026-07-26-01",
    "locationId": "venue-055",
    "eventFormat": "in-person",
    "title": "워터밤 서울 2026",
    "date": "2026-07-26",
    "startTime": "13:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "lets-get-hot",
      "to-my-first-love",
      "shake-it-cover",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-07-31-01",
    "locationId": "venue-056",
    "eventFormat": "in-person",
    "title": "2026 정읍 물빛축제",
    "date": "2026-07-31",
    "startTime": "19:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "dont-let-the-light-go-out",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-08-01-01",
    "locationId": "venue-057",
    "eventFormat": "in-person",
    "title": "2026 양양 서머 페스티벌",
    "date": "2026-08-01",
    "startTime": "20:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "lets-get-hot",
      "to-my-first-love",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-08-08-01",
    "locationId": "venue-033",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&포토&영상통화 팬사인회 (에버라인 6차)",
    "date": "2026-08-08",
    "startTime": "13:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-08-10-01",
    "locationId": "venue-058",
    "eventFormat": "in-person",
    "title": "힘내YOU+ CONCERT in 광주",
    "date": "2026-08-10",
    "startTime": "15:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-08-25-01",
    "locationId": "venue-059",
    "eventFormat": "in-person",
    "title": "2026 KT 워터페스티벌",
    "date": "2026-08-25",
    "startTime": "18:30",
    "setlistStatus": "known",
    "setlist": [
      "it-was-summer"
    ]
  },
  {
    "id": "schedule-2026-08-27-01",
    "eventFormat": "online",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 영상통화 팬사인회 (마이스타굿즈 7차)",
    "date": "2026-08-27",
    "startTime": "19:00",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-08-29-01",
    "locationId": "venue-060",
    "eventFormat": "in-person",
    "title": "김구 탄생 150주년 광화문광장 국민참여 K-POP RANDOM PLAY DANCE",
    "date": "2026-08-29",
    "startTime": "14:00",
    "setlistStatus": "known",
    "setlist": [
      "seoul",
      "rose-between-buildings",
      "it-was-summer",
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-08-30-01",
    "locationId": "venue-015",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (에버라인 7차)",
    "date": "2026-08-30",
    "startTime": "13:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-09-01-01",
    "locationId": "venue-061",
    "eventFormat": "in-person",
    "title": "2027 S/S 서울패션위크 - 리이(RE RHEE)",
    "date": "2026-09-01",
    "startTime": "11:30",
    "setlistStatus": "none",
    "setlist": []
  },
  {
    "id": "schedule-2026-09-05-01",
    "locationId": "venue-062",
    "eventFormat": "in-person",
    "title": "무주 태권도원 2026 세계태권도 그랑프리 시리즈",
    "date": "2026-09-05",
    "startTime": "14:40",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-09-06-01",
    "locationId": "venue-008",
    "eventFormat": "hybrid",
    "title": "H1-KEY 5th Mini Album [LOVECHAPTER] 발매 기념 대면&영상통화 팬사인회 (메이크스타 5차) - 마지막 팬사인회",
    "date": "2026-09-06",
    "startTime": "13:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-09-09-01",
    "locationId": "venue-063",
    "eventFormat": "in-person",
    "title": "안동과학대학교 <2026 함백축제>",
    "date": "2026-09-09",
    "startTime": "20:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "lets-get-hot",
      "rose-between-buildings",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-09-10-01",
    "locationId": "venue-064",
    "eventFormat": "in-person",
    "title": "2026 서울대학교 공자농자첨 연합축제 BLUEPRINT",
    "date": "2026-09-10",
    "startTime": "20:20",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-09-11-01",
    "locationId": "venue-065",
    "eventFormat": "in-person",
    "title": "2026 제30회 무주반딧불축제",
    "date": "2026-09-11",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-09-14-01",
    "locationId": "venue-066",
    "eventFormat": "in-person",
    "title": "2026 국립경국대학교 예천캠퍼스 <솔개뜰 어울마당>",
    "date": "2026-09-14",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-09-17-01",
    "locationId": "venue-067",
    "eventFormat": "in-person",
    "title": "2026 포항대학교 「청야(清夜)」",
    "date": "2026-09-17",
    "startTime": "19:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-09-18-01",
    "locationId": "venue-068",
    "eventFormat": "in-person",
    "title": "2026 경기대학교 서울캠퍼스 귀룡제 ₊˚.Deja Vu｡･",
    "date": "2026-09-18",
    "startTime": "20:10",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "heart-light"
    ]
  },
  {
    "id": "schedule-2026-09-19-01",
    "locationId": "venue-069",
    "eventFormat": "in-person",
    "title": "2026 청춘커피 페스티벌",
    "date": "2026-09-19",
    "startTime": "16:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-09-22-01",
    "locationId": "venue-070",
    "eventFormat": "in-person",
    "title": "2026 전주대학교 연합축제 『영원할 순간, 낭만을 품다』",
    "date": "2026-09-22",
    "startTime": "22:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-09-28-01",
    "locationId": "venue-071",
    "eventFormat": "in-person",
    "title": "2026 충남대학교 Engineering Fair",
    "date": "2026-09-28",
    "startTime": "20:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "dont-let-the-light-go-out",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-09-30-01",
    "locationId": "venue-072",
    "eventFormat": "in-person",
    "title": "2026 두원공과대학교 천마대동제",
    "date": "2026-09-30",
    "startTime": "18:10",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "to-my-first-love",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-10-01-01",
    "locationId": "venue-073",
    "eventFormat": "in-person",
    "title": "2026 충북대학교 개신대동제 Everis",
    "date": "2026-10-01",
    "startTime": "20:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-10-02-01",
    "locationId": "venue-074",
    "eventFormat": "in-person",
    "title": "2026 군산시간여행축제 시간여행콘서트",
    "date": "2026-10-02",
    "startTime": "21:00",
    "setlistStatus": "known",
    "setlist": [
      "rose-between-buildings",
      "it-was-summer",
      "good-for-u",
      "heart-light",
      "to-my-first-love"
    ]
  },
  {
    "id": "schedule-2026-10-03-01",
    "locationId": "venue-075",
    "eventFormat": "in-person",
    "title": "2026 거창한마당대축제",
    "date": "2026-10-03",
    "startTime": "19:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "dont-let-the-light-go-out",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-10-10-01",
    "locationId": "venue-076",
    "eventFormat": "in-person",
    "title": "전국우수시장박람회",
    "date": "2026-10-10",
    "startTime": "17:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "world-is-not-like-a-movie",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-10-11-01",
    "locationId": "venue-077",
    "eventFormat": "in-person",
    "title": "제24회 포천시민의 날",
    "date": "2026-10-11",
    "startTime": "19:15",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "world-is-not-like-a-movie",
      "it-was-summer",
      "good-for-u"
    ]
  },
  {
    "id": "schedule-2026-10-16-01",
    "locationId": "venue-079",
    "eventFormat": "in-person",
    "title": "LEAGUE OF ART Season 3",
    "date": "2026-10-16",
    "startTime": "18:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-10-17-01",
    "eventFormat": "in-person",
    "title": "2026 스포츠 가치데이 페스티벌",
    "date": "2026-10-17",
    "startTime": "17:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "it-was-summer",
      "good-for-u",
      "world-is-not-like-a-movie"
    ]
  },
  {
    "id": "schedule-2026-10-18-01",
    "locationId": "venue-080",
    "eventFormat": "in-person",
    "title": "2026 헬로 DDC 페스티벌",
    "date": "2026-10-18",
    "startTime": "14:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "it-was-summer",
      "good-for-u",
      "world-is-not-like-a-movie"
    ]
  },
  {
    "id": "schedule-2026-10-23-01",
    "locationId": "venue-081",
    "eventFormat": "in-person",
    "title": "2026 강릉 its 세계총회 개최기념 콘서트 K-뮤직콘서트",
    "date": "2026-10-23",
    "startTime": "18:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "romantic-overdose",
      "it-was-summer"
    ]
  },
  {
    "id": "schedule-2026-10-27-01",
    "locationId": "venue-082",
    "eventFormat": "in-person",
    "title": "2026 유원대학교 눈어치 한마당",
    "date": "2026-10-27",
    "startTime": "18:30",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "lets-get-hot",
      "it-was-summer",
      "romantic-overdose"
    ]
  },
  {
    "id": "schedule-2026-10-28-01",
    "locationId": "venue-083",
    "eventFormat": "in-person",
    "title": "2026 신라대학교 대동제",
    "date": "2026-10-28",
    "startTime": "20:00",
    "setlistStatus": "known",
    "setlist": [
      "to-my-first-love",
      "rose-between-buildings",
      "it-was-summer",
      "good-for-u",
      "world-is-not-like-a-movie"
    ]
  }
]

// X 게시물 본문에 적힌 날짜 코드(YYMMDD)와 일치하는 링크입니다.
// 같은 날짜에 여러 일정이 있으면 아래 일정별 분류를 우선 적용합니다.
const xPostIdsByDate: Record<string, string[]> = {
  '2026-10-11': ['2109412264730333248', '2109410649315152263', '2109410426585051481', '2109313336475324542', '2109310755539689776'],
  '2026-10-10': ['2108885429089186018', '2108884154620538897', '2108882962146291792', '2108881548984623137', '2108861094332899388', '2108861082999669053'],
  '2026-10-03': ['2106399857082761302', '2106399379242549523', '2106398657541234893', '2106397997169062083', '2106389285884899803', '2106389155374641325'],
  '2026-10-02': ['2106072537717416116', '2106070932725125440', '2106068419791720573', '2106067619564622270', '2106022388471386248', '2106022366967116113'],
  '2026-10-01': ['2105644565646749816', '2105642147215286679'],
  '2026-09-30': ['2105295003425865912', '2105294610377674814', '2105288597532533218'],
  '2026-09-28': ['2104601945663217902', '2104600279702438021'],
  '2026-09-22': ['2102407705877250232'],
  '2026-09-19': ['2101296267335025094', '2101290901008261540', '2101286811003998333', '2101279079802753078', '2101232361887432848'],
  '2026-09-18': ['2100960543142240447', '2100928669263028250'],
  '2026-09-17': ['2100560653627089373', '2100559445994672289'],
  '2026-09-14': ['2099648883010007078', '2099516365279473864', '2099512420721185030'],
  '2026-09-11': ['2098448926794027113', '2098443831146656147'],
  '2026-09-10': ['2098242943807279333', '2098029124355006772'],
  '2026-09-09': ['2097888709354098951', '2097885686187933987', '2097717815654654424'],
  '2026-09-06': ['2096533572140355798'],
  '2026-09-05': ['2096160438685978658', '2096153377709433127', '2096123772919288124'],
  '2026-09-01': ['2094694071990362379', '2094648653571059739'],
  '2026-08-30': ['2094024024229646503', '2094023883817136212', '2094023599338504504', '2094022275691634986', '2093971973005246506'],
  '2026-08-29': ['2093642158050058345', '2093634829401403531'],
  '2026-08-25': ['2092266581808341317', '2092266555598131488', '2092256918509347208'],
  '2026-08-10': ['2086763038338887694', '2086761891666534859', '2086760946748572026'],
  '2026-08-08': ['2086006446853062872', '2086006049476321633'],
  '2026-08-01': ['2083917467601276960', '2083911334572527876'],
  '2026-07-31': ['2083462168889168007', '2083444431861264687', '2083258038111334692'],
  '2026-07-18': ['2079049202236375167', '2078479374014386216'],
  '2026-06-28': ['2075015923363406282', '2074368776712417594', '2073617525288677755', '2071289258636415126', '2071288395398320165', '2071288386376331401', '2071288307879952536', '2071288244982219210', '2071283838781886504', '2071154162335912126', '2071146821075038250'],
  '2026-07-05': ['2073727530390196368', '2073727487511785480', '2073727246687449597', '2073660168425165083', '2073660027995668665'],
  '2026-06-13': ['2065825447410339984', '2065825393027039525', '2065724293045260325'],
  '2026-05-30': ['2060626937480187999', '2060626885068075335', '2060626675671634032', '2060626597296959583'],
  '2026-05-29': ['2060483108882002006', '2060483327724024252'],
  '2026-05-27': ['2059662478557286908', '2059662461037613477'],
  '2026-05-26': ['2059267300818370782', '2059261341337358391'],
  '2026-05-23': ['2058381957797700039', '2058159942100791477', '2058159830024827342', '2058072027966382175', '2058065100020625517', '2058030626176143798'],
  '2026-05-21': ['2057462085077078412'],
  '2026-05-17': ['2055982424581185629', '2055982306482110944', '2055982203050598755'],
  '2026-05-16': ['2055625831033278711', '2055625696299610601', '2055625637319389543', '2055625401473618146', '2055625339582533658'],
  '2026-05-14': ['2054943794148294852', '2054943744345190490'],
  '2026-05-13': ['2054823758008029535', '2054546188205269262', '2054546147243692243', '2054546077135912963'],
  '2026-05-12': ['2054233298424230205', '2054216428291871053', '2054214508428841442'],
  '2026-05-11': ['2053849995313598943', '2053843637944160545'],
  '2026-05-10': ['2053500706871820402', '2053483430302900613', '2053470173051724092'],
  '2026-05-09': ['2053035118009442734', '2053035063454154974', '2053034958747517432'],
  '2026-05-08': ['2052778347151892779'],
  '2026-05-07': ['2052436300230480067'],
  '2026-05-04': ['2051640813734793514', '2051306797944942620'],
  '2026-05-03': ['2050899624978993233', '2050899452064653788', '2050891178611192296'],
  '2026-05-02': ['2050583275228532854'],
  '2026-04-30': ['2049938820016279792'],
  '2026-04-25': ['2048086912301457869', '2048086765676929225', '2048083838220603879', '2048082770484949287', '2048081552639512956'],
  '2026-04-24': ['2047677314482557062', '2047666338978820425', '2047666028050792642', '2047665918915092917', '2047664143873015909'],
  '2026-04-19': ['2046061859665822061', '2046060769876623524', '2046060139653062989', '2045829456191984098'],
  '2026-04-18': ['2045427474843271352', '2045425704016421313', '2045326913158447211', '2045325512952934416'],
  '2026-04-17': ['2045147341750247534', '2045143689350238373', '2045142524348829777'],
  '2026-04-11': ['2042972972840030237', '2042970672213954890', '2042953837582127206', '2042953671869370680', '2042950966237106231', '2043336867534553421'],
  '2026-04-10': ['2042521470493167737', '2042521359931314450'],
  '2026-04-05': ['2040790304304083142', '2040789917195002326', '2040789683186356666', '2040789467519431133', '2040789405422727209'],
  '2026-03-29': ['2038294561370603648', '2038262107616284864', '2038261885381009894', '2038260913015583089'],
  '2026-03-20': ['2034936428736782656'],
  '2026-03-07': ['2030450735490756824'],
  '2026-03-06': ['2029920662287225278', '2030451518344986825'],
  '2026-02-27': ['2027314740188594409'],
  '2026-02-26': ['2026987029167485210'],
  '2026-03-22': ['2035704544550879331', '2035704544383107262', '2035704443082293409'],
  '2026-03-15': ['2033154605237043662'],
  '2026-03-13': ['2032517629072793843'],
  '2026-03-11': ['2031757625504002085'],
  '2026-03-08': ['2030632525794857176', '2030632441124475367'],
}

// 사용자가 확인한 동일 날짜 게시물의 행사별 연결입니다.
// 3/27 게시물의 본문 날짜 오기는 사용자가 3/27 행사로 정정해 이 일정에 연결합니다.
const xPostIdsByScheduleId: Record<string, string[]> = {
  'schedule-2026-03-27-02': ['2037546768620310879', '2038075462715662538', '2037450113761878458'],
  'schedule-2026-03-08-02': ['2030632525794857176', '2030632441124475367', '2030621660672606544', '2030621828612518171'],
  'schedule-2026-03-11-02': ['2031757625504002085'],
  'schedule-2026-03-13-02': ['2032517629072793843'],
  'schedule-2026-03-15-02': ['2033154605237043662'],
  'schedule-2026-03-22-02': ['2035704544550879331', '2035704544383107262', '2035704443082293409'],
  'schedule-2026-03-29-02': ['2038294561370603648', '2038262107616284864', '2038261885381009894', '2038260913015583089', '2039879193358692811', '2038494882671866078', '2038489028291711425', '2038268459910623690'],
  'schedule-2026-04-10-02': ['2042521470493167737', '2042521359931314450'],
  'schedule-2026-04-25-02': ['2048086912301457869', '2048086765676929225', '2048083838220603879', '2048082770484949287', '2048081552639512956'],
  'schedule-2026-05-12-01': ['2054214508428841442'],
  'schedule-2026-05-12-02': ['2054233298424230205', '2054216428291871053'],
  'schedule-2026-05-13-01': ['2054546188205269262'],
  'schedule-2026-05-13-02': ['2054823758008029535', '2054546147243692243', '2054546077135912963'],
  'schedule-2026-05-27-01': ['2059662478557286908'],
  'schedule-2026-05-27-02': ['2059662461037613477'],
}
const classifiedMultiScheduleDates = new Set([
  '2026-03-08', '2026-03-11', '2026-03-13', '2026-03-15', '2026-03-22',
  '2026-03-27', '2026-03-29', '2026-04-10', '2026-04-25', '2026-05-12',
  '2026-05-13', '2026-05-27',
])

const attachedXPostDates = new Set<string>()
for (const schedule of schedules) {
  const officialMedia = officialScheduleMediaByScheduleId[schedule.id]
  if (officialMedia) {
    schedule.media = { ...schedule.media, ...officialMedia }
  }
  const isClassifiedDate = classifiedMultiScheduleDates.has(schedule.date)
  const ids = xPostIdsByScheduleId[schedule.id] ?? (
    isClassifiedDate || attachedXPostDates.has(schedule.date)
      ? []
      : xPostIdsByDate[schedule.date] ?? []
  )
  const photoGroup = photoPostsByScheduleId[schedule.id]
  const photoPostIds = new Set(photoGroup?.sourcePostIds ?? [])
  const remainingPostIds = ids.filter((id) => !photoPostIds.has(id))
  if (photoGroup && photoGroup.sourcePostIds.some((id) => !ids.includes(id))) {
    throw new Error(schedule.id + ': 사진 원본 게시물이 해당 일정 게시물 목록에 없습니다.')
  }
  if (remainingPostIds.length || photoGroup?.urls.length) {
    schedule.media = {
      ...schedule.media,
      ...(remainingPostIds.length ? { xPosts: remainingPostIds.map((id) => `https://x.com/hessxl_/status/${id}`) } : {}),
      ...(photoGroup?.urls.length ? { photos: photoGroup.urls } : {}),
    }
  }
  if (!isClassifiedDate) attachedXPostDates.add(schedule.date)
}
const scheduleIds = new Set(schedules.map((schedule) => schedule.id))
for (const scheduleId of Object.keys(officialScheduleMediaByScheduleId)) {
  if (!scheduleIds.has(scheduleId)) {
    throw new Error(scheduleId + ': 공식 미디어가 존재하지 않는 일정 ID를 참조합니다.')
  }
}
// 새 데이터를 추가할 때 잘못된 ID 연결과 같은 날짜의 순서 중복을 발견합니다.
for (const [name, entries] of [
  ['Location', locations],
  ['Song', songs],
  ['Schedule', schedules],
] as const) {
  const ids = entries.map((entry) => entry.id)
  if (new Set(ids).size !== ids.length) throw new Error(name + ' ID가 중복되었습니다.')
}
const locationIds = new Set(locations.map((location) => location.id))
const songIds = new Set(songs.map((song) => song.id))
const dayOrders = new Set<string>()
for (const schedule of schedules) {
  if (schedule.locationId && !locationIds.has(schedule.locationId)) {
    throw new Error(schedule.id + ': 존재하지 않는 locationId')
  }
  if (schedule.eventFormat === 'online' && schedule.locationId) {
    throw new Error(schedule.id + ': 온라인 일정에는 장소를 연결할 수 없습니다.')
  }
  for (const songId of schedule.setlist) {
    if (!songIds.has(songId)) throw new Error(schedule.id + ': 존재하지 않는 songId (' + songId + ')')
  }
  if (schedule.orderInDay !== undefined) {
    const key = schedule.date + ':' + schedule.orderInDay
    if (!Number.isInteger(schedule.orderInDay) || schedule.orderInDay < 1 || dayOrders.has(key)) {
      throw new Error(schedule.id + ': 같은 날짜의 행사 순서가 잘못되었거나 중복되었습니다.')
    }
    dayOrders.add(key)
  }
}
