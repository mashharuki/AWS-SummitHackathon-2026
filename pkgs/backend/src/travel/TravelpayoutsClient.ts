import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { z } from "zod";
import type { TravelFlightOption } from "./schemas.js";

const CredentialsSchema = z
  .object({
    apiToken: z.string().trim().min(1).max(500),
    marker: z.string().trim().min(1).max(80),
    trs: z.string().trim().min(1).max(80),
  })
  .strict();

export type TravelpayoutsCredentials = z.infer<typeof CredentialsSchema>;

export type TravelpayoutsClientOptions = {
  credentialsSecretArn?: string;
  fetchFn?: typeof fetch;
  secretsClient?: Pick<SecretsManagerClient, "send">;
};

export class TravelpayoutsClient {
  private credentialsCache?: TravelpayoutsCredentials;
  private readonly fetchFn: typeof fetch;
  private readonly secretsClient: Pick<SecretsManagerClient, "send">;

  constructor(private readonly options: TravelpayoutsClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.secretsClient =
      options.secretsClient ??
      new SecretsManagerClient({
        region: process.env.AWS_REGION ?? "ap-northeast-1",
      });
  }

  async hasCredentials(): Promise<boolean> {
    try {
      await this.getCredentials();
      return true;
    } catch {
      return false;
    }
  }

  async getFlightPricesForDates(input: {
    originIata: string;
    destinationIata: string;
    departureDate: string;
    returnDate: string;
    currency: string;
    travelers: number;
  }): Promise<TravelFlightOption[]> {
    const credentials = await this.getCredentials();
    const url = new URL("https://api.travelpayouts.com/v2/prices/month-matrix");
    url.searchParams.set("origin", input.originIata);
    url.searchParams.set("destination", input.destinationIata);
    url.searchParams.set("currency", input.currency);
    url.searchParams.set("month", input.departureDate.slice(0, 7));
    url.searchParams.set("show_to_affiliates", "true");
    url.searchParams.set("token", credentials.apiToken);

    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(`Travelpayouts flight prices failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      data?: Array<{
        value?: number;
        depart_date?: string;
        return_date?: string;
        airline?: string;
      }>;
    };

    const rows = (json.data ?? [])
      .filter((row) => typeof row.value === "number")
      .slice(0, 3);

    if (rows.length === 0) {
      throw new Error("Travelpayouts flight prices returned no rows");
    }

    return rows.map((row, index) => ({
      rank: index + 1,
      title: `${input.originIata}から${input.destinationIata}への航空券候補 ${index + 1}`,
      price: {
        amount: Math.round((row.value ?? 0) * input.travelers),
        currency: input.currency,
      },
      reason: [
        "Aviasales Data API系のキャッシュ価格をもとにした候補です。",
        row.depart_date ? `出発目安は${row.depart_date}です。` : "",
        row.airline ? `航空会社コードは${row.airline}です。` : "",
      ]
        .filter(Boolean)
        .join(" "),
      bookingUrl: null,
    }));
  }

  async createPartnerLinks(
    urls: string[],
    subId: string,
  ): Promise<Array<string | null>> {
    const credentials = await this.getCredentials();

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const partnerUrl = new URL(
            "https://www.travelpayouts.com/widgets_suggest_params",
          );
          partnerUrl.searchParams.set("url", url);
          partnerUrl.searchParams.set("marker", credentials.marker);
          partnerUrl.searchParams.set("trs", credentials.trs);
          partnerUrl.searchParams.set("sub_id", subId);

          const response = await this.fetchFn(partnerUrl);
          if (!response.ok) return null;
          const body = (await response.json()) as { url?: string };
          return typeof body.url === "string" ? body.url : null;
        } catch {
          return null;
        }
      }),
    );

    return results;
  }

  private async getCredentials(): Promise<TravelpayoutsCredentials> {
    if (this.credentialsCache) return this.credentialsCache;

    if (!this.options.credentialsSecretArn) {
      throw new Error("Travelpayouts credentials secret ARN is not configured");
    }

    const result = await this.secretsClient.send(
      new GetSecretValueCommand({
        SecretId: this.options.credentialsSecretArn,
      }),
    );
    if (!result.SecretString) {
      throw new Error("Travelpayouts credentials secret has no SecretString");
    }

    this.credentialsCache = CredentialsSchema.parse(
      JSON.parse(result.SecretString),
    );
    return this.credentialsCache;
  }
}
