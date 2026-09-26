import { describe, expect, it } from "vitest";
import { P2PSession } from "../p2p-session.js";

/**
 * The level-2 sub-header keeps increasing past 255 instead of wrapping its low byte back to 0.
 *
 * A station reads the sequence as increasing and refuses a connection's frames once the low byte wraps, so the
 * header is counted as one little-endian uint32 from `[00, 03, 02, 01]`. The first 256 headers must stay
 * exactly what a station has always accepted.
 */
/** A level-2 body opens with the GCM tag (16) and nonce (12); the sub-header follows. */
const TAG_AND_NONCE_BYTES = 28;

function subHeaders(frames: number): Buffer[] {
  const session = new P2PSession({ stationSn: "T8000P0000000000", p2pDid: "XXXXXXX-000000-XXXXX" });
  (session as unknown as { level2Key: Buffer }).level2Key = Buffer.alloc(32, 1);
  const encrypt = (session as unknown as { encryptLevel2(plaintext: Buffer): Buffer }).encryptLevel2.bind(session);
  return Array.from({ length: frames }, () =>
    encrypt(Buffer.from("{}")).subarray(TAG_AND_NONCE_BYTES, TAG_AND_NONCE_BYTES + 4),
  );
}

describe("the level-2 sub-header sequence", () => {
  it("is [seq, 03, 02, 01] for the first 256 frames", () => {
    const headers = subHeaders(256);
    expect(headers[0]).toEqual(Buffer.from([0x00, 0x03, 0x02, 0x01]));
    expect(headers[255]).toEqual(Buffer.from([0xff, 0x03, 0x02, 0x01]));
  });

  it("carries into the next byte instead of returning to [00, 03, 02, 01]", () => {
    const headers = subHeaders(258);
    expect(headers[256]).toEqual(Buffer.from([0x00, 0x04, 0x02, 0x01]));
    expect(headers[257]).toEqual(Buffer.from([0x01, 0x04, 0x02, 0x01]));
  });

  it("never repeats a header on one connection", () => {
    const seen = new Set(subHeaders(1024).map((h) => h.toString("hex")));
    expect(seen.size).toBe(1024);
  });
});
