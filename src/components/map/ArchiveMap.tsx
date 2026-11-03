/**
 * 이 컴포넌트는 지도 생명주기, 장소 마커, 일정 팝업, 카메라 이동을 연결하는 지도 중심부입니다.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './ArchiveMap.css';
import {
  createSchedulePopupContent,
  type SchedulePopupReaction,
} from './SchedulePopupContent';
import {
  archiveRegions,
  locationPoints,
  locationsById,
  nearestRegionCode,
  schedulesByLocation,
  videoCallSchedules,
  type MappedLocation,
} from './archiveMapData';
import ArchiveExplorerControls from './ArchiveExplorerControls';
import TimeTravelPanel from './TimeTravelPanel';
import type { RegionNavigationOption } from './RegionNavigationPanel';
import {
  addLocationMarkerLayers,
  clusterCircleLayerId,
  clusterCountLayerId,
  locationCountLayerId,
  locationPinLayerId,
  setLocationMarkerLayersVisible,
} from './locationMarkerLayers';
import {
  createTimeTravelController,
  JOURNEY_STOP_DELAY_MS,
  timeTravelSchedules,
  type TimeTravelSpeed,
  type TimeTravelController,
} from './timeTravelController';
import { createRegionNavigationController } from './regionNavigationController';
import { schedules } from '../../data/schedules';
import type { CountryCode, Schedule } from '../../types/archive';
import { useAuth } from '../../features/auth/authContext';
import {
  getScheduleReactions,
  toggleScheduleLike,
} from '../../features/community/api';

setWorkerUrl(workerUrl);

const sourceId = 'archive-locations';
const INITIAL_CAMERA = {
  center: [127.8, 36.3] as [number, number],
  zoom: 6,
  bearing: 0,
  pitch: 0,
};
const DETAIL_ZOOM = 12;
const CAMERA_DURATION = 450;
type SavedCamera = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

/** MapLibre 인스턴스와 장소 선택·팝업·카메라 제어 흐름을 소유합니다. */
function ArchiveMap() {
  const { user } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | undefined>(user?.id);
  const homeButtonRef = useRef<HTMLButtonElement>(null);
  const locationlessButtonRef = useRef<HTMLButtonElement>(null);
  const regionNavigationButtonRef = useRef<HTMLButtonElement>(null);
  const archiveDataButtonRef = useRef<HTMLButtonElement>(null);
  const timeTravelButtonRef = useRef<HTMLButtonElement>(null);
  const dismissMapSelectionRef = useRef<(() => void) | undefined>(undefined);
  const navigateToRegionRef = useRef<
    ((countryCode: CountryCode) => void) | undefined
  >(undefined);
  const timeTravelControllerRef = useRef<TimeTravelController | undefined>(
    undefined,
  );
  const [locationlessOpen, setLocationlessOpen] = useState(false);
  const [locationlessSelected, setLocationlessSelected] = useState<Schedule>();
  const [regionNavigationOpen, setRegionNavigationOpen] = useState(false);
  const [archiveDataOpen, setArchiveDataOpen] = useState(false);
  const [timeTravelOpen, setTimeTravelOpen] = useState(false);
  const [timeTravelPlaying, setTimeTravelPlaying] = useState(false);
  const [timeTravelMoving, setTimeTravelMoving] = useState(false);
  const [timeTravelPausedOnRoute, setTimeTravelPausedOnRoute] = useState(false);
  const [timeTravelIndex, setTimeTravelIndex] = useState<number | null>(null);
  const [timeTravelSpeed, setTimeTravelSpeed] = useState<TimeTravelSpeed>(2);
  const timeTravelSpeedRef = useRef<TimeTravelSpeed>(2);
  const selectedTimeTravelSpeedRef = useRef<TimeTravelSpeed>(2);
  const currentTimeTravelIndex = timeTravelIndex ?? 0;
  const [currentRegionCode, setCurrentRegionCode] = useState<CountryCode>('KR');
  const otherRegions = archiveRegions.filter(
    (region) => region.countryCode !== currentRegionCode,
  );
  const otherRegionOptions: RegionNavigationOption[] = otherRegions.map(
    (region) => ({
      countryCode: region.countryCode,
      label: region.label,
      locationCount: region.locations.length,
      scheduleCount: region.scheduleCount,
    }),
  );
  const activeTimeTravelSchedule =
    timeTravelIndex === null ? undefined : timeTravelSchedules[timeTravelIndex];

  useEffect(() => {
    currentUserIdRef.current = user?.id;
  }, [user?.id]);

  useEffect(() => {
    if (!timeTravelOpen || !activeTimeTravelSchedule) return;
    timeTravelSpeedRef.current = selectedTimeTravelSpeedRef.current;
    timeTravelControllerRef.current?.focus(activeTimeTravelSchedule);
  }, [activeTimeTravelSchedule, timeTravelOpen]);

  useEffect(() => {
    if (
      !timeTravelOpen ||
      !timeTravelPlaying ||
      timeTravelMoving ||
      timeTravelPausedOnRoute ||
      timeTravelIndex === null
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (timeTravelIndex >= timeTravelSchedules.length - 1) {
        setTimeTravelPlaying(false);
      } else setTimeTravelIndex(timeTravelIndex + 1);
    }, JOURNEY_STOP_DELAY_MS / timeTravelSpeedRef.current);
    return () => window.clearTimeout(timer);
  }, [
    timeTravelIndex,
    timeTravelMoving,
    timeTravelOpen,
    timeTravelPausedOnRoute,
    timeTravelPlaying,
  ]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      ...INITIAL_CAMERA,
      minPitch: 0,
      maxPitch: 0,
      // 이동·확대 중 이전 배율 타일을 유지해 새 타일 로딩 동안 지도가 비어 보이지 않게 합니다.
      cancelPendingTileRequestsWhileZooming: false,
      // 시간순 탐방에서 이미 지난 지역의 타일을 기본값보다 조금 더 오래 보관합니다.
      maxTileCacheZoomLevels: 6,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    map.touchZoomRotate.disableRotation();

    let disposed = false;
    const popup = new Popup({
      className: 'archive-schedule-popup',
      maxWidth: 'min(380px, calc(100vw - 24px))',
      offset: 48,
      anchor: 'bottom',
    });
    let savedCamera: SavedCamera | undefined;
    let selectedLocationId: string | undefined;
    let selectedLocationCenter: [number, number] | undefined;
    let locationMarkerLayersVisible: boolean | undefined;
    let cameraRequest = 0;
    const duration = () =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : CAMERA_DURATION;
    const discardSelection = () => {
      // 처음으로/클러스터 선택은 이전 카메라로 복원하지 않습니다.
      savedCamera = undefined;
      selectedLocationId = undefined;
      selectedLocationCenter = undefined;
      popup.remove();
    };
    const highlightTimeTravelLocation = (locationId?: string) => {
      if (!map.getSource(sourceId)) return;
      const previousLocationId =
        timeTravelControllerRef.current?.getActiveLocationId();
      if (previousLocationId && previousLocationId !== locationId) {
        map.removeFeatureState(
          { source: sourceId, id: previousLocationId },
          'journeyActive',
        );
      }
      if (locationId) {
        map.setFeatureState(
          { source: sourceId, id: locationId },
          { journeyActive: true },
        );
      }
    };
    const clearVisibleLocationMarkers = () => {
      locationMarkerLayersVisible = false;
      setLocationMarkerLayersVisible(map, false);
    };
    const timeTravelController = createTimeTravelController({
      map,
      duration,
      playbackSpeed: () => timeTravelSpeedRef.current,
      invalidateOtherCameraTransitions: () => {
        cameraRequest++;
      },
      discardSelection,
      clearVisibleLocationMarkers,
      highlightLocation: highlightTimeTravelLocation,
      onStart: () => {
        setLocationlessOpen(false);
        setLocationlessSelected(undefined);
        setRegionNavigationOpen(false);
        setArchiveDataOpen(false);
      },
      setOpen: setTimeTravelOpen,
      setPlaying: setTimeTravelPlaying,
      setMoving: setTimeTravelMoving,
      setPausedOnRoute: setTimeTravelPausedOnRoute,
      setIndex: setTimeTravelIndex,
      setCurrentRegionCode,
    });
    timeTravelControllerRef.current = timeTravelController;
    const regionNavigationController = createRegionNavigationController({
      map,
      duration,
      discardSelection,
      nextCameraRequest: () => ++cameraRequest,
      isCameraRequestCurrent: (request) =>
        !disposed && request === cameraRequest,
      onNavigateStart: (countryCode) => {
        timeTravelController.stop(false);
        setCurrentRegionCode(countryCode);
        setLocationlessOpen(false);
        setLocationlessSelected(undefined);
        setRegionNavigationOpen(false);
      },
    });
    let popupEvents: AbortController | undefined;
    const reactionCache = new Map<
      string,
      { reaction: SchedulePopupReaction; expiresAt: number }
    >();
    const reactionCacheKey = (userId: string | undefined, scheduleId: string) =>
      `${userId ?? 'anonymous'}:${scheduleId}`;
    const clearPopupEvents = () => {
      popupEvents?.abort();
      popupEvents = undefined;
    };
    const closeSelection = () => {
      clearPopupEvents();
      const previous = savedCamera;
      const selectedCenter = selectedLocationCenter;
      savedCamera = undefined;
      selectedLocationId = undefined;
      selectedLocationCenter = undefined;
      if (disposed || !previous) return;
      cameraRequest++;
      map.stop();
      map.easeTo({
        ...previous,
        center: selectedCenter ?? previous.center,
        duration: duration(),
      });
      map.getCanvas().focus();
    };
    dismissMapSelectionRef.current = () => {
      if (popup.isOpen()) popup.remove();
      else closeSelection();
    };
    popup.on('close', closeSelection);
    navigateToRegionRef.current = regionNavigationController.navigate;
    const goHome = () => {
      timeTravelController.stop(false);
      cameraRequest++;
      map.stop();
      discardSelection();
      setLocationlessOpen(false);
      setLocationlessSelected(undefined);
      setRegionNavigationOpen(false);
      setCurrentRegionCode('KR');
      map.easeTo({ ...INITIAL_CAMERA, duration: duration() });
    };
    const homeButton = homeButtonRef.current;
    const updateHomeButtonVisibility = () => {
      if (!homeButton) return;
      const center = map.getCenter();
      const isInitialCamera =
        Math.abs(center.lng - INITIAL_CAMERA.center[0]) < 0.001 &&
        Math.abs(center.lat - INITIAL_CAMERA.center[1]) < 0.001 &&
        Math.abs(map.getZoom() - INITIAL_CAMERA.zoom) < 0.01 &&
        Math.abs(map.getBearing() - INITIAL_CAMERA.bearing) < 0.01 &&
        Math.abs(map.getPitch() - INITIAL_CAMERA.pitch) < 0.01;
      homeButton.hidden = isInitialCamera;
    };
    homeButton?.addEventListener('click', goHome);
    map.on('moveend', updateHomeButtonVisibility);
    updateHomeButtonVisibility();

    const openPopup = (location: MappedLocation, selected?: Schedule) => {
      clearPopupEvents();
      popupEvents = new AbortController();
      const signal = popupEvents.signal;
      const locationSchedules = schedulesByLocation.get(location.id) ?? [];
      const reactionUserId = currentUserIdRef.current;
      const reactionSchedules = selected ? [selected] : locationSchedules;
      const { content, focusTarget, updateReactions } =
        createSchedulePopupContent({
          location,
          schedules: locationSchedules,
          selected,
          signal,
          isAuthenticated: Boolean(reactionUserId),
          onToggleLike: async (scheduleId, current) => {
            const userId = currentUserIdRef.current;
            if (!userId) {
              throw new Error('로그인 후 좋아요를 누를 수 있습니다.');
            }
            const result = await toggleScheduleLike(scheduleId);
            const next = {
              liked: result.liked,
              likeCount: Math.max(
                0,
                current.likeCount + (result.liked ? 1 : -1),
              ),
            };
            reactionCache.set(reactionCacheKey(userId, scheduleId), {
              reaction: next,
              expiresAt: Date.now() + 30_000,
            });
            return next;
          },
          onSelect: (schedule) => openPopup(location, schedule),
          onBack: () => openPopup(location),
          onClose: () => popup.remove(),
        });
      const reactions = new Map<string, SchedulePopupReaction | null>();
      const schedulesToFetch: Schedule[] = [];
      for (const schedule of reactionSchedules) {
        const cached = reactionCache.get(
          reactionCacheKey(reactionUserId, schedule.id),
        );
        if (cached && cached.expiresAt > Date.now()) {
          reactions.set(schedule.id, cached.reaction);
        } else schedulesToFetch.push(schedule);
      }
      updateReactions(reactions);
      if (schedulesToFetch.length > 0) {
        void Promise.all(
          schedulesToFetch.map(async (schedule) => {
            try {
              const stats = await getScheduleReactions(
                schedule.id,
                reactionUserId,
              );
              return {
                scheduleId: schedule.id,
                reaction: { likeCount: stats.likeCount, liked: stats.liked },
              };
            } catch {
              return { scheduleId: schedule.id, reaction: null };
            }
          }),
        ).then((results) => {
          if (signal.aborted) return;
          for (const result of results) {
            reactions.set(result.scheduleId, result.reaction);
            if (result.reaction) {
              reactionCache.set(
                reactionCacheKey(reactionUserId, result.scheduleId),
                {
                  reaction: result.reaction,
                  expiresAt: Date.now() + 30_000,
                },
              );
            }
          }
          updateReactions(reactions);
        });
      }
      popup.setLngLat(location.coordinates).setDOMContent(content);
      if (!popup.isOpen()) popup.addTo(map);
      // 상세 제목 또는 첫 목록 항목으로 포커스를 이동합니다.
      focusTarget.focus();
    };

    const selectLocation = (location: MappedLocation) => {
      timeTravelController.stop(false);
      setLocationlessOpen(false);
      setLocationlessSelected(undefined);
      setRegionNavigationOpen(false);
      setArchiveDataOpen(false);
      cameraRequest++;
      if (selectedLocationId !== location.id) {
        map.stop();
        const center = map.getCenter();
        savedCamera = {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        };
        selectedLocationId = location.id;
        // 핀을 화면 아래쪽에 두고 위쪽 Popup을 위한 공간을 확보합니다.
        map.easeTo({
          center: location.coordinates,
          zoom: Math.max(DETAIL_ZOOM, map.getZoom()),
          offset: [0, Math.min(map.getContainer().clientHeight * 0.25, 180)],
          duration: duration(),
        });
      }
      selectedLocationCenter = location.coordinates;
      const locationSchedules = schedulesByLocation.get(location.id) ?? [];
      openPopup(
        location,
        locationSchedules.length === 1 ? locationSchedules[0] : undefined,
      );
    };

    const syncLocationMarkerVisibility = () => {
      if (disposed || !map.getSource(sourceId)) return;
      const visible = !timeTravelController.isRunning();
      if (visible === locationMarkerLayersVisible) return;
      locationMarkerLayersVisible = visible;
      setLocationMarkerLayersVisible(map, visible);
    };
    const handleMapMarkerClick = async (event: MapMouseEvent) => {
      if (!map.getLayer(clusterCircleLayerId)) return;
      const features = map.queryRenderedFeatures(event.point, {
        layers: [
          clusterCountLayerId,
          clusterCircleLayerId,
          locationCountLayerId,
          locationPinLayerId,
        ],
      });
      const feature =
        features.find((candidate) => Boolean(candidate.properties.cluster)) ??
        features.find((candidate) => Boolean(candidate.properties.locationId));
      if (!feature || feature.geometry.type !== 'Point') return;
      const coordinates = feature.geometry.coordinates as [number, number];
      timeTravelController.stop(false);
      const clusterId = feature.properties.cluster_id;
      if (clusterId !== undefined) {
        const request = ++cameraRequest;
        map.stop();
        discardSelection();
        try {
          const source = map.getSource(sourceId) as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(Number(clusterId));
          if (disposed || request !== cameraRequest) return;
          map.easeTo({
            center: coordinates,
            zoom: Math.min(zoom, map.getMaxZoom()),
            duration: duration(),
          });
        } catch (error) {
          if (!disposed && request === cameraRequest) {
            console.error('장소 클러스터 확대 실패', error);
          }
        }
        return;
      }
      const location = locationsById.get(String(feature.properties.locationId));
      if (location) selectLocation(location);
    };
    const setMapCursor = (event: MapLayerMouseEvent) => {
      if (!map.getLayer(clusterCircleLayerId)) return;
      map.getCanvas().style.cursor =
        map.queryRenderedFeatures(event.point, {
          layers: [
            clusterCountLayerId,
            clusterCircleLayerId,
            locationCountLayerId,
            locationPinLayerId,
          ],
        }).length > 0
          ? 'pointer'
          : '';
    };

    const addLocations = () => {
      map.addSource(sourceId, {
        type: 'geojson',
        data: locationPoints,
        cluster: true,
        clusterRadius: 35,
        clusterMaxZoom: 14,
      });
      addLocationMarkerLayers(map, sourceId);
      locationMarkerLayersVisible = true;
    };
    map.on('load', addLocations);
    map.on('render', syncLocationMarkerVisibility);
    map.on('click', handleMapMarkerClick);
    map.on('mousemove', setMapCursor);
    const updateCurrentRegion = () => {
      const center = map.getCenter();
      const nextRegion = nearestRegionCode([center.lng, center.lat]);
      setCurrentRegionCode((current) =>
        current === nextRegion ? current : nextRegion,
      );
    };
    map.on('moveend', updateCurrentRegion);

    return () => {
      disposed = true;
      cameraRequest++;
      timeTravelController.dispose();
      homeButton?.removeEventListener('click', goHome);
      map.stop();
      map.off('load', addLocations);
      map.off('render', syncLocationMarkerVisibility);
      map.off('click', handleMapMarkerClick);
      map.off('mousemove', setMapCursor);
      map.off('moveend', updateCurrentRegion);
      map.off('moveend', updateHomeButtonVisibility);
      map.getCanvas().style.cursor = '';
      popup.remove();
      popup.off('close', closeSelection);
      clearPopupEvents();
      dismissMapSelectionRef.current = undefined;
      navigateToRegionRef.current = undefined;
      timeTravelControllerRef.current = undefined;
      map.remove();
    };
  }, []);

  return (
    <main
      className="archive-map"
      onPointerDown={(event) => {
        if (
          (!locationlessOpen && !archiveDataOpen) ||
          !(event.target instanceof Element)
        ) {
          return;
        }
        if (
          event.target.closest(
            '#locationless-schedules, #archive-data-panel, .archive-data-overlay, .archive-explorer-actions',
          )
        ) {
          return;
        }
        if (locationlessOpen) {
          setLocationlessOpen(false);
          setLocationlessSelected(undefined);
        }
        if (archiveDataOpen) setArchiveDataOpen(false);
      }}
    >
      <div
        ref={mapContainerRef}
        className="map-container"
        role="region"
        aria-label="H1-KEY Activity Archive 대한민국 지도"
      />
      <button
        ref={homeButtonRef}
        type="button"
        className="map-home"
        aria-label="처음으로: 대한민국 초기 지도"
        title="처음으로"
        hidden
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 10 12 3l9 7v11h-6v-7H9v7H3Z" />
        </svg>
        <span>처음으로</span>
      </button>
      {timeTravelOpen && activeTimeTravelSchedule && (
        <TimeTravelPanel
          schedule={activeTimeTravelSchedule}
          locationName={
            activeTimeTravelSchedule.locationId
              ? locationsById.get(activeTimeTravelSchedule.locationId)?.name ??
                '장소 정보 없음'
              : '지도 위치 미등록'
          }
          index={currentTimeTravelIndex}
          total={timeTravelSchedules.length}
          playing={timeTravelPlaying}
          moving={timeTravelMoving}
          pausedOnRoute={timeTravelPausedOnRoute}
          speed={timeTravelSpeed}
          onSpeedChange={(speed) => {
            selectedTimeTravelSpeedRef.current = speed;
            setTimeTravelSpeed(speed);
          }}
          onClose={() => {
            timeTravelControllerRef.current?.stop(true);
            timeTravelButtonRef.current?.focus();
          }}
          onPrevious={() => {
            setTimeTravelPlaying(false);
            setTimeTravelPausedOnRoute(false);
            setTimeTravelIndex(Math.max(0, currentTimeTravelIndex - 1));
          }}
          onTogglePlayback={() => {
            if (timeTravelPlaying) {
              setTimeTravelPlaying(false);
              if (timeTravelMoving) {
                setTimeTravelPausedOnRoute(true);
                timeTravelControllerRef.current?.pauseMovement();
              }
              return;
            }
            if (timeTravelPausedOnRoute) {
              setTimeTravelPausedOnRoute(false);
              timeTravelControllerRef.current?.focus(activeTimeTravelSchedule);
            } else if (
              currentTimeTravelIndex ===
              timeTravelSchedules.length - 1
            ) {
              setTimeTravelIndex(0);
            }
            setTimeTravelPlaying(true);
          }}
          onNext={() => {
            setTimeTravelPlaying(false);
            setTimeTravelPausedOnRoute(false);
            setTimeTravelIndex(
              Math.min(
                timeTravelSchedules.length - 1,
                currentTimeTravelIndex + 1,
              ),
            );
          }}
        />
      )}
      <ArchiveExplorerControls
        regions={otherRegionOptions}
        videoCallSchedules={videoCallSchedules}
        scheduleCount={schedules.length}
        timeTravelCount={timeTravelSchedules.length}
        regionNavigationOpen={regionNavigationOpen}
        locationlessOpen={locationlessOpen}
        locationlessSelected={locationlessSelected}
        archiveDataOpen={archiveDataOpen}
        timeTravelButtonRef={timeTravelButtonRef}
        regionNavigationButtonRef={regionNavigationButtonRef}
        locationlessButtonRef={locationlessButtonRef}
        archiveDataButtonRef={archiveDataButtonRef}
        onStartTimeTravel={() => timeTravelControllerRef.current?.start()}
        onToggleRegionNavigation={() => {
          timeTravelControllerRef.current?.stop(false);
          if (!regionNavigationOpen) {
            setLocationlessOpen(false);
            setLocationlessSelected(undefined);
            setArchiveDataOpen(false);
          }
          setRegionNavigationOpen((open) => !open);
        }}
        onCloseRegionNavigation={() => {
          setRegionNavigationOpen(false);
          regionNavigationButtonRef.current?.focus();
        }}
        onSelectRegion={(countryCode) =>
          navigateToRegionRef.current?.(countryCode)
        }
        onToggleLocationless={() => {
          timeTravelControllerRef.current?.stop(false);
          if (!locationlessOpen) {
            dismissMapSelectionRef.current?.();
            setRegionNavigationOpen(false);
            setArchiveDataOpen(false);
          }
          setLocationlessSelected(undefined);
          setLocationlessOpen((open) => !open);
        }}
        onSelectLocationlessSchedule={setLocationlessSelected}
        onBackLocationless={() => setLocationlessSelected(undefined)}
        onCloseLocationless={() => {
          setLocationlessOpen(false);
          setLocationlessSelected(undefined);
          locationlessButtonRef.current?.focus();
        }}
        onToggleArchiveData={() => {
          timeTravelControllerRef.current?.stop(false);
          if (!archiveDataOpen) {
            dismissMapSelectionRef.current?.();
            setLocationlessOpen(false);
            setLocationlessSelected(undefined);
            setRegionNavigationOpen(false);
          }
          setArchiveDataOpen((open) => !open);
        }}
        onCloseArchiveData={() => {
          setArchiveDataOpen(false);
          archiveDataButtonRef.current?.focus();
        }}
      />
    </main>
  );
}

export default ArchiveMap;
