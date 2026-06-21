import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";

export type TravelItineraryPublisherOptions = {
  s3BucketName: string;
  publicBaseUrl: string;
  s3Client: Pick<S3Client, "send">;
  now?: () => Date;
  randomUUID?: () => string;
};

export type PublishedTravelItinerary = {
  url: string;
  objectKey: string;
};

export class TravelItineraryPublisher {
  private readonly now: () => Date;
  private readonly randomUUID: () => string;
  private readonly publicBaseUrl: string;

  constructor(private readonly options: TravelItineraryPublisherOptions) {
    this.now = options.now ?? (() => new Date());
    this.randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/+$/, "");
  }

  async publishHtml(html: string): Promise<PublishedTravelItinerary> {
    const objectKey = this.createObjectKey();
    await this.options.s3Client.send(
      new PutObjectCommand({
        Bucket: this.options.s3BucketName,
        Key: objectKey,
        Body: html,
        ContentType: "text/html; charset=utf-8",
        ContentDisposition: "inline",
        CacheControl: "private, max-age=300",
      }),
    );

    return {
      objectKey,
      url: `${this.publicBaseUrl}/${objectKey}`,
    };
  }

  private createObjectKey(): string {
    const date = this.now();
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `travel-itineraries/${yyyy}/${mm}/${dd}/${this.randomUUID()}.html`;
  }
}
