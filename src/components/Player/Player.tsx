import classNames from "classnames";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RaceInfo } from "../../hooks/useVideoRaceDetails/useVideoRaceDetails.types";
import {
  useViewerUIVisibility,
  ViewerUIVisibilityContext,
} from "../../hooks/useViewerUIVisibility/useViewerUIVisibility";
import { DoubleEllipsisIcon } from "../CustomIcons/CustomIcons";
import { VideoPlayerRef } from "../VideoPlayer/VideoPlayer.types";
import { PlayerControls } from "./PlayerControls/PlayerControls";
import styles from "./Player.module.scss";
import { PlayerRaceInfo } from "./PlayerRaceInfo/PlayerRaceInfo";
import { LayoutButtons, LayoutButtonsProps } from "./LayoutButtons/LayoutButtons";
import { usePlayerDrag } from "./hooks/usePlayerDrag";
import { PLAYER_COLLAPSED_ZONE_WHEN_COLLAPSED, PLAYER_COLLAPSED_ZONE_WHEN_OPEN } from "./Player.constants";

interface PlayerProps {
  player: VideoPlayerRef | null;
  raceInfo: RaceInfo;
  volume: number;
  setVolume: (newVolume: number) => void;
  isMuted: boolean;
  setIsMuted: (newIsMuted: boolean) => void;
  isPaused: boolean;
  layoutControls?: LayoutButtonsProps;
  extraControls?: ReactNode;
}
export const Player = ({
  player,
  raceInfo,
  setVolume,
  volume,
  isMuted,
  setIsMuted,
  isPaused,
  layoutControls,
  extraControls,
}: PlayerProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { isUIVisible, preventHiding } = useViewerUIVisibility();
  const timeoutRef = useRef(-1);
  const [isSpringing, setIsSpringing] = useState(false);

  useEffect(() => {
    if (isUIVisible) {
      clearTimeout(timeoutRef.current);
    } else {
      if (wrapperRef.current?.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
        document.activeElement?.blur();
      }
    }
  }, [isUIVisible]);

  const onDragEnd = useCallback((shouldBeCollapsed: boolean) => {
    setIsSpringing(true);
    setIsCollapsed(shouldBeCollapsed);
  }, []);

  const onClick = useCallback(() => {
    setIsCollapsed((oldIsCollapsed) => !oldIsCollapsed);
  }, []);

  const { isDragging, onMouseDown, isMouseDown } = usePlayerDrag({
    elementRef: wrapperRef,
    onClick,
    onDragEnd,
    playerCollapsedZone: isCollapsed ? PLAYER_COLLAPSED_ZONE_WHEN_COLLAPSED : PLAYER_COLLAPSED_ZONE_WHEN_OPEN,
  });

  // preventHiding is last-writer-wins, so controls inside the bar (e.g. dropdowns calling preventHiding(false)
  // on close) must not release the bar's own hold while it's hovered, paused or dragged.
  const holdsRef = useRef({ isHovered: false, isPaused, isDragging, isChildHolding: false });
  const updatePreventHiding = useCallback(() => {
    const { isHovered, isPaused, isDragging, isChildHolding } = holdsRef.current;
    preventHiding(isHovered || isPaused || isDragging || isChildHolding);
  }, [preventHiding]);

  useEffect(() => {
    holdsRef.current.isPaused = isPaused;
    holdsRef.current.isDragging = isDragging;
    updatePreventHiding();
  }, [isPaused, isDragging, updatePreventHiding]);

  const childrenUIVisibility = useMemo(
    () => ({
      isUIVisible,
      preventHiding: (shouldPrevent: boolean) => {
        holdsRef.current.isChildHolding = shouldPrevent;
        updatePreventHiding();
      },
    }),
    [isUIVisible, updatePreventHiding],
  );

  return (
    <ViewerUIVisibilityContext.Provider value={childrenUIVisibility}>
      {isDragging && <div className={styles.grabbingWrapper} />}
      <div
        onMouseEnter={() => {
          holdsRef.current.isHovered = true;
          updatePreventHiding();
        }}
        onMouseLeave={() => {
          holdsRef.current.isHovered = false;
          updatePreventHiding();
        }}
        className={classNames(styles.wrapper, {
          [styles.isCollapsed]: isCollapsed,
          [styles.isVisible]: isUIVisible,
          [styles.wrapperIsDragging]: isDragging,
          [styles.isSpringing]: isSpringing,
        })}
        ref={wrapperRef}
        onTransitionEnd={(e) => {
          if (e.propertyName === "transform" && isSpringing) {
            setIsSpringing(false);
          }
        }}
      >
        <div className={styles.dragHandlePlaceholder} />
        <button
          className={classNames(styles.dragHandle, { [styles.dragHandleIsDragging]: isDragging || isMouseDown })}
          onMouseDown={onMouseDown}
          onClick={(e) => {
            const isClickByKeyboard = e.detail === 0;
            if (isClickByKeyboard) {
              onClick();
            }
          }}
        >
          <DoubleEllipsisIcon width={20} height={20} />
        </button>

        <div
          className={styles.content}
          ref={(node) => (!isCollapsed ? node?.removeAttribute("inert") : node?.setAttribute("inert", ""))}
        >
          <div className={styles.section}>
            <PlayerRaceInfo raceInfo={raceInfo} />
          </div>
          <div className={classNames(styles.section, styles.middle)}>
            {player != null ? (
              <PlayerControls
                playerRef={player}
                setVolume={setVolume}
                volume={volume}
                isMuted={isMuted}
                setIsMuted={setIsMuted}
                extraControls={extraControls}
              />
            ) : (
              // Keep extra controls (e.g. feed switcher) reachable while there's no player, e.g. when a feed fails
              extraControls != null && <div className={styles.extraControlsWithoutPlayer}>{extraControls}</div>
            )}
          </div>
          {layoutControls != null && (
            <div className={styles.section}>
              <LayoutButtons {...layoutControls} />
            </div>
          )}
        </div>
      </div>
    </ViewerUIVisibilityContext.Provider>
  );
};
