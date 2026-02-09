import { SpeakerWithUrl } from "../services/input.service.js";

export function getSpeakersFixture(): [SpeakerWithUrl, ...SpeakerWithUrl[]] {
  return [
    { name: "Speaker One", url: "https://example.com/speaker1" },
    { name: "Speaker Two", url: "https://example.com/speaker2" },
  ];
}
