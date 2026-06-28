import { PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";
import { TravelItineraryPublisher } from "../../travel/TravelItineraryPublisher.js";

describe("TravelItineraryPublisher", () => {
  it("uploads HTML with safe metadata and returns the public URL", async () => {
    const commands: unknown[] = [];
    const publisher = new TravelItineraryPublisher({
      s3BucketName: "itinerary-bucket",
      publicBaseUrl: "https://travel.example.com/",
      now: () => new Date("2026-07-10T00:00:00Z"),
      randomUUID: () => "uuid-123",
      s3Client: {
        send: async (command) => {
          commands.push(command);
          return {};
        },
      },
    });

    const result = await publisher.publishHtml("<html>ok</html>");

    expect(result).toEqual({
      objectKey: "travel-itineraries/2026/07/10/uuid-123.html",
      url: "https://travel.example.com/travel-itineraries/2026/07/10/uuid-123.html",
    });
    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(PutObjectCommand);
    expect((commands[0] as PutObjectCommand).input).toMatchObject({
      Bucket: "itinerary-bucket",
      Key: "travel-itineraries/2026/07/10/uuid-123.html",
      Body: "<html>ok</html>",
      ContentType: "text/html; charset=utf-8",
      ContentDisposition: "inline",
      CacheControl: "private, max-age=300",
    });
  });
});
