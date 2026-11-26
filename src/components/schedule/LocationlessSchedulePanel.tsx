/**
 * 이 패널은 좌표가 없는 영상통화 등 온라인 일정을 지도 외부에서 보여줍니다.
 */

import { useEffect, useRef } from 'react';
import { songs } from '../../data/songs';
import { getSongPerformanceNumber } from '../../data/songStats';
import type { Schedule } from '../../types/archive';
import OfficialSchedulePhotos from '../media/OfficialSchedulePhotos';
import { renderPhotoGallery } from '../media/photoGallery';
import { renderXPostEmbeds } from '../media/xPostEmbeds';
import '../media/XPostEmbeds.css';
import './LocationlessSchedulePanel.css';

const songsById = new Map(songs.map((song) => [song.id, song]));

type LocationlessSchedulePanelProps = {
  schedules: Schedule[];
  selected?: Schedule;
  onSelect: (schedule: Schedule) => void;
  onBack: () => void;
  onClose: () => void;
};

function getDateParts(date: string) {
  const [year, month, day] = date.split('-');
  return {
    year,
    month,
    day,
    full: `${year}년 ${Number(month)}월 ${Number(day)}일`,
  };
}

function VideoCallIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="12" height="12" rx="3" />
      <path d="m15 10 6-3v10l-6-3" />
    </svg>
  );
}

