import { HosterWithUrl } from "../services/input.service.js";

export function getHostersFixture(): [HosterWithUrl, ...HosterWithUrl[]] {
  return [
    { name: "Hoster 1", url: "https://example.com/hoster1" },
    { name: "Hoster 2", url: "https://example.com/hoster2" },
  ];
}
