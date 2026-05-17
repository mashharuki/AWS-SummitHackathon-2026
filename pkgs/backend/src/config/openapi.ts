/**
 * OpenAPI 3.0 specification for Saborou API (U-04)
 *
 * 15 endpoints across 6 resource groups:
 * /health (1) / /auth (2) / /tasks (6) / /tasks/:id/proposal (1)
 * /tasks/:id/honne (1) / /connections (2) / /webhooks (1)
 */
export const openApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "Saborou API",
    version: "1.0.0",
    description:
      "「人をダメにするサービス」— Saborou API. Helps users professionally avoid tasks.",
  },
  servers: [
    { url: "https://api.saborou.example.com", description: "Production" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Cognito JWT (issued by Cognito User Pool)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "NOT_FOUND" },
              message: { type: "string", example: "Task not found" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
      Task: {
        type: "object",
        properties: {
          taskId: { type: "string", example: "01HZF3QJV..." },
          userId: { type: "string" },
          status: { type: "string", enum: ["approved", "deleted"] },
          title: { type: "string", example: "四半期報告書の作成" },
          deadline: { type: "string", format: "date-time", nullable: true },
          requester: { type: "string" },
          description: { type: "string" },
          sourceType: { type: "string", enum: ["slack", "manual"] },
          approvedAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
        required: ["taskId", "userId", "status", "title"],
      },
      TaskCandidate: {
        type: "object",
        properties: {
          candidateId: { type: "string" },
          title: { type: "string" },
          deadline: { type: "string", format: "date-time", nullable: true },
          requester: { type: "string" },
          description: { type: "string" },
          sourceType: { type: "string", enum: ["slack", "manual"] },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          createdAt: { type: "string", format: "date-time" },
        },
        required: ["candidateId", "title", "status"],
      },
      Proposal: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          verdict: {
            type: "string",
            enum: ["can_saboru", "borderline", "must_do"],
          },
          summaryText: { type: "string" },
          reasoning: { type: "array", items: { type: "string" } },
          chatMessage: { type: "string" },
          personaId: { type: "string" },
          evaluatedAt: { type: "string", format: "date-time" },
          nextCheckAt: { type: "string", format: "date-time" },
        },
        required: ["taskId", "verdict", "summaryText"],
      },
      ServiceConnection: {
        type: "object",
        properties: {
          service: { type: "string", enum: ["slack"] },
          status: {
            type: "string",
            enum: ["connected", "disconnected", "token_expired"],
          },
          connectedAt: { type: "string", format: "date-time" },
          expiresAt: { type: "string", format: "date-time", nullable: true },
        },
        required: ["service", "status"],
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        security: [],
        tags: ["System"],
        responses: { "200": { description: "Service is healthy" } },
      },
    },
    "/auth/slack": {
      get: {
        summary: "Initiate Slack OAuth flow",
        tags: ["Auth"],
        responses: { "302": { description: "Redirect to Slack OAuth" } },
      },
    },
    "/auth/slack/callback": {
      get: {
        summary: "Slack OAuth callback",
        security: [],
        tags: ["Auth"],
        parameters: [
          { name: "code", in: "query", schema: { type: "string" } },
          { name: "state", in: "query", schema: { type: "string" } },
          { name: "error", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "302": { description: "Redirect to frontend on success" },
          "400": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/tasks": {
      get: {
        summary: "List approved tasks",
        tags: ["Tasks"],
        responses: {
          "200": {
            description: "Task list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tasks: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Task" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Manually create a task",
        tags: ["Tasks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  deadline: { type: "string", nullable: true },
                  description: { type: "string" },
                },
                required: ["title"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created task",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
          "400": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/tasks/candidates": {
      get: {
        summary: "List pending task candidates",
        tags: ["Tasks"],
        responses: {
          "200": {
            description: "Candidate list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      items: { $ref: "#/components/schemas/TaskCandidate" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/tasks/candidates/{id}/approve": {
      post: {
        summary: "Approve task candidate",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "201": {
            description: "Approved task",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/tasks/candidates/{id}": {
      delete: {
        summary: "Reject task candidate",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": { description: "Rejected" },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/tasks/{id}": {
      get: {
        summary: "Get single task",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Task",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
      patch: {
        summary: "Update task inline",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  deadline: { type: "string", nullable: true },
                  description: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated task",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Task" },
              },
            },
          },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
      delete: {
        summary: "Soft delete task",
        tags: ["Tasks"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "204": { description: "Deleted" },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/tasks/{taskId}/proposal": {
      get: {
        summary: "Get sabori proposal (SSE or JSON)",
        tags: ["Proposals"],
        parameters: [
          {
            name: "taskId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "stream",
            in: "query",
            schema: { type: "boolean" },
            description: "If true, returns SSE stream",
          },
        ],
        responses: {
          "200": {
            description: "Proposal (JSON) or SSE stream",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Proposal" },
              },
              "text/event-stream": { schema: { type: "string" } },
            },
          },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/tasks/{taskId}/honne": {
      post: {
        summary: "Record honne (true feeling) reaction",
        tags: ["Honne"],
        parameters: [
          {
            name: "taskId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["quick_reply"] },
                      content: {
                        type: "string",
                        enum: [
                          "truly_tired",
                          "actually_important",
                          "agree_with_ai",
                          "disagree_with_ai",
                        ],
                      },
                    },
                    required: ["type", "content"],
                  },
                  {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: ["free_text"] },
                      content: { type: "string", minLength: 1, maxLength: 500 },
                    },
                    required: ["type", "content"],
                  },
                ],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Honne recorded. Returns Saboru reply.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    recorded: { type: "boolean" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/schemas/Error" },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/connections": {
      get: {
        summary: "List service connections",
        tags: ["Connections"],
        responses: {
          "200": {
            description: "Connection list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    connections: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ServiceConnection" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/connections/{service}": {
      delete: {
        summary: "Disconnect service",
        tags: ["Connections"],
        parameters: [
          {
            name: "service",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["slack"] },
          },
        ],
        responses: {
          "204": { description: "Disconnected" },
          "400": { $ref: "#/components/schemas/Error" },
          "404": { $ref: "#/components/schemas/Error" },
        },
      },
    },
    "/webhooks/slack": {
      post: {
        summary: "Slack Webhook receiver",
        security: [],
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  challenge: { type: "string" },
                  event: { type: "object" },
                  team_id: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Accepted" },
          "403": { description: "Invalid signature" },
        },
      },
    },
  },
};
