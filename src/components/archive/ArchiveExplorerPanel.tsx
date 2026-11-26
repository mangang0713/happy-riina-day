/**
 * 이 패널은 지도 기록을 장소·일정 목록으로 살펴보고 상세 페이지를 여는 탐색 UI입니다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { locations } from '../../data/locations';
import { schedules } from '../../data/schedules';
import {
  getSongPerformanceNumber,
  getSongPerformanceStats,
} from '../../data/songStats';
import { songs } from '../../data/songs';
import type { CountryCode, EventFormat, Schedule } from '../../types/archive';
import ArchiveScheduleFeedback from './ArchiveScheduleFeedback';
import OfficialSchedulePhotos from '../media/OfficialSchedulePhotos';
import { renderPhotoGallery } from '../media/photoGallery';
import { renderXPostEmbeds } from '../media/xPostEmbeds';
import '../media/XPostEmbeds.css';
import './ArchiveExplorerPanel.css';

const locationsById = new Map(
  locations.map((location) => [location.id, location]),
);
const songsById = new Map(songs.map((song) => [song.id, song]));
const countryNames: Record<CountryCode, string> = {
  KR: '한국',
  CN: '중국',
  JP: '일본',
  TH: '태국',
};

type ScheduleFormatFilter = 'all' | EventFormat;
type ArchiveExplorerPanelProps = { onClose: () => void };

function getScheduleOrder(a: Schedule, b: Schedule) {
  return (
    b.date.localeCompare(a.date) ||
    (a.orderInDay ?? Infinity) - (b.orderInDay ?? Infinity) ||
    (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99') ||
    a.id.localeCompare(b.id)
  );
}

function formatDate(date: string) {
  return date.replaceAll('-', '.');
}

function getFormatLabel(format: EventFormat) {
  if (format === 'online') return '영상통화';
  if (format === 'hybrid') return '대면·영상통화';
  if (format === 'unknown') return '형식 미확인';
  return '대면 행사';
}

/** 사용자가 지도 외에도 검색·필터·날짜순 목록으로 기록을 탐색하게 합니다. */
function ArchiveExplorerPanel({ onClose }: ArchiveExplorerPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'schedules' | 'songs'>('schedules');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState<'all' | CountryCode>('all');
  const [format, setFormat] = useState<ScheduleFormatFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string>();
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule>();
  const selectedScheduleId = selectedSchedule?.id;
  const selectedScheduleXPosts = selectedSchedule?.media?.xPosts;
  const selectedSchedulePhotos = selectedSchedule?.media?.photos;

  useEffect(() => {
    if (selectedScheduleId) headingRef.current?.focus();
    else searchRef.current?.focus();
  }, [selectedScheduleId]);

  useEffect(() => {
    const xPosts = selectedScheduleXPosts;
    if (mediaRef.current && xPosts?.length) {
      return renderXPostEmbeds(mediaRef.current, xPosts);
    }
  }, [selectedScheduleId, selectedScheduleXPosts]);

  useEffect(() => {
    if (photoRef.current && selectedSchedulePhotos?.length) {
      return renderPhotoGallery(photoRef.current, selectedSchedulePhotos);
    }
  }, [selectedScheduleId, selectedSchedulePhotos]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((schedule) => {
        if (fromDate && schedule.date < fromDate) return false;
        if (toDate && schedule.date > toDate) return false;
        if (format !== 'all' && schedule.eventFormat !== format) return false;
        if (country !== 'all') {
          const scheduleLocation = schedule.locationId
            ? locationsById.get(schedule.locationId)
            : undefined;
          if (
            (scheduleLocation?.countryCode ??
              (scheduleLocation ? 'KR' : undefined)) !== country
          ) {
            return false;
          }
        }
        return true;
      }),
    [country, format, fromDate, toDate],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSongStats = getSongPerformanceStats(filteredSchedules).filter(
    (stat) =>
      !normalizedQuery ||
      stat.song.title.toLocaleLowerCase().includes(normalizedQuery),
  );
  const matchingSchedules = filteredSchedules
    .filter((schedule) => {
      if (
        selectedSongId &&
        !schedule.setlist.some((songId) => songId === selectedSongId)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const locationName = schedule.locationId
        ? locationsById.get(schedule.locationId)?.name ?? ''
        : '';
      const songTitles = schedule.setlist
        .map((songId) => songsById.get(songId)?.title ?? '')
        .join(' ');
      return [
        schedule.title,
        schedule.date,
        locationName,
        songTitles,
        getFormatLabel(schedule.eventFormat),
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    })
    .sort(getScheduleOrder);

  const selectedSong = selectedSongId
    ? songsById.get(selectedSongId)
    : undefined;
  const detailLocation = selectedSchedule?.locationId
    ? locationsById.get(selectedSchedule.locationId)
    : undefined;

  return createPortal(
    <div
      className="archive-data-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        id="archive-data-panel"
        className="archive-data-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-data-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
          }

          if (event.key !== 'Tab') return;
          const focusableElements =
            panelRef.current?.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
          if (!focusableElements?.length) {
            event.preventDefault();
            panelRef.current?.focus();
            return;
          }

          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          const activeIndex = Array.from(focusableElements).indexOf(
            document.activeElement as HTMLElement,
          );
          if (event.shiftKey && activeIndex <= 0) {
            event.preventDefault();
            last.focus();
          } else if (
            !event.shiftKey &&
            (activeIndex === focusableElements.length - 1 || activeIndex === -1)
          ) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header className="archive-data-header">
          <div>
            <p className="archive-data-eyebrow">H1-KEY ACTIVITY ARCHIVE</p>
            <h2 id="archive-data-title" ref={headingRef} tabIndex={-1}>
              {selectedSchedule?.title ?? '기록 찾아보기'}
            </h2>
          </div>
          <button
            type="button"
            className="archive-data-close"
            aria-label="기록 패널 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {selectedSchedule ? (
          <div className="archive-data-scroll">
            <button
              type="button"
              className="archive-data-back"
              onClick={() => setSelectedSchedule(undefined)}
            >
              ← 검색 결과로 돌아가기
            </button>
            <section
              className="archive-data-event-banner"
              aria-label="행사 기본 정보"
            >
              <div className="archive-data-event-date">
                <span>EVENT DATE</span>
                <time dateTime={selectedSchedule.date}>
                  {formatDate(selectedSchedule.date)}
                </time>
              </div>
              <div className="archive-data-event-venue">
                <span className="archive-data-format-chip">
                  {getFormatLabel(selectedSchedule.eventFormat)}
                </span>
                <strong>
                  {detailLocation?.name ??
                    (selectedSchedule.eventFormat === 'online'
                      ? '온라인 · 실제 장소 없음'
                      : '장소 미확인')}
                </strong>
              </div>
            </section>
            {(detailLocation?.address || selectedSchedule.startTime) && (
              <dl className="archive-data-details">
                {detailLocation?.address && (
                  <>
                    <dt>주소</dt>
                    <dd>{detailLocation.address}</dd>
                  </>
                )}
                {selectedSchedule.startTime && (
                  <>
                    <dt>시작 시간</dt>
                    <dd>{selectedSchedule.startTime}</dd>
                  </>
                )}
              </dl>
            )}
            <OfficialSchedulePhotos media={selectedSchedule.media} />
            <ArchiveScheduleFeedback
              key={selectedSchedule.id}
              scheduleId={selectedSchedule.id}
            />
            {selectedSchedule.eventFormat !== 'online' &&
              selectedSchedule.setlistStatus === 'none' && (
                <p className="archive-data-note">
                  행사에서 진행된 곡이 없습니다.
                </p>
              )}
            {selectedSchedule.eventFormat !== 'online' &&
              selectedSchedule.setlistStatus !== 'none' &&
              selectedSchedule.setlist.length > 0 && (
                <>
                  <h3>세트리스트</h3>
                  <ol className="archive-data-setlist">
                    {selectedSchedule.setlist.map((songId, index) => {
                      const song = songsById.get(songId);
                      const performanceNumber = getSongPerformanceNumber(
                        songId,
                        selectedSchedule.id,
                      );
                      return (
                        <li key={`${songId}-${index}`}>
                          <span>
                            {song?.title ?? `곡 정보 오류: ${songId}`}
                          </span>
                          {song && performanceNumber !== undefined && (
                            <span className="archive-data-song-count">
                              기록상 {performanceNumber}번째 무대
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            {selectedSchedule.media?.photos?.length ? (
              <div ref={photoRef} />
            ) : null}
            {selectedSchedule.media?.xPosts?.length ? (
              <div ref={mediaRef} />
            ) : null}
          </div>
        ) : (
          <>
            <div
              className="archive-data-tabs"
              role="group"
              aria-label="기록 종류"
            >
              <button
                type="button"
                aria-pressed={view === 'schedules'}
                onClick={() => {
                  setView('schedules');
                  setSelectedSongId(undefined);
                }}
              >
                전체 일정
              </button>
              <button
                type="button"
                aria-pressed={view === 'songs'}
                onClick={() => {
                  setView('songs');
                  setSelectedSongId(undefined);
                }}
              >
                곡별 기록
              </button>
            </div>
            <div className="archive-data-filters">
              <label className="archive-data-search">
                <span className="visually-hidden">
                  {view === 'songs' ? '곡 검색' : '행사, 곡, 장소 검색'}
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.8" cy="10.8" r="6.8" />
                  <path d="m16 16 5 5" />
                </svg>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  placeholder={
                    view === 'songs' ? '곡 제목 검색' : '행사·곡·장소 검색'
                  }
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="archive-data-selects">
                <label>
                  <span>국가</span>
                  <select
                    value={country}
                    onChange={(event) =>
                      setCountry(event.target.value as 'all' | CountryCode)
                    }
                  >
                    <option value="all">전체</option>
                    {(['KR', 'CN', 'JP', 'TH'] as const).map((code) => (
                      <option key={code} value={code}>
                        {countryNames[code]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>형식</span>
                  <select
                    value={format}
                    onChange={(event) =>
                      setFormat(event.target.value as ScheduleFormatFilter)
                    }
                  >
                    <option value="all">전체</option>
                    <option value="in-person">대면 행사</option>
                    <option value="online">영상통화</option>
                    <option value="hybrid">대면·영상통화</option>
                    <option value="unknown">미확인</option>
                  </select>
                </label>
              </div>
              <div className="archive-data-dates">
                <label>
                  <span>시작일</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </label>
                <label>
                  <span>종료일</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="archive-data-scroll" aria-live="polite">
              {view === 'schedules' ? (
                <>
                  {selectedSong && (
                    <div className="archive-data-filter-chip">
                      <span>곡: {selectedSong.title}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedSongId(undefined)}
                        aria-label="곡 필터 해제"
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <p className="archive-data-result-count">
                    일정 {matchingSchedules.length}건
                  </p>
                  {matchingSchedules.length > 0 ? (
                    <ul className="archive-data-list">
                      {matchingSchedules.map((schedule) => {
                        const location = schedule.locationId
                          ? locationsById.get(schedule.locationId)
                          : undefined;
                        return (
                          <li key={schedule.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedSchedule(schedule)}
                            >
                              <time dateTime={schedule.date}>
                                {formatDate(schedule.date)}
                              </time>
                              <strong>{schedule.title}</strong>
                              <span>
                                {location?.name ??
                                  (schedule.eventFormat === 'online'
                                    ? '영상통화'
                                    : '장소 미확인')}{' '}
                                · {getFormatLabel(schedule.eventFormat)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="archive-data-empty">
                      조건에 맞는 일정이 없습니다.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="archive-data-result-count">
                    곡 {filteredSongStats.length}개 · 확인된 공연 일정 수
                  </p>
                  <p className="archive-data-note">
                    전체 확인과 일부 확인 세트리스트에 적힌 곡만 셉니다. 일부
                    확인 일정의 곡은 최소 기록입니다.
                  </p>
                  <ul className="archive-data-list archive-song-list">
                    {filteredSongStats.map((stat) => (
                      <li key={stat.song.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSongId(stat.song.id);
                            setView('schedules');
                            setQuery('');
                          }}
                        >
                          <strong>{stat.song.title}</strong>
                          <span>
                            {stat.scheduleCount}개 일정 · 전체 확인{' '}
                            {stat.fullyConfirmedCount} · 일부 확인{' '}
                            {stat.partiallyConfirmedCount}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
}

export default ArchiveExplorerPanel;
