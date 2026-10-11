import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainGridWindow } from "../../types/GridWindow";
import { AudioTrackInfo, TextTrackInfo } from "../../components/VideoPlayer/VideoPlayer.types";
import { DropdownSection, DropdownSectionElement } from "../../components/Dropdown/Dropdown";
import { useHotkeys } from "../useHotkeys/useHotkeys";
import { SHORTCUTS } from "../useHotkeys/useHotkeys.keys";
import { useInternationalStreamMedia } from "../useInternationalStreamMedia/useInternationalStreamMedia";
import { ChosenValueType } from "../useStreamPicker/useStreamPicker";
import { MainStreamInfo, PlaybackUrl } from "../useVideoRaceDetails/useVideoRaceDetails.types";
import { isNotFalse } from "../../utils/isNotFalse";
import { countTotalNumberOfOptions, getTrackPrettyName } from "./useMainStreamTracks.utils";

interface UseMainStreamTracksArguments {
  gridWindow: MainGridWindow;
  streamUrl: PlaybackUrl | null;
  defaultStreams: MainStreamInfo[];
  onSourceChange: (windowId: string, data: ChosenValueType) => void;
}

/**
 * Closed captions and audio/video track state of the main stream, shared by the
 * windowed main video and the single-stream viewer.
 */