/** 좌표 없는 영상통화 일정을 별도 목록으로 탐색하도록 합니다. */
function LocationlessSchedulePanel({
  schedules,
  selected,
  onSelect,
  onBack,
  onClose,
}: LocationlessSchedulePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const selectedXPosts = selected?.media?.xPosts;
  const selectedPhotos = selected?.media?.photos;
  const demoSchedules = schedules.some((schedule) =>
    schedule.title.startsWith('[가상]'),
  );
  const selectedIndex = selected
    ? schedules.findIndex((schedule) => schedule.id === selected.id) + 1
    : 0;

  useEffect(() => {
    panelRef.current?.focus();
  }, [selected?.id]);

  useEffect(() => {
    const xPosts = selectedXPosts;
    if (mediaRef.current && xPosts?.length) {
      return renderXPostEmbeds(mediaRef.current, xPosts);
    }
  }, [selected?.id, selectedXPosts]);

  useEffect(() => {
    if (photoRef.current && selectedPhotos?.length) {
      return renderPhotoGallery(photoRef.current, selectedPhotos);
    }
  }, [selected?.id, selectedPhotos]);

  return (
    <aside
      ref={panelRef}
      id="locationless-schedules"
      className="locationless-panel"
      aria-label="영상통화 일정"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <header className="locationless-panel-header">
        <div className="locationless-heading-copy">
          <span className="locationless-eyebrow">
            <VideoCallIcon /> ONLINE ARCHIVE
          </span>
          <h2>{selected ? '영상통화 일정' : '영상통화 기록'}</h2>
          <p>
            {selected
              ? '장소 대신 날짜와 기록으로 남긴 일정이에요.'
              : '장소가 없는 온라인 행사도 일정으로 모았어요.'}
          </p>
        </div>
        <button
          type="button"
          className="locationless-close"
          aria-label="일정 패널 닫기"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      {demoSchedules && (
        <p className="locationless-demo-notice">
          가상 테스트 데이터 · 실제 H1-KEY 행사 기록이 아닙니다.
        </p>
      )}

      {selected ? (
        <>
          <button type="button" className="locationless-back" onClick={onBack}>
            <span aria-hidden="true">←</span> 일정 목록{' '}
            <span className="locationless-list-count">
              {selectedIndex} / {schedules.length}
            </span>
          </button>

          <section className="locationless-event-card" aria-label="일정 정보">
            <div className="locationless-event-topline">
              <span className="locationless-event-type">
                <VideoCallIcon /> 영상통화 행사
              </span>
              <span className="locationless-online-badge">온라인</span>
            </div>
            <div className="locationless-event-date">
              <span>{getDateParts(selected.date).year}</span>
              <strong>
                {getDateParts(selected.date).month}.
                {getDateParts(selected.date).day}
              </strong>
            </div>
            <h3>{selected.title}</h3>
            <div className="locationless-event-meta">
              <div>
                <span>진행 날짜</span>
                <strong>{getDateParts(selected.date).full}</strong>
              </div>
              <div>
                <span>진행 방식</span>
                <strong>
                  {selected.eventFormat === 'hybrid'
                    ? '대면 · 영상통화'
                    : '온라인 영상통화'}
                </strong>
              </div>
              {selected.startTime && (
                <div>
                  <span>시작 시간</span>
                  <strong>{selected.startTime}</strong>
                </div>
              )}
            </div>
            <p className="locationless-event-note">
              오프라인 장소가 없는 일정이라 지도 대신 온라인 기록으로 보관하고
              있어요.
            </p>
          </section>

          {selected.eventFormat !== 'online' &&
            (selected.setlist.length > 0 ||
              selected.setlistStatus === 'none') && (
              <section className="locationless-setlist">
                <h3>세트리스트</h3>
                {selected.setlistStatus === 'none' ? (
                  <p>행사에서 진행된 곡이 없습니다.</p>
                ) : (
                  <ol className="schedule-setlist">
                    {selected.setlist.map((songId, index) => {
                      const song = songsById.get(songId);
                      const performanceNumber = getSongPerformanceNumber(
                        songId,
                        selected.id,
                      );
                      return (
                        <li key={`${songId}-${index}`}>
                          <span className="schedule-song-title">
                            {song?.title ??
                              `곡 정보 오류: 존재하지 않는 songId (${songId})`}
                          </span>
                          {song && performanceNumber !== undefined && (
                            <span className="schedule-song-count">
                              기록상 {performanceNumber}번째 무대
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            )}

          <OfficialSchedulePhotos media={selected.media} />
          {selectedPhotos?.length ? (
            <div className="locationless-gallery" ref={photoRef} />
          ) : null}
          {selectedXPosts?.length ? (
            <div className="locationless-embeds" ref={mediaRef} />
          ) : (
            <section
              className="locationless-video-empty"
              aria-label="영상 기록"
            >
              <div className="locationless-empty-icon">
                <VideoCallIcon />
              </div>
              <div>
                <h3>영상 기록</h3>
                <p>이 일정에 연결된 녹화 영상 게시물이 아직 없어요.</p>
                <span>
                  일정은 보존되어 있고, 영상 기록이 연결되면 이곳에서 확인할 수
                  있어요.
                </span>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <div className="locationless-list-intro">
            <span className="locationless-list-symbol">
              <VideoCallIcon />
            </span>
            <p>
              오프라인 장소가 없는 일정도 날짜와 진행 정보로 차곡차곡
              기록했어요.
            </p>
            <strong>{schedules.length}건의 일정</strong>
          </div>
          <ul className="locationless-schedule-list">
            {schedules.map((schedule) => {
              const date = getDateParts(schedule.date);
              return (
                <li key={schedule.id}>
                  <button
                    type="button"
                    className="locationless-schedule-choice"
                    onClick={() => onSelect(schedule)}
                  >
                    <span
                      className="locationless-date-badge"
                      aria-hidden="true"
                    >
                      <span>{Number(date.month)}월</span>
                      <strong>{Number(date.day)}</strong>
                    </span>
                    <span className="locationless-choice-copy">
                      <span className="locationless-choice-year">
                        {date.year} · 온라인
                      </span>
                      <strong>{schedule.title}</strong>
                      <span className="locationless-choice-time">
                        {schedule.startTime
                          ? `${schedule.startTime} 시작`
                          : '시작 시간 미기록'}
                      </span>
                    </span>
                    <span
                      className="locationless-choice-arrow"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}

export default LocationlessSchedulePanel;
