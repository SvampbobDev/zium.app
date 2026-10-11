import { forwardRef, memo, useEffect, useRef, useState } from "react";
import { useStreamVideo } from "../../../hooks/useStreamVideo/useStreamVideo";
import { VideoWindowProps } from "../../../types/VideoWindowBaseProps";
import { setRef } from "../../../utils/setRef";
import { VideoPlayer } from "../../VideoPlayer/VideoPlayer";
import { VideoPlayerRef, VideoPlayerOptions } from "../../VideoPlayer/VideoPlayer.types";
import { VideoWindowWrapper } from "../VideoWindowWrapper/VideoWindowWrapper";
import { NoFeed } from "../NoFeed/NoFeed";
import { FeedError } from "../FeedError/FeedError";
import { StreamVideoError } from "../../../hooks/useStreamVideo/useStreamVideo.utils";
import { SourceButton } from "../../SourceButton/SourceButton";
import { MainGridWindow } from "../../../types/GridWindow";
import { getIconForStreamInfo } from "../../../utils/getIconForStreamInfo";
import {
  VideoWindowButtonsBottomRightWrapper,
  VideoWindowButtonsOnAudioFocusClick,
  VideoWindowButtonsSetClosedCaptions,
  VideoWindowButtonsSetVideoTrack,
  VideoWindowButtonsToggleClosedCaptions,
  VideoWindowButtonsTopLeftWrapper,
  VideoWindowButtonsUpdateFillMode,
} from "../VideoWindowButtons/VideoWindowButtons";
import { MainStreamInfo } from "../../../hooks/useVideoRaceDetails/useVideoRaceDetails.types";
import { ChosenValueType } from "../../../hooks/useStreamPicker/useStreamPicker";
import { useMainStreamTracks } from "../../../hooks/useMainStreamTracks/useMainStreamTracks";

interface MainVideoWindowProps extends VideoWindowProps {
  gridWindow: MainGridWindow;
  onPlayingChange: (isPaused: boolean) => void;
  onWindowAudioFocus: (windowId: string) => void;
  isAudioFocused: boolean;
  volume: number;
  setVolume: (newVolume: number) => void;
  hasOnlyOneStream: boolean;
  onSourceChange: (windowId: string, data: ChosenValueType) => void;
  defaultStreams: MainStreamInfo[];
}

export const MainVideoWindow = memo(
  forwardRef<VideoPlayerRef | null, MainVideoWindowProps>(
    (
      {
        gridWindow,
        streamUrl,
        onPlayingChange,
        isPaused,
        isAudioFocused,
        onWindowAudioFocus,
        volume,
        fillMode,
        updateFillMode,
        hasOnlyOneStream,
        onSourceChange,
        defaultStreams,
      },
      forwardedRef,
    ) => {
      const playerRef = useRef<VideoPlayerRef | null>(null);
      const streamVideoState = useStreamVideo(streamUrl);
      const [playerError, setPlayerError] = useState<unknown>(null);
      const { videoPlayerProps, closedCaptionsProps, videoTrackOptions } = useMainStreamTracks({
        gridWindow,
        streamUrl,
        defaultStreams,
        onSourceChange,
      });

      useEffect(() => {
        setPlayerError(null);
      }, [streamUrl]);

      const ref = (r: VideoPlayerRef | null) => {
        setRef(forwardedRef, r);
        playerRef.current = r;
      };

      const oldTimeRef = useRef<number | null>(null);
      const prevStreamUrlRef = useRef(streamUrl);
      if (prevStreamUrlRef.current !== streamUrl) {
        oldTimeRef.current = playerRef.current?.video.currentTime ?? null;
        prevStreamUrlRef.current = streamUrl;
      }

      const onReady = (videoPlayerRef: VideoPlayerRef) => {
        if (oldTimeRef.current === null) {
          onPlayingChange(false);
        }

        videoPlayerRef.video.addEventListener("pause", () => {
          onPlayingChange(true);
        });

        videoPlayerRef.video.addEventListener("play", () => {
          onPlayingChange(false);
        });
      };

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
        <VideoWindowWrapper>
          <VideoPlayer
            videoStreamInfo={streamVideoState.data}
            options={ADDITIONAL_OPTIONS}
            ref={ref}
            onReady={onReady}
            onError={setPlayerError}
            isPaused={isPaused}
            volume={isAudioFocused ? volume : 0}
            fillMode={fillMode}
            {...videoPlayerProps}
            startAt={oldTimeRef.current ?? undefined}
          />
          <VideoWindowButtonsTopLeftWrapper>
            <SourceButton label="Main stream" icon={getIconForStreamInfo("f1live", "mini")} hideWhenUiHidden />
          </VideoWindowButtonsTopLeftWrapper>
          <VideoWindowButtonsBottomRightWrapper>
            <VideoWindowButtonsUpdateFillMode
              updateFillMode={() => updateFillMode(gridWindow.id, fillMode === "fill" ? "fit" : "fill")}
              fillMode={fillMode}
            />
            {closedCaptionsProps.type === "single" ? (
              <VideoWindowButtonsToggleClosedCaptions {...closedCaptionsProps} />
            ) : (
              <VideoWindowButtonsSetClosedCaptions {...closedCaptionsProps} />
            )}
            {videoTrackOptions != null && <VideoWindowButtonsSetVideoTrack availableVideoTracks={videoTrackOptions} />}
            {!hasOnlyOneStream && (
              <VideoWindowButtonsOnAudioFocusClick
                onAudioFocusClick={() => onWindowAudioFocus(gridWindow.id)}
                isAudioFocused={isAudioFocused}
              />
            )}
          </VideoWindowButtonsBottomRightWrapper>
        </VideoWindowWrapper>
      );
    },
  ),
);

const ADDITIONAL_OPTIONS: VideoPlayerOptions = {
  noBufferUI: true,
};
