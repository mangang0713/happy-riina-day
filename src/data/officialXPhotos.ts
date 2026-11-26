/**
 * 공식 X의 '짱이키'·'#리이나' 사진 중 기존 일정에 연결한 자료입니다.
 * 행사 날짜가 있는 게시물은 게시일과 구분하고, 복수 일정은 확인한 ID를 명시합니다.
 * 새 자료는 본문·사진을 확인한 뒤 추가하며 미확인 항목은 docs/official-x-photo-audit.json에 둡니다.
 */

import type { Schedule } from '../types/archive';

/** 한 공식 게시물에서 확인한 사진, 분류와 연결 대상 일정입니다. */
type OfficialXPhotoPost = {
  scheduleIds: Schedule['id'][];
  category: 'group' | 'individual';
  sourceUrl: string; // 주소 변경·삭제 시 다시 확인할 원본 게시물
  photoUrls: string[]; // 로그인 정보 없이 열리는 것을 확인한 이미지 주소
  note: string; // 날짜·행사 연결 근거와 당일 공통 자료 여부
};

/** 기록한 연결 근거와 일정 ID를 사용해 공식 사진 탭을 구성하는 원본 목록입니다. */
export const officialXPhotoPosts: OfficialXPhotoPost[] = [
  {
    scheduleIds: ['schedule-2026-02-26-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2026925406146932810',
    photoUrls: [
      'https://pbs.twimg.com/media/HCEV6VGbIAEyFdY?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCEV6VBaMAAZaFd?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-02-26-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2026935988065632739',
    photoUrls: [
      'https://pbs.twimg.com/media/HCEfiQ_boAAbslT?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCEfiQ-aMAE6QgR?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCEfiRAaMAQCWMq?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCEfiRAaoAAI02P?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-02-27-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2027292623023575338',
    photoUrls: [
      'https://pbs.twimg.com/media/HCJahOra0AA07tA?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCJahOsbcAAGmm8?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-02-27-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2027338030076567650',
    photoUrls: [
      'https://pbs.twimg.com/media/HCKNL9JaYAEtxJ1?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCKNL9LbkAAanVG?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-05-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2029516019614818693',
    photoUrls: [
      'https://pbs.twimg.com/media/HCpH3rGaUAAr_ov?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-05-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2029541185199722539',
    photoUrls: [
      'https://pbs.twimg.com/media/HCpflWxbkAAn9ua?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCpflWyaEAEKx9U?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-06-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2029882185151291807',
    photoUrls: [
      'https://pbs.twimg.com/media/HCuVgTracAE0dH7?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCuVgTmaUAA4Adi?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCuVgTpaUAQq2Wl?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCuVgTobgAA04_Q?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-07-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2030196754759790935',
    photoUrls: [
      'https://pbs.twimg.com/media/HCy0m74aUAEdO9v?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCy0m73aoAAd6Bu?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCy0m75aUAABWtL?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-07-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2030211854518149557',
    photoUrls: [
      'https://pbs.twimg.com/media/HCy9caoaUAA-gdk?format=jpg&name=large',
      'https://pbs.twimg.com/media/HCy9casasAAyTh_?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-08-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2030561662307332244',
    photoUrls: [
      'https://pbs.twimg.com/media/HC39-KtbYAAr6ur?format=jpg&name=large',
      'https://pbs.twimg.com/media/HC39-KragAA7ZNn?format=jpg&name=large',
      'https://pbs.twimg.com/media/HC39-KtbkAAFpmN?format=jpg&name=large',
    ],
    note: '동일 날짜의 복수 일정 중 본문에 명시된 행사로 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-08-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2030581791774646384',
    photoUrls: [
      'https://pbs.twimg.com/media/HC4S1i2aAAA2aMX?format=jpg&name=large',
      'https://pbs.twimg.com/media/HC4S1i1a8AAnCtZ?format=jpg&name=large',
      'https://pbs.twimg.com/media/HC4S1iwacAEWt6F?format=jpg&name=large',
    ],
    note: '동일 날짜의 복수 일정 중 본문에 명시된 행사로 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-10-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2031384581753233445',
    photoUrls: [
      'https://pbs.twimg.com/media/HDDsE-qbwAA8m5m?format=jpg&name=large',
    ],
    note: '원본은 정오의 희망곡·EBS 경청 두 방송의 공통 단체사진 게시물. 등록된 EBS 경청에 공통 자료로 연결하며 다른 방송 일정을 추가하지 않음',
  },
  {
    scheduleIds: ['schedule-2026-03-11-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2031686796938186789',
    photoUrls: [
      'https://pbs.twimg.com/media/HDIAXznakAA_b30?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDIAXzgaEAAyo4b?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDIAXzkbsAAQPWs?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDIAXznbMAA-wbR?format=jpg&name=large',
    ],
    note: '사진 1의 SHOW CHAMPION 대기실 표지를 확인했고, 사용자가 다른 의상의 사진 3·4번을 포함한 전체 사진이 쇼챔피언 자료임을 확인함',
  },
  {
    scheduleIds: ['schedule-2026-03-12-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2032054083868377222',
    photoUrls: [
      'https://pbs.twimg.com/media/HDNOan-bsAA___2?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDNOan_bMAAB4_3?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-12-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2032069196327370819',
    photoUrls: [
      'https://pbs.twimg.com/media/HDNcKFuakAA31KB?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDNcKFsbMAA6fbx?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDNcKFwbQAQg8J8?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-13-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2032402253584507016',
    photoUrls: [
      'https://pbs.twimg.com/media/HDSKa_ha8AATtXI?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDSKa_iaQAAMaWH?format=jpg&name=large',
    ],
    note: '동일 날짜의 복수 일정 중 본문에 명시된 행사로 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-13-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2032441757942849996',
    photoUrls: [
      'https://pbs.twimg.com/media/HDSvAK3bwAAhRWQ?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDSvAK4b0AAbNmq?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDSvAKvbcAAVktU?format=jpg&name=large',
    ],
    note: '260313 뮤직뱅크 단체 원문과 치어리더 의상 및 계단·난간·창문 배경을 대조해 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-14-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2032735987046953326',
    photoUrls: [
      'https://pbs.twimg.com/media/HDW3M63bEAAIKYk?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-14-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2032742293615386768',
    photoUrls: [
      'https://pbs.twimg.com/media/HDXAVzyaMAcp7jQ?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDXAVz2aMAEnstk?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-15-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2033153739222364207',
    photoUrls: [
      'https://pbs.twimg.com/media/HDc1IxtaUAA7Dys?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDc1IqibwAAF_x4?format=jpg&name=large',
    ],
    note: '사용자가 당일 인기가요 사진임을 확인함',
  },
  {
    scheduleIds: ['schedule-2026-03-18-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2034217048788828344',
    photoUrls: [
      'https://pbs.twimg.com/media/HDr9nxKbwAAkFbs?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDr9nxLacAAmOXD?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-19-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2034583679146848465',
    photoUrls: [
      'https://pbs.twimg.com/media/HDxLEcma4AA8T5m?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-19-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2034590707814724050',
    photoUrls: [
      'https://pbs.twimg.com/media/HDxNt4_bQAAfKLW?format=jpg&name=large',
      'https://pbs.twimg.com/media/HDxNt4_aMAAifOn?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-20-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2034928312649441545',
    photoUrls: [
      'https://pbs.twimg.com/media/HD2EgvtboAELzRU?format=jpg&name=large',
      'https://pbs.twimg.com/media/HD2EgvlboAAIeOg?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-20-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2034950579022102562',
    photoUrls: [
      'https://pbs.twimg.com/media/HD2VJEsboAYZtFp?format=jpg&name=large',
      'https://pbs.twimg.com/media/HD2VJLqboAIjFwm?format=jpg&name=large',
      'https://pbs.twimg.com/media/HD2VJL5a4AAjPUQ?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-21-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2035267668425445487',
    photoUrls: [
      'https://pbs.twimg.com/media/HD62FT6boAA4Pw0?format=jpg&name=large',
      'https://pbs.twimg.com/media/HD62FTya8AAAbiA?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-21-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2035333103967723814',
    photoUrls: [
      'https://pbs.twimg.com/media/HD7xxQ5bEAAeTk_?format=jpg&name=large',
      'https://pbs.twimg.com/media/HD7xxQrboAASy5p?format=jpg&name=large',
      'https://pbs.twimg.com/media/HD7xxQta0AA9gU1?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-22-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2035630056014585865',
    photoUrls: [
      'https://pbs.twimg.com/media/HEACZNGagAADqcB?format=jpg&name=large',
      'https://pbs.twimg.com/media/HEACZM-bYAAw1Ah?format=jpg&name=large',
    ],
    note: '동일 날짜의 복수 일정 중 본문에 명시된 행사로 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-22-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2035678017016697170',
    photoUrls: [
      'https://pbs.twimg.com/media/HEAuXCybMAAYyOM?format=jpg&name=large',
      'https://pbs.twimg.com/media/HEAuXCuaQAAGEj7?format=jpg&name=large',
    ],
    note: '사용자가 당일 인기가요 사진임을 확인함',
  },
  {
    scheduleIds: ['schedule-2026-03-25-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2036760016548430038',
    photoUrls: [
      'https://pbs.twimg.com/media/HEQFTMsbAAEaWlT?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-03-25-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2036768975653408981',
    photoUrls: [
      'https://pbs.twimg.com/media/HEQOlYLboAAWw2Z?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-27-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2037463386712428745',
    photoUrls: [
      'https://pbs.twimg.com/media/HEaF0_ZbsAA0SN5?format=jpg&name=large',
      'https://pbs.twimg.com/media/HEaF0_TasAAyWyT?format=jpg&name=large',
    ],
    note: '동일 날짜의 복수 일정 중 본문에 명시된 행사로 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-27-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2037538884142195154',
    photoUrls: [
      'https://pbs.twimg.com/media/HEbIl5BasAAaCxi?format=jpg&name=large',
      'https://pbs.twimg.com/media/HEbIl46bIAAkiN8?format=jpg&name=large',
    ],
    note: '260327 뮤직뱅크 단체 원문과 물방울 무늬 의상 및 계단·난간 배경을 대조해 연결',
  },
  {
    scheduleIds: ['schedule-2026-03-29-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2038224920937992303',
    photoUrls: [
      'https://pbs.twimg.com/media/HEk6wcxboAAviF5?format=jpg&name=large',
      'https://pbs.twimg.com/media/HEk6wc2aEAA6OlJ?format=jpg&name=large',
    ],
    note: '사용자가 당일 인기가요 사진임을 확인함',
  },
  {
    scheduleIds: ['schedule-2026-03-31-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2038926779511877725',
    photoUrls: [
      'https://pbs.twimg.com/media/HEuG3ulaIAA6Lcp?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-04-03-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2040033042803351753',
    photoUrls: [
      'https://pbs.twimg.com/media/HE-nPR2a4AE6CGe?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-04-03-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2040048302167892434',
    photoUrls: [
      'https://pbs.twimg.com/media/HE-1HYgbgAAjzqo?format=jpg&name=large',
      'https://pbs.twimg.com/media/HE-1HYYawAAbHYf?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-04-09-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2042217611061260611',
    photoUrls: [
      'https://pbs.twimg.com/media/HFdqF15bUAAOO8k?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-04-09-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2042220985680884012',
    photoUrls: [
      'https://pbs.twimg.com/media/HFdryg_a0AA3Df-?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-04-10-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2042477676745703428',
    photoUrls: [
      'https://pbs.twimg.com/media/HFhWNkCbIAA8cbl?format=jpg&name=large',
    ],
    note: '게시물의 행사명과 등록 일정 대조',
  },
  {
    scheduleIds: ['schedule-2026-04-10-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2044741380568912319',
    photoUrls: [
      'https://pbs.twimg.com/media/HGBhcDRaMAA3NMz?format=jpg&name=large',
      'https://pbs.twimg.com/media/HGBhcDubYAAARTp?format=jpg&name=large',
      'https://pbs.twimg.com/media/HGBhcDKa0AAjvpv?format=jpg&name=large',
      'https://pbs.twimg.com/media/HGBhcDLaQAA84W5?format=jpg&name=large',
    ],
    note: '사용자가 4월 16일 업로드된 과거 심플리 사진의 실제 행사일이 4월 10일임을 확인함',
  },
  {
    scheduleIds: ['schedule-2026-04-10-02'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2042512920605757775',
    photoUrls: [
      'https://pbs.twimg.com/media/HFhzfxmakAABh7q?format=jpg&name=large',
    ],
    note: '게시물의 행사명과 등록 일정 대조',
  },
  {
    scheduleIds: ['schedule-2026-04-10-02'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2042540591238779108',
    photoUrls: [
      'https://pbs.twimg.com/media/HFiOC_aakAEwxQE?format=jpg&name=large',
      'https://pbs.twimg.com/media/HFiOC_dakAEd7G2?format=jpg&name=large',
      'https://pbs.twimg.com/media/HFiOC_XakAMUgSQ?format=jpg&name=large',
    ],
    note: '사용자가 당일 지금은 라디오시대 봄맞이 공개방송 사진임을 확인함',
  },
  {
    scheduleIds: ['schedule-2026-04-11-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2042959624341721585',
    photoUrls: [
      'https://pbs.twimg.com/media/HFoM8jIakAU6Rz9?format=jpg&name=large',
      'https://pbs.twimg.com/media/HFoM8jEakAALhMZ?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-04-19-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2045823525458759880',
    photoUrls: [
      'https://pbs.twimg.com/media/HGQ5pk4bgAAS6a3?format=jpg&name=large',
      'https://pbs.twimg.com/media/HGQ5pk0bEAAQ0NV?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-04-25-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2050095534564864397',
    photoUrls: [
      'https://pbs.twimg.com/media/HHNnBWWaIAA1j2u?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHNnBWVaQAAdzEs?format=jpg&name=large',
    ],
    note: '본문의 260430 표기와 달리 사용자가 4월 25일 경청 공개방송 사진임을 확인함',
  },
  {
    scheduleIds: ['schedule-2026-04-30-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2049851268269564040',
    photoUrls: [
      'https://pbs.twimg.com/media/HHKG9k-bgAE77lv?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHKG9k5bcAALJy7?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-04-30-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2049856442119913593',
    photoUrls: [
      'https://pbs.twimg.com/media/HHKNkVua0AA_ljV?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHKNkWzagAAQbqs?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-04-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2051285719126020436',
    photoUrls: [
      'https://pbs.twimg.com/media/HHegKWZbEAAgOVX?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHegKWaaUAEacWQ?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-04-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2051289490728067377',
    photoUrls: [
      'https://pbs.twimg.com/media/HHeiV7WaIAAkXDK?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHeiV7VbsAEwcOH?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-07-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2052391753517289682',
    photoUrls: [
      'https://pbs.twimg.com/media/HHuPLQHaUAAtTu0?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-07-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2052395531385602404',
    photoUrls: [
      'https://pbs.twimg.com/media/HHuQ9h0boAAsJZT?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHuQ9h0bwAAZWn7?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-08-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2052710187992310159',
    photoUrls: [
      'https://pbs.twimg.com/media/HHyxCMmbwAAdlvC?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHyxCMlakAATcE2?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-08-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2052726459215847594',
    photoUrls: [
      'https://pbs.twimg.com/media/HHy-8lxasAE9tYb?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHy-8l3akAEDyFp?format=jpg&name=large',
      'https://pbs.twimg.com/media/HHy-8l2asAEDa_y?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-09-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2053054872581181499',
    photoUrls: [
      'https://pbs.twimg.com/media/HH3pnOHaQAEiTv4?format=jpg&name=large',
      'https://pbs.twimg.com/media/HH3pnPtbgAAm9iX?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-10-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2053453798975426789',
    photoUrls: [
      'https://pbs.twimg.com/media/HH9VV99aIAA3h6L?format=jpg&name=large',
      'https://pbs.twimg.com/media/HH9VV-CbYAAQWnZ?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-11-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2053825032238125499',
    photoUrls: [
      'https://pbs.twimg.com/media/HICm-qPbEAAi7ZL?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-11-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2053827463571239350',
    photoUrls: [
      'https://pbs.twimg.com/media/HICocWSbwAAA9SY?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-12-01', 'schedule-2026-05-12-02'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2054184976711852376',
    photoUrls: [
      'https://pbs.twimg.com/media/HIHuWGyaUAAGAvz?format=jpg&name=large',
    ],
    note: '본문에 당일 두 행사가 함께 적힌 공통 게시물. 행사별 사진 순서는 추측하지 않음',
  },
  {
    scheduleIds: ['schedule-2026-05-12-01', 'schedule-2026-05-12-02'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2054191109593821645',
    photoUrls: [
      'https://pbs.twimg.com/media/HIHup4GbkAAFwAm?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIHup4EawAAkRg_?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIHup4FaQAA5u3P?format=jpg&name=large',
    ],
    note: '2026-11-26 원문 전체 본문 재확인. 당일 두 행사를 함께 언급한 공식 개인 게시물',
  },
  {
    scheduleIds: ['schedule-2026-05-13-01', 'schedule-2026-05-13-02'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2054514607910527270',
    photoUrls: [
      'https://pbs.twimg.com/media/HIMaJCqbwAABkG3?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIMaJCXacAAuU44?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIMaJCWbkAAWejJ?format=jpg&name=large',
    ],
    note: '본문에 당일 두 행사가 함께 적힌 공통 게시물. 행사별 사진 순서는 추측하지 않음',
  },
  {
    scheduleIds: ['schedule-2026-05-13-01', 'schedule-2026-05-13-02'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2054519525035401363',
    photoUrls: [
      'https://pbs.twimg.com/media/HIMeH87bYAAnNQx?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIMeH86bAAA7Z4g?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIMeH9KbAAALI_9?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIMeH9MaIAAgUvp?format=jpg&name=large',
    ],
    note: '2026-11-26 원문 전체 본문 재확인. 당일 두 행사를 함께 언급한 공식 개인 게시물',
  },
  {
    scheduleIds: ['schedule-2026-05-14-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2054904561010176065',
    photoUrls: [
      'https://pbs.twimg.com/media/HIR7GTBaEAAifpm?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-14-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2054913368717238376',
    photoUrls: [
      'https://pbs.twimg.com/media/HISD84aaUAAMfzZ?format=jpg&name=large',
      'https://pbs.twimg.com/media/HISD84OboAAokf2?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-15-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2055266948934451346',
    photoUrls: [
      'https://pbs.twimg.com/media/HIXGK2ibUAARHuu?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-15-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2055271992727671193',
    photoUrls: [
      'https://pbs.twimg.com/media/HIXHihvaEAA1mjw?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIXHih2bkAEc4Jk?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-16-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2055558873952522412',
    photoUrls: [
      'https://pbs.twimg.com/media/HIbPiVIakAAoxPc?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIbPiVIaEAEB_sJ?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-17-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2055955427238760514',
    photoUrls: [
      'https://pbs.twimg.com/media/HIg4j3ybsAAog_C?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-17-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2055964041890181272',
    photoUrls: [
      'https://pbs.twimg.com/media/HIg-bLWa4AArfzi?format=jpg&name=large',
      'https://pbs.twimg.com/media/HIg-bLhawAAutW9?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-20-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2057068829591957839',
    photoUrls: [
      'https://pbs.twimg.com/media/HIwrhCkawAAbq2t?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-21-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2057441275981537632',
    photoUrls: [
      'https://pbs.twimg.com/media/HI19M4wacAA05Ka?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-21-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2057443871655928318',
    photoUrls: [
      'https://pbs.twimg.com/media/HI2CSwSaIAElnHV?format=jpg&name=large',
      'https://pbs.twimg.com/media/HI2CSwQbYAA4zpk?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-23-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2058186190356963687',
    photoUrls: [
      'https://pbs.twimg.com/media/HJAhu-sbsAADjlL?format=jpg&name=large',
      'https://pbs.twimg.com/media/HJAhu-ubIAAsn8L?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-26-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2059240777579126859',
    photoUrls: [
      'https://pbs.twimg.com/media/HJPkkkMbQAAo7ts?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-05-26-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2059273515371835731',
    photoUrls: [
      'https://pbs.twimg.com/media/HJQCWEfaYAAjtZs?format=jpg&name=large',
      'https://pbs.twimg.com/media/HJQCWDqaoAAS37Z?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-05-27-01', 'schedule-2026-05-27-02'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2059630818402934836',
    photoUrls: [
      'https://pbs.twimg.com/media/HJVHTsWboAAh8Yu?format=jpg&name=large',
    ],
    note: '본문에 당일 두 행사가 함께 적힌 공통 게시물. 행사별 사진 순서는 추측하지 않음',
  },
  {
    scheduleIds: ['schedule-2026-05-27-01', 'schedule-2026-05-27-02'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2059639620858777695',
    photoUrls: [
      'https://pbs.twimg.com/media/HJVPUSUbUAA6L8Y?format=jpg&name=large',
      'https://pbs.twimg.com/media/HJVPUShaUAAuEdq?format=jpg&name=large',
      'https://pbs.twimg.com/media/HJVPUSYaIAAD6qU?format=jpg&name=large',
    ],
    note: '본문에 당일 두 행사가 함께 적힌 공통 게시물. 행사별 사진 순서는 추측하지 않음',
  },
  {
    scheduleIds: ['schedule-2026-05-29-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2060365544629616917',
    photoUrls: [
      'https://pbs.twimg.com/media/HJfhZogbEAAF_2D?format=jpg&name=large',
      'https://pbs.twimg.com/media/HJfhZoeaUAAK0br?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-06-05-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2062889680903782863',
    photoUrls: [
      'https://pbs.twimg.com/media/HKDbBlAbEAA8M1Z?format=jpg&name=large',
      'https://pbs.twimg.com/media/HKDbBk8b0AEZHX9?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-06-12-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2065399967565627424',
    photoUrls: [
      'https://pbs.twimg.com/media/HKnGCUsasAApQL1?format=jpg&name=large',
      'https://pbs.twimg.com/media/HKnGCUsaYAAXmtx?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-06-28-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2071254833198416196',
    photoUrls: [
      'https://pbs.twimg.com/media/HL6TSAjakAA_PGe?format=jpg&name=large',
      'https://pbs.twimg.com/media/HL6TSAoaMAALOTw?format=jpg&name=large',
      'https://pbs.twimg.com/media/HL6TSAibUAAJKRz?format=jpg&name=large',
      'https://pbs.twimg.com/media/HL6TSAhbUAAQXRl?format=jpg&name=large',
    ],
    note: '6월 29일 00:30 게시. 본문에 일본 첫 팬미팅이 명시되어 6월 28일 일정에 연결',
  },
  {
    scheduleIds: ['schedule-2026-07-05-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2073717290261176624',
    photoUrls: [
      'https://pbs.twimg.com/media/HMdS4Y3bEAAWSqf?format=jpg&name=large',
      'https://pbs.twimg.com/media/HMdS4Y0aEAAYXec?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-07-18-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2078443414513656195',
    photoUrls: [
      'https://pbs.twimg.com/media/HNgcX32bEAA3TJb?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-07-18-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2078458587295494261',
    photoUrls: [
      'https://pbs.twimg.com/media/HNgrENGbwAA9yu0?format=jpg&name=large',
      'https://pbs.twimg.com/media/HNgrENGaAAA-Yjt?format=jpg&name=large',
      'https://pbs.twimg.com/media/HNgrENKa8AAqfx7?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-07-25-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2080673106314858888',
    photoUrls: [
      'https://pbs.twimg.com/media/HOAFsDHbYAA68YS?format=jpg&name=large',
      'https://pbs.twimg.com/media/HOAFsC8aYAAfHBZ?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-07-26-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2081274814535528748',
    photoUrls: [
      'https://pbs.twimg.com/media/HOIsN1eaAAAPsgp?format=jpg&name=large',
      'https://pbs.twimg.com/media/HOIsN1bagAAeINi?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-07-26-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2081306026536530022',
    photoUrls: [
      'https://pbs.twimg.com/media/HOJHGKiagAA6xOD?format=jpg&name=large',
      'https://pbs.twimg.com/media/HOJHGKUbkAAbKCk?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-07-31-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2083153202032136685',
    photoUrls: [
      'https://pbs.twimg.com/media/HOjWBjabkAAEump?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-07-31-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2083156973105926490',
    photoUrls: [
      'https://pbs.twimg.com/media/HOjaoLOagAA5ECD?format=jpg&name=large',
      'https://pbs.twimg.com/media/HOjaoLObIAE88_3?format=jpg&name=large',
      'https://pbs.twimg.com/media/HOjaoLQbYAAlY-9?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-08-01-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2083528168976363749',
    photoUrls: [
      'https://pbs.twimg.com/media/HOor5mCaoAAXhFr?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-08-01-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2083548301509751263',
    photoUrls: [
      'https://pbs.twimg.com/media/HOo9a_OaoAAyjzo?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-08-08-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2086009519101104594',
    photoUrls: [
      'https://pbs.twimg.com/media/HPL8ipDbYAABg_n?format=jpg&name=large',
      'https://pbs.twimg.com/media/HPL8ipAa0AABBPo?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-08-10-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2086734545211240900',
    photoUrls: [
      'https://pbs.twimg.com/media/HPWSAgvbcAA2rWU?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-08-10-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2086792178223763822',
    photoUrls: [
      'https://pbs.twimg.com/media/HPXEfHgbYAANAA4?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-08-25-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2092227996593623047',
    photoUrls: [
      'https://pbs.twimg.com/media/HQkVb8obUAAarO6?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-08-25-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2092238060637635005',
    photoUrls: [
      'https://pbs.twimg.com/media/HQkcW0dbYAAwwCs?format=jpg&name=large',
      'https://pbs.twimg.com/media/HQkcW0abIAAv25r?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-08-27-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2092961618586153172',
    photoUrls: [
      'https://pbs.twimg.com/media/HQuxfz0aMAANXGS?format=jpg&name=large',
      'https://pbs.twimg.com/media/HQuxfz6bgAAD_0B?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-08-29-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2093677626078675076',
    photoUrls: [
      'https://pbs.twimg.com/media/HQ48s_EaEAAv3nZ?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-08-30-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2093972006396195011',
    photoUrls: [
      'https://pbs.twimg.com/media/HQ9IcC_agAEJXPn?format=jpg&name=large',
      'https://pbs.twimg.com/media/HQ9IcDCaMAAe94z?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-01-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2094651469043474590',
    photoUrls: [
      'https://pbs.twimg.com/media/HRGwbQca4AAwfWC?format=jpg&name=large',
      'https://pbs.twimg.com/media/HRGwbQdbQAAVaQX?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-01-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2094655238003441731',
    photoUrls: [
      'https://pbs.twimg.com/media/HRGwn0PaUAE1IE9?format=jpg&name=large',
      'https://pbs.twimg.com/media/HRGwn0DawAAn8zq?format=jpg&name=large',
      'https://pbs.twimg.com/media/HRGwn0Fb0AAIgRa?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-05-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2096127569347399962',
    photoUrls: [
      'https://pbs.twimg.com/media/HRbw6bQbMAACgWP?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-05-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2096136246804328885',
    photoUrls: [
      'https://pbs.twimg.com/media/HRb4V3Va4AA97fo?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-06-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2096527575283872251',
    photoUrls: [
      'https://pbs.twimg.com/media/HRhbrB_bsAAXHiw?format=jpg&name=large',
      'https://pbs.twimg.com/media/HRhbrB_bEAAFEMW?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-09-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2097661296007401812',
    photoUrls: [
      'https://pbs.twimg.com/media/HRxi9DDbgAAjPde?format=jpg&name=large',
      'https://pbs.twimg.com/media/HRxi9DHasAAPxxG?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-09-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2097672620682658258',
    photoUrls: [
      'https://pbs.twimg.com/media/HRxs0l7aQAAups4?format=jpg&name=large',
      'https://pbs.twimg.com/media/HRxs0l8boAA4om6?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-10-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2098023684195696831',
    photoUrls: [
      'https://pbs.twimg.com/media/HR2sortaAAA4evM?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-10-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2098026271519449532',
    photoUrls: [
      'https://pbs.twimg.com/media/HR2vxPiaAAA0Z3K?format=jpg&name=large',
      'https://pbs.twimg.com/media/HR2vxWhawAIenFR?format=jpg&name=large',
      'https://pbs.twimg.com/media/HR2vxWxbcAEbV0u?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-11-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2098377387096617164',
    photoUrls: [
      'https://pbs.twimg.com/media/HR7vG1lawAA9vWA?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-11-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2098418791084589162',
    photoUrls: [
      'https://pbs.twimg.com/media/HR8USgzaYAAs9t5?format=jpg&name=large',
      'https://pbs.twimg.com/media/HR8USgta0AAOApK?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-14-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2099448069259735354',
    photoUrls: [
      'https://pbs.twimg.com/media/HSK7dJ-aAAAVoXk?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-17-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2100546557456318877',
    photoUrls: [
      'https://pbs.twimg.com/media/HSajiQSbgAAL6HJ?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-17-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2100551590642106415',
    photoUrls: [
      'https://pbs.twimg.com/media/HSanep1boAAx_K_?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-18-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2100917757252358286',
    photoUrls: [
      'https://pbs.twimg.com/media/HSfzv7RbIAA917V?format=jpg&name=large',
      'https://pbs.twimg.com/media/HSfzv7MaIAAbvXO?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-18-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2100887554782380254',
    photoUrls: [
      'https://pbs.twimg.com/media/HSU9lQYasAAxzL_?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-18-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2100937886103167357',
    photoUrls: [
      'https://pbs.twimg.com/media/HSgEkiyb0AAqiJ8?format=jpg&name=large',
      'https://pbs.twimg.com/media/HSgEki1bcAAqv6a?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-19-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2101227293754405223',
    photoUrls: [
      'https://pbs.twimg.com/media/HSkN-y2bkAALEwI?format=jpg&name=large',
      'https://pbs.twimg.com/media/HSkN-y4bMAA8cmP?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-19-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2101229809690964373',
    photoUrls: [
      'https://pbs.twimg.com/media/HSkPWXjasAAPCQ5?format=jpg&name=large',
      'https://pbs.twimg.com/media/HSkPWXibwAAE_y7?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-22-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2102392708048548116',
    photoUrls: [
      'https://pbs.twimg.com/media/HS0zBizaUAA7dSs?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-22-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2102406313540046849',
    photoUrls: [
      'https://pbs.twimg.com/media/HS0-8CLbQAAFX5s?format=jpg&name=large',
      'https://pbs.twimg.com/media/HS0-8CJa0AAVs0I?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-28-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2104544149038833960',
    photoUrls: [
      'https://pbs.twimg.com/media/HTTW3IDbgAASsKA?format=jpg&name=large',
      'https://pbs.twimg.com/media/HTTW3IEbgAA4q2c?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-28-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2104550441493152002',
    photoUrls: [
      'https://pbs.twimg.com/media/HTTcbeNaEAA7tlU?format=jpg&name=large',
      'https://pbs.twimg.com/media/HTTcbePbUAE7172?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-09-30-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2105276474492412257',
    photoUrls: [
      'https://pbs.twimg.com/media/HTdxmP-bEAEaX_8?format=jpg&name=large',
      'https://pbs.twimg.com/media/HTdxmQEbUAIqEjY?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-09-30-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2105278991003205717',
    photoUrls: [
      'https://pbs.twimg.com/media/HTdxMo5aoAA97oy?format=jpg&name=large',
      'https://pbs.twimg.com/media/HTdxMo_bcAAvnhe?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-01-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2105623763140456723',
    photoUrls: [
      'https://pbs.twimg.com/media/HTis7mcaEAAR-hy?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-01-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2105633829012570511',
    photoUrls: [
      'https://pbs.twimg.com/media/HTi08XLaUAAtTJ6?format=jpg&name=large',
      'https://pbs.twimg.com/media/HTi08XKaMAEQh2p?format=jpg&name=large',
      'https://pbs.twimg.com/media/HTi1HWdaoAAFqEP?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-02-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2105998736552010135',
    photoUrls: [
      'https://pbs.twimg.com/media/HToBBAlboAA7gPv?format=jpg&name=large',
      'https://pbs.twimg.com/media/HToBBAobYAA2l02?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-02-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2106011343400878335',
    photoUrls: [
      'https://pbs.twimg.com/media/HToOJ0IasAAlrG-?format=jpg&name=large',
      'https://pbs.twimg.com/media/HToOJ0JbAAAvoUr?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-03-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2106372445816926690',
    photoUrls: [
      'https://pbs.twimg.com/media/HTtU4vzasAA6q7G?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-03-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2106378737461657889',
    photoUrls: [
      'https://pbs.twimg.com/media/HTtZMEsaQAAKeyQ?format=jpg&name=large',
      'https://pbs.twimg.com/media/HTtZMEva0AEbCEx?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-10-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2108855054207996287',
    photoUrls: [
      'https://pbs.twimg.com/media/HUQnI1Aa4AAh0BT?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-10-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2108862603896480078',
    photoUrls: [
      'https://pbs.twimg.com/media/HUQueBXagAAbn9l?format=jpg&name=large',
      'https://pbs.twimg.com/media/HUQueBUa4AAldUZ?format=jpg&name=large',
      'https://pbs.twimg.com/media/HUQueBZbgAAL-Rv?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-11-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2109243866255692017',
    photoUrls: [
      'https://pbs.twimg.com/media/HUWJa7lawAEAUd_?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-11-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2109248899651178826',
    photoUrls: [
      'https://pbs.twimg.com/media/HUWNbzNa4AAddQx?format=jpg&name=large',
      'https://pbs.twimg.com/media/HUWNbzNb0AAF8cN?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-16-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2111072166880153745',
    photoUrls: [
      'https://pbs.twimg.com/media/HUwINUha4AAPyG-?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-18-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2111784492692332872',
    photoUrls: [
      'https://pbs.twimg.com/media/HU6QzVTaUAEhVSA?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-18-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2111790648433238203',
    photoUrls: [
      'https://pbs.twimg.com/media/HU6V4fYaUAEgEx9?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-23-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2113586248161919191',
    photoUrls: [
      'https://pbs.twimg.com/media/HVT1JOpagAAVCcX?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-23-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2113591262741684415',
    photoUrls: [
      'https://pbs.twimg.com/media/HVT5OFrakAAl7Fk?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-27-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2115040813873086868',
    photoUrls: [
      'https://pbs.twimg.com/media/HVoglDwbkAAXIOH?format=jpg&name=large',
      'https://pbs.twimg.com/media/HVoglDnakAALf-1?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-27-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2115043336973086760',
    photoUrls: [
      'https://pbs.twimg.com/media/HVojQLdbwAAj3_B?format=jpg&name=large',
      'https://pbs.twimg.com/media/HVojQLhbAAAubky?format=jpg&name=large',
      'https://pbs.twimg.com/media/HVojQLebcAAmkZB?format=jpg&name=large',
      'https://pbs.twimg.com/media/HVojQLcbcAAyuHs?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-10-28-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2115425851667845309',
    photoUrls: [
      'https://pbs.twimg.com/media/HVt-ubDa8AAhg0d?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-10-28-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2115433401620570189',
    photoUrls: [
      'https://pbs.twimg.com/media/HVuGX76acAAlL50?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-13-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2121181290221142199',
    photoUrls: [
      'https://pbs.twimg.com/media/HW_viLuaQAAOsdt?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조',
  },
  {
    scheduleIds: ['schedule-2026-11-13-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2121185049601057089',
    photoUrls: [
      'https://pbs.twimg.com/media/HW_1GYWbMAAuScn?format=jpg&name=large',
      'https://pbs.twimg.com/media/HW_1GYabwAAfalz?format=jpg&name=large',
      'https://pbs.twimg.com/media/HW_1GYcbgAAjSbl?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-15-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2121889692820136120',
    photoUrls: [
      'https://pbs.twimg.com/media/HXJ10qjbcAAFRq1?format=jpg&name=large',
      'https://pbs.twimg.com/media/HXJ10qlaIAALeLX?format=jpg&name=large',
      'https://pbs.twimg.com/media/HXJ10qeacAAzmAo?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-16-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2122279763486060807',
    photoUrls: [
      'https://pbs.twimg.com/media/HXPZ4CTaUAATShY?format=jpg&name=large',
      'https://pbs.twimg.com/media/HXPZ4CQaIAANsYW?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-17-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2122649913582571992',
    photoUrls: [
      'https://pbs.twimg.com/media/HXUq2DCbUAAzUGB?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-20-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2123725544298889240',
    photoUrls: [
      'https://pbs.twimg.com/media/HXj8aYSawAAbkS2?format=jpg&name=large',
      'https://pbs.twimg.com/media/HXj8aYSaIAEYvvV?format=jpg&name=large',
      'https://pbs.twimg.com/media/HXj8aYuacAE5-4Y?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-21-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2124061503376552205',
    photoUrls: [
      'https://pbs.twimg.com/media/HXoqPzlasAAHZyE?format=jpg&name=large',
      'https://pbs.twimg.com/media/HXoqPzzasAAcsAK?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-22-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2124410050139570653',
    photoUrls: [
      'https://pbs.twimg.com/media/HXtpinGaMAA7CJL?format=jpg&name=large',
      'https://pbs.twimg.com/media/HXtpinJaMAAPxNz?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-23-02'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2124880662297509904',
    photoUrls: [
      'https://pbs.twimg.com/media/HX0WiCKbcAAepK1?format=jpg&name=large',
    ],
    note: '게시물의 행사명과 등록 일정 대조',
  },
  {
    scheduleIds: ['schedule-2026-11-24-01'],
    category: 'group',
    sourceUrl: 'https://x.com/H1KEY_official/status/2125219131381186798',
    photoUrls: [
      'https://pbs.twimg.com/media/HX5CYo1bUAAK95a?format=jpg&name=large',
    ],
    note: '본문의 행사 날짜·이름을 등록 일정과 대조. 단체 1장만 연결하고 멤버별 개인 사진 4장은 분류 보류. 리이나 개인 사진은 #리이나 게시물에서 연결',
  },
  {
    scheduleIds: ['schedule-2026-11-24-01'],
    category: 'individual',
    sourceUrl: 'https://x.com/H1KEY_official/status/2125234230884278566',
    photoUrls: [
      'https://pbs.twimg.com/media/HX5YF95bAAARALg?format=jpg&name=large',
      'https://pbs.twimg.com/media/HX5YF9wa0AEjGDO?format=jpg&name=large',
    ],
    note: '#리이나 게시일에 등록된 단일 일정에 날짜 기준 연결',
  },
];
