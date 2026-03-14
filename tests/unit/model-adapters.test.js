const {
  buildRequestBody,
  parseResponse,
  getHeaders,
  parseStreamChunk,
} = require("../../srv/model-adapters");

describe("Model Adapters", () => {
  const messages = [
    { role: "system", content: "System prompt" },
    { role: "user", content: "User message" },
  ];
  const modelKey = "test-model";
  const params = { temperature: 0.5, maxTokens: 100 };

  describe("buildRequestBody", () => {
    test("should build request for sap-abap", () => {
      const body = buildRequestBody("sap-abap", messages, modelKey, params);
      expect(body).toHaveProperty(
        "config.modules.prompt_templating.prompt.template",
        messages,
      );
      expect(body).toHaveProperty(
        "config.modules.prompt_templating.model.name",
        modelKey,
      );
      expect(body.config.stream.enabled).toBe(false);
    });

    test("should build request for claude-anthropic", () => {
      const body = buildRequestBody(
        "claude-anthropic",
        messages,
        modelKey,
        params,
      );
      expect(body).toHaveProperty("anthropic_version", "bedrock-2023-05-31");
      expect(body).toHaveProperty("system", "System prompt");
      expect(body.messages).toHaveLength(1); // Only user message
      expect(body.messages[0].role).toBe("user");
    });

    test("should build request for openai-gpt", () => {
      const body = buildRequestBody("openai-gpt", messages, modelKey, params);
      expect(body).toHaveProperty("model", modelKey);
      expect(body.messages).toHaveLength(2);
      expect(body).toHaveProperty("temperature", 0.5);
    });

    test("should handle default/custom as sap-abap", () => {
      const body = buildRequestBody("custom", messages, modelKey, params);
      expect(body).toHaveProperty("config.modules.prompt_templating");
    });
  });

  describe("getHeaders", () => {
    const token = "test-token";
    const resourceGroup = "test-group";

    test("should get headers for sap-abap", () => {
      const headers = getHeaders("sap-abap", token, resourceGroup);
      expect(headers).toHaveProperty("Authorization", `Bearer ${token}`);
      expect(headers).toHaveProperty("AI-Resource-Group", resourceGroup);
    });

    test("should get headers for claude-anthropic", () => {
      const headers = getHeaders("claude-anthropic", token, resourceGroup);
      expect(headers).toHaveProperty("anthropic-version", "2023-06-01");
    });

    test("should get headers for openai-gpt", () => {
      const headers = getHeaders("openai-gpt", token, resourceGroup);
      expect(headers).toHaveProperty("Authorization", `Bearer ${token}`);
      expect(headers).not.toHaveProperty("AI-Resource-Group");
    });
  });

  describe("parseResponse", () => {
    test("should parse sap-abap response", () => {
      const response = { choices: [{ message: { content: "Success" } }] };
      const result = parseResponse("sap-abap", response);
      expect(result).toBe("Success");
    });

    test("should parse openai-gpt response", () => {
      const response = { choices: [{ message: { content: "Success" } }] };
      const result = parseResponse("openai-gpt", response);
      expect(result).toBe("Success");
    });

    test("should parse claude-anthropic response", () => {
      const response = { content: [{ text: "Success" }] };
      const result = parseResponse("claude-anthropic", response);
      expect(result).toBe("Success");
    });
  });

  describe("parseStreamChunk", () => {
    test("should parse sap-abap stream chunk (content)", () => {
      const data = {
        final_result: {
          choices: [
            {
              delta: { content: "Chunk" },
              finish_reason: null,
            },
          ],
        },
      };
      const result = parseStreamChunk("sap-abap", data);
      expect(result).toEqual({ content: "Chunk", done: false });
    });

    test("should parse sap-abap stream chunk (stop)", () => {
      const data = {
        final_result: {
          choices: [
            {
              delta: {},
              finish_reason: "stop",
            },
          ],
        },
      };
      const result = parseStreamChunk("sap-abap", data);
      expect(result.done).toBe(true);
    });

    test("should parse openai-gpt stream chunk", () => {
      const data = {
        choices: [
          {
            delta: { content: "Chunk" },
            finish_reason: null,
          },
        ],
      };
      const result = parseStreamChunk("openai-gpt", data);
      expect(result).toEqual({ content: "Chunk", done: false });
    });
  });
});
