import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import deepEqual from "fast-deep-equal/es6";
import { MainGridWindow } from "../../../types/GridWindow";
import { RaceInfo, StreamsStateStreamsData } from "../../../hooks/useVideoRaceDetails/useVideoRaceDetails.types";
import { ChosenValueType } from "../../../hooks/useStreamPicker/useStreamPicker";
import { useStreamVideo } from "../../../hooks/useStreamVideo/useStreamVideo";
import { StreamVideoError } from "../../../hooks/useStreamVideo/useStreamVideo.utils";
import { useMainStreamTracks } from "../../../hooks/useMainStreamTracks/useMainStreamTracks";
import { VideoPlayer } from "../../../components/VideoPlayer/VideoPlayer";
import { VideoPlayerOptions, VideoPlayerRef } from "../../../components/VideoPlayer/VideoPlayer.types";
import { NoFeed } from "../../../components/VideoWindow/NoFeed/NoFeed";
import { FeedError } from "../../../components/VideoWindow/FeedError/FeedError";
import {
  VideoWindowButtonsSetClosedCaptions,
  VideoWindowButtonsSetVideoTrack,
  VideoWindowButtonsToggleClosedCaptions,
} from "../../../components/VideoWindow/VideoWindowButtons/VideoWindowButtons";
import { Player } from "../../../components/Player/Player";
import { CookieBanner } from "../../../components/CookieBanner/CookieBanner";
import { GlobalShortcutsSnackbar } from "../../../components/ShortcutsSnackbar/ShortcutsSnackbar";
import { toggleFullScreen } from "../../../utils/toggleFullScreen";
import { useVideoAudio } from "../hooks/useVideoAudio";
import { useGlobalShortcuts } from "../hooks/useGlobalShortcuts";
import { useNotifyAboutNewEvent } from "../hooks/useNotifyAboutNewEvent/useNotifyAboutNewEvent";
import styles from "./SingleStreamViewer.module.scss";

const SINGLE_STREAM_WINDOW_ID = "single-stream";

interface SingleStreamViewerProps {
  streams: StreamsStateStreamsData;
  isLive: boolean;
  raceInfo: RaceInfo;
  raceId: string;
}

export const SingleStreamViewer = memo(({ streams, isLive, raceInfo, raceId }: SingleStreamViewerProps) => {
  const [mainWindow, setMainWindow] = useState<MainGridWindow>(() => ({
    id: SINGLE_STREAM_WINDOW_ID,
    type: "main",
    streamId: streams.defaultStreams.some((stream) => stream.type === "f1live") ? "f1live" : "international",
  }));
  const windows = useMemo(() => [mainWindow], [mainWindow]);
  const [isPaused, setIsPaused] = useState(!isLive);
  const [player, setPlayer] = useState<VideoPlayerRef | null>(null);
  const [playerError, setPlayerError] = useState<unknown>(null);
  const { volume, internalVolume, setVolume, isMuted, setIsMuted } = useVideoAudio({ windows });

  const streamUrl = useMemo(
    () => streams.defaultStreams.find((stream) => stream.type === mainWindow.streamId)?.playbackUrl ?? null,
    [mainWindow.streamId, streams.defaultStreams],
  );
  const streamVideoState = useStreamVideo(streamUrl);

  const onSourceChange = useCallback((_windowId: string, data: ChosenValueType) => {
    if (data.type !== "main") {
      return;
    }

    setMainWindow(
      data.streamId === "international"
        ? { id: SINGLE_STREAM_WINDOW_ID, type: "main", streamId: "international", audioLanguage: data.audioLanguage }
        : { id: SINGLE_STREAM_WINDOW_ID, type: "main", streamId: "f1live" },
    );
  }, []);

  const { videoPlayerProps, closedCaptionsProps, hasClosedCaptions, videoTrackOptions } = useMainStreamTracks({
    gridWindow: mainWindow,
    streamUrl,
    defaultStreams: streams.defaultStreams,
    onSourceChange,
  });

  useEffect(function closeFullScreenWhenLeavingViewer() {
    return () => {
      if (document.fullscreenElement) {
        toggleFullScreen();
      }
    };
  }, []);

  useEffect(() => {
    setPlayerError(null);
  }, [streamUrl]);

  // Keep the playback position when switching between F1 Live and International
  const playerRef = useRef<VideoPlayerRef | null>(null);
  const oldTimeRef = useRef<number | null>(null);
  const prevStreamUrlRef = useRef(streamUrl);
  if (prevStreamUrlRef.current !== streamUrl) {
    oldTimeRef.current = playerRef.current?.video.currentTime ?? null;
    prevStreamUrlRef.current = streamUrl;
  }

  const ref = useCallback((r: VideoPlayerRef | null) => {
    playerRef.current = r;
    setPlayer(r);
  }, []);

  const onReady = (videoPlayerRef: VideoPlayerRef) => {
    if (oldTimeRef.current === null) {
      setIsPaused(false);
    }

    videoPlayerRef.video.addEventListener("pause", () => setIsPaused(true));
    videoPlayerRef.video.addEventListener("play", () => setIsPaused(false));
  };

  useGlobalShortcuts(player, setIsPaused, setIsMuted);
  useNotifyAboutNewEvent(raceId);

  const getContent = () => {
    if (streamVideoState.state === "loading") {
      return null;
    }

    if (
      streamVideoState.state === "error" &&
      streamVideoState.error instanceof StreamVideoError &&
      streamVideoState.error.type === "NO_PLAYBACK_URL"
    ) {
      return <NoFeed />;
    }

    if (streamVideoState.state === "error") {
      return <FeedError error={streamVideoState.error} />;
    }

    if (playerError != null) {
      return <FeedError error={playerError} />;
    }

    return (
      <VideoPlayer
        videoStreamInfo={streamVideoState.data}
        options={PLAYER_OPTIONS}
        ref={ref}
        onReady={onReady}
        onError={setPlayerError}
        isPaused={isPaused}
        volume={volume}
        fillMode="fit"
        {...videoPlayerProps}
        startAt={oldTimeRef.current ?? undefined}
      />
    );
  };

  const extraControls = (
    <>
      {videoTrackOptions != null && (
        <VideoWindowButtonsSetVideoTrack availableVideoTracks={videoTrackOptions} variant="Tertiary" />
      )}
      {hasClosedCaptions &&
        (closedCaptionsProps.type === "single" ? (
          <VideoWindowButtonsToggleClosedCaptions {...closedCaptionsProps} variant="Tertiary" />
        ) : (
          <VideoWindowButtonsSetClosedCaptions {...closedCaptionsProps} variant="Tertiary" />
        ))}
    </>
  );

  return (
    <div className={styles.wrapper}>
      <CookieBanner position="top" mode="fixed" />
      <div className={styles.videoWrapper}>{getContent()}</div>
      <Player
        player={player}
        raceInfo={raceInfo}
        setVolume={setVolume}
        volume={internalVolume}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        isPaused={isPaused}
        extraControls={extraControls}
      />
      <GlobalShortcutsSnackbar />
    </div>
  );
}, deepEqual);

const PLAYER_OPTIONS: VideoPlayerOptions = {
  noBufferUI: true,
};

export default SingleStreamViewer;
