// A basic OpenAPI document
export const openApiDoc = {
  openapi: "3.0.0", // This is the required version field
  info: {
    title: "SABORO API Documentation",
    version: "1.0.0",
    description: "API documentation for the SABORO service",
  },
  paths: {
    // Add your API paths here
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "OK",
          },
        },
      },
    },
    // Add more endpoints as needed
  },
};
