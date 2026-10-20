import { describe, expect, it } from "vitest";

import { localAssistantReply } from "@/lib/assistant";

describe("HeartLine assistant safety", () => {
  it("routes red-flag text to emergency care before coaching", () => {
    const reply = localAssistantReply("I have crushing chest pain", "en");
    expect(reply.urgent).toBe(true);
    expect(reply.text).toContain("1122");
  });

  it("routes a crisis-level saved reading even with a calm question", () => {
    const reply = localAssistantReply("What should I do next?", "en", {
      latestReading: { systolic: 181, diastolic: 92 },
    });
    expect(reply.urgent).toBe(true);
    expect(reply.text).toContain("emergency");
  });

  it("never chooses or changes medicine", () => {
    const reply = localAssistantReply("Should I change my medicine dose?", "en");
    expect(reply.urgent).toBe(false);
    expect(reply.text).toContain("cannot choose");
    expect(reply.text).toContain("doctor or pharmacist");
  });

  it("explains one reading without diagnosing the person", () => {
    const reply = localAssistantReply("What does my reading mean?", "en", {
      latestReading: { systolic: 132, diastolic: 86 },
    });
    expect(reply.text).toContain("132/86");
    expect(reply.text).toContain("not a diagnosis");
  });
});