export const useMainStreamTracks = ({
  gridWindow,
  streamUrl,
  defaultStreams,
  onSourceChange,
}: UseMainStreamTracksArguments) => {
  const internationalStreamMedia = useInternationalStreamMedia(defaultStreams);
  const [availableSubtitleTracks, setAvailableSubtitleTracks] = useState<TextTrackInfo[]>([]);
  const previousSelectedSubtitleIdRef = useRef<string | null>(null);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string | null>(null);
  const areClosedCaptionsOn = useMemo(() => selectedSubtitleId != null, [selectedSubtitleId]);
  const hasMultipleCaptionsTracks = availableSubtitleTracks.length > 1;

  const [availableAudioTracks, setAvailableAudioTracks] = useState<AudioTrackInfo[]>([]);
  const selectedAudioLanguage = useMemo(() => {
    return gridWindow.streamId === "international" ? (gridWindow.audioLanguage ?? null) : null;
  }, [gridWindow]);

  const selectedAudioTrackId = useMemo(() => {
    if (selectedAudioLanguage == null) return null;
    const selectedAudioTrack = availableAudioTracks.find((track) => track.lang === selectedAudioLanguage);
    return selectedAudioTrack?.id ?? null;
  }, [availableAudioTracks, selectedAudioLanguage]);

  const toggleClosedCaptions = useCallback(() => {
    const toggleClosedCaptionsWithMultipleTracks = () => {
      if (selectedSubtitleId !== null) {
        previousSelectedSubtitleIdRef.current = selectedSubtitleId;
        setSelectedSubtitleId(null);
        return;
      }

      setSelectedSubtitleId(previousSelectedSubtitleIdRef.current ?? availableSubtitleTracks[0]?.id ?? null);
    };
    const toggleClosedCaptionsWithSingleTrack = () => {
      if (areClosedCaptionsOn) {
        setSelectedSubtitleId(null);
        return;
      }

      setSelectedSubtitleId(availableSubtitleTracks[0]?.id ?? null);
    };

    if (hasMultipleCaptionsTracks) {
      toggleClosedCaptionsWithMultipleTracks();
    } else {
      toggleClosedCaptionsWithSingleTrack();
    }
  }, [areClosedCaptionsOn, availableSubtitleTracks, hasMultipleCaptionsTracks, selectedSubtitleId]);

  useHotkeys(
    () => ({
      id: "mainVideo",
      allowPropagation: true,
      hotkeys: [
        {
          keys: SHORTCUTS.TOGGLE_CLOSED_CAPTIONS,
          action: toggleClosedCaptions,
        },
      ],
    }),
    [toggleClosedCaptions],
  );

  useEffect(() => {
    setAvailableSubtitleTracks([]);
    setAvailableAudioTracks([]);
    setSelectedSubtitleId(null);
  }, [streamUrl]);

  const closedCaptionsProps = useMemo(() => {
    if (!hasMultipleCaptionsTracks) {
      return {
        type: "single" as const,
        toggleClosedCaptions,
        areClosedCaptionsOn: areClosedCaptionsOn,
      };
    }

    const onClick = (id: string | null) => () => {
      if (id === null) {
        previousSelectedSubtitleIdRef.current = selectedSubtitleId;
      }

      setSelectedSubtitleId(id);
    };

    return {
      type: "multiple" as const,
      setClosedCaptions: () => undefined,
      availableClosedCaptions: [
        {
          id: "off",
          isActive: selectedSubtitleId === null,
          text: "Off",
          onClick: onClick(null),
        },
        ...availableSubtitleTracks.map((subtitleTrack) => ({
          id: subtitleTrack.id,
          isActive: selectedSubtitleId === subtitleTrack.id,
          text: getTrackPrettyName(subtitleTrack.lang, subtitleTrack.label),
          onClick: onClick(subtitleTrack.id),
        })),
      ],
      areClosedCaptionsOn: selectedSubtitleId !== null,
    };
  }, [
    hasMultipleCaptionsTracks,
    selectedSubtitleId,
    availableSubtitleTracks,
    toggleClosedCaptions,
    areClosedCaptionsOn,
  ]);

  const availableVideoTracks = useMemo((): DropdownSection[] => {
    if (internationalStreamMedia.state !== "done" || internationalStreamMedia.data == null) {
      return [
        {
          id: "root",
          options: defaultStreams.map((stream) => ({
            id: stream.type,
            isActive: stream.type === gridWindow.streamId,
            text: stream.title,
            onClick: () => onSourceChange(gridWindow.id, { type: "main", streamId: stream.type }),
          })),
        },
      ];
    }

    const f1tvStream = defaultStreams.find((stream) => stream.type === "f1live");
    const f1tvStreamElement: DropdownSectionElement | null = f1tvStream
      ? {
          id: f1tvStream.type,
          isActive: f1tvStream.type === gridWindow.streamId,
          text: f1tvStream.title,
          onClick: () => onSourceChange(gridWindow.id, { type: "main", streamId: "f1live" }),
          caption: getTrackPrettyName("eng", ""),
        }
      : null;

    const doesSelectedLanguageExist =
      gridWindow.streamId === "international"
        ? gridWindow.audioLanguage != null && selectedAudioTrackId != null
        : f1tvStream != null;

    const sections = [
      f1tvStreamElement != null && {
        id: "f1live",
        options: [f1tvStreamElement],
      },
      {
        id: "international",
        options: internationalStreamMedia.data.AUDIO.map((media) => ({
          id: media.LANGUAGE,
          isActive: !doesSelectedLanguageExist
            ? media.DEFAULT
            : gridWindow.streamId === "international" && gridWindow.audioLanguage === media.LANGUAGE,
          text: getTrackPrettyName(media.LANGUAGE, media.NAME),
          onClick: () =>
            onSourceChange(gridWindow.id, {
              type: "main",
              streamId: "international",
              audioLanguage: media.LANGUAGE,
            }),
        })),
      },
    ].filter(isNotFalse);

    return sections;
  }, [defaultStreams, gridWindow, internationalStreamMedia, onSourceChange, selectedAudioTrackId]);

  const videoTrackOptions = countTotalNumberOfOptions(availableVideoTracks) > 1 ? availableVideoTracks : null;

  return {
    videoPlayerProps: {
      selectedSubtitleId,
      setAvailableSubtitles: setAvailableSubtitleTracks,
      selectedAudioLanguage,
      setAvailableAudioTracks,
    },
    closedCaptionsProps,
    hasClosedCaptions: availableSubtitleTracks.length > 0,
    videoTrackOptions,
  };
};
