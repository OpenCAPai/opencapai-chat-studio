const cds = require("@sap/cds");
const https = require("https");
const { encrypt } = require("./crypto-utils");
const {
  buildRequestBody,
  parseResponse,
  getHeaders,
} = require("./model-adapters");

module.exports = class ChatService extends cds.ApplicationService {
  async init() {
    const { Conversations, Messages, Models, OAuth2Providers } = this.entities;

    this.aiCoreConfig = {
      endpoint: process.env.AICORE_ENDPOINT || "",
      resourceGroup: process.env.AICORE_RESOURCE_GROUP || "default",
      token: process.env.AICORE_TOKEN || "",
    };

    this.on("getUserInfo", (req) => {
      const user = req.user;

      if (!user || user.id === "anonymous" || !user.id) {
        return {
          id: "local-dev",
          name: "Local Developer",
          email: "developer@localhost",
          roles: ["Developer", "Admin"],
        };
      }

      return {
        id: user.id,
        name: user.attr?.name || user.id,
        email: user.attr?.email || `${user.id}@company.com`,
        roles: user.roles || ["User"],
      };
    });

    this.on("getAICoreConfig", () => {
      return this.aiCoreConfig;
    });

    this.on("saveAICoreConfig", (req) => {
      const { endpoint, resourceGroup, token } = req.data;
      this.aiCoreConfig = {
        endpoint: endpoint || "",
        resourceGroup: resourceGroup || "default",
        token: token ? encrypt(token) : "",
      };
      return {
        endpoint: this.aiCoreConfig.endpoint,
        resourceGroup: this.aiCoreConfig.resourceGroup,
        token: token || "",
      };
    });

    this.on("validateDeploymentUrl", (req) => {
      const { url, modelCategory } = req.data;

      if (!url) {
        return {
          valid: false,
          message: "URL is required",
          suggestedUrl: "",
        };
      }

      let expectedSuffix = "";
      let categoryName = "";

      switch (modelCategory) {
        case "claude-anthropic":
          expectedSuffix = "/invoke";
          categoryName = "Claude Anthropic";
          break;
        case "sap-abap":
          expectedSuffix = "/v2/completion";
          categoryName = "SAP ABAP";
          break;
        case "openai-gpt":
          return {
            valid: true,
            message: "OpenAI URL format is valid",
            suggestedUrl: url,
          };
        default:
          return {
            valid: true,
            message: "Custom model - no validation applied",
            suggestedUrl: url,
          };
      }

      if (url.endsWith(expectedSuffix)) {
        return {
          valid: true,
          message: `URL is correctly formatted for ${categoryName}`,
          suggestedUrl: url,
        };
      } else {
        const suggestedUrl = url.replace(/\/$/, "") + expectedSuffix;
        return {
          valid: false,
          message: `URL should end with '${expectedSuffix}' for ${categoryName} models`,
          suggestedUrl: suggestedUrl,
        };
      }
    });

    this.on("createModel", async (req) => {
      const { clientSecret, ...otherData } = req.data;
      const encryptedClientSecret = clientSecret ? encrypt(clientSecret) : "";

      const modelData = {
        modelKey: otherData.key,
        name: otherData.name,
        modelCategory: otherData.modelCategory || "sap-abap",
        deploymentUrl: otherData.deploymentUrl,
        systemPrompt: otherData.systemPrompt || "",
        authType: otherData.authType || "bearer",
        tokenUrl: otherData.tokenUrl || "",
        clientId: otherData.clientId || "",
        clientSecret: encryptedClientSecret,
        scope: otherData.scope || "",
        temperature:
          otherData.temperature !== undefined ? otherData.temperature : 0.7,
        maxTokens: otherData.maxTokens || 2000,
        topP: otherData.topP !== undefined ? otherData.topP : 1.0,
        frequencyPenalty:
          otherData.frequencyPenalty !== undefined
            ? otherData.frequencyPenalty
            : 0.0,
        presencePenalty:
          otherData.presencePenalty !== undefined
            ? otherData.presencePenalty
            : 0.0,
      };

      if (otherData.oauth2ProviderId) {
        modelData.oauth2Provider_ID = otherData.oauth2ProviderId;
      }

      await INSERT.into(Models).entries(modelData);
      return await SELECT.one.from(Models).where({ modelKey: otherData.key });
    });

    this.on("updateModel", async (req) => {
      const { ID, clientSecret, ...otherData } = req.data;

      const updateData = {
        name: otherData.name,
        modelCategory: otherData.modelCategory || "sap-abap",
        deploymentUrl: otherData.deploymentUrl,
        systemPrompt: otherData.systemPrompt || "",
        authType: otherData.authType || "bearer",
        tokenUrl: otherData.tokenUrl || "",
        clientId: otherData.clientId || "",
        scope: otherData.scope || "",
        temperature:
          otherData.temperature !== undefined ? otherData.temperature : 0.7,
        maxTokens: otherData.maxTokens || 2000,
        topP: otherData.topP !== undefined ? otherData.topP : 1.0,
        frequencyPenalty:
          otherData.frequencyPenalty !== undefined
            ? otherData.frequencyPenalty
            : 0.0,
        presencePenalty:
          otherData.presencePenalty !== undefined
            ? otherData.presencePenalty
            : 0.0,
      };

      if (clientSecret) {
        updateData.clientSecret = encrypt(clientSecret);
      }

      await UPDATE(Models).set(updateData).where({ ID });
      return await SELECT.one.from(Models).where({ ID });
    });

    this.on("deleteModel", async (req) => {
      await DELETE.from(Models).where({ ID: req.data.ID });
      return true;
    });

    this.on("createOAuth2Provider", async (req) => {
      const { clientSecret, ...otherData } = req.data;
      const encryptedClientSecret = clientSecret ? encrypt(clientSecret) : "";

      await INSERT.into(OAuth2Providers).entries({
        ...otherData,
        clientSecret: encryptedClientSecret,
        scope: otherData.scope || "",
        description: otherData.description || "",
      });

      return await SELECT.one
        .from(OAuth2Providers)
        .where({ name: otherData.name });
    });

    this.on("updateOAuth2Provider", async (req) => {
      const { ID, clientSecret, ...otherData } = req.data;

      const updateData = {
        ...otherData,
        scope: otherData.scope || "",
        description: otherData.description || "",
      };

      if (clientSecret) {
        updateData.clientSecret = encrypt(clientSecret);
      }

      await UPDATE(OAuth2Providers).set(updateData).where({ ID });
      return await SELECT.one.from(OAuth2Providers).where({ ID });
    });

    this.on("deleteOAuth2Provider", async (req) => {
      await DELETE.from(OAuth2Providers).where({ ID: req.data.ID });
      return true;
    });

    this.on("exportConversation", async (req) => {
      const { conversationId } = req.data;

      const conversation = await SELECT.one
        .from(Conversations)
        .where({ ID: conversationId })
        .columns(["ID", "title", "model", "createdAt", "modifiedAt"]);

      if (!conversation) throw new Error("Conversation not found");

      const messages = await SELECT.from(Messages)
        .where({ conversation_ID: conversationId })
        .orderBy("createdAt");

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        conversation: {
          title: conversation.title,
          model: conversation.model,
          createdAt: conversation.createdAt,
          modifiedAt: conversation.modifiedAt,
        },
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          isEdited: m.isEdited,
          editedAt: m.editedAt,
        })),
      };

      return JSON.stringify(exportData, null, 2);
    });

    this.on("importConversation", async (req) => {
      let importData;
      try {
        importData = JSON.parse(req.data.data);
      } catch (e) {
        throw new Error("Invalid JSON format");
      }

      if (!importData.conversation || !importData.messages) {
        throw new Error("Invalid conversation data format");
      }

      const importedTitle = `${importData.conversation.title} (Imported)`;
      await INSERT.into(Conversations).entries({
        title: importedTitle,
        model: importData.conversation.model,
      });

      const conversation = await SELECT.one
        .from(Conversations)
        .where({ title: importedTitle })
        .orderBy({ createdAt: "desc" });

      for (const msg of importData.messages) {
        await INSERT.into(Messages).entries({
          conversation_ID: conversation.ID,
          role: msg.role,
          content: msg.content,
          isEdited: msg.isEdited || false,
          editedAt: msg.editedAt || null,
        });
      }

      return conversation;
    });

    this.on("sendMessage", async (req) => {
      const { conversationId, text, model } = req.data;
      if (!text) throw new Error("Message text is required");

      let conversation;
      if (conversationId) {
        conversation = await SELECT.one
          .from(Conversations)
          .where({ ID: conversationId });
      }

      if (!conversation) {
        await INSERT.into(Conversations).entries({
          title: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
          model: model || "default",
        });
        conversation = await SELECT.one
          .from(Conversations)
          .orderBy({ createdAt: "desc" });
      } else if (model && conversation.model !== model) {
        await UPDATE(Conversations)
          .set({ model: model })
          .where({ ID: conversation.ID });
        conversation.model = model;
      }

      const currentModelKey = conversation.model;

      await INSERT.into(Messages).entries({
        conversation_ID: conversation.ID,
        role: "user",
        content: text,
      });

      const history = await SELECT.from(Messages)
        .where({ conversation_ID: conversation.ID })
        .orderBy("createdAt");

      const modelConfig = await SELECT.one
        .from(Models)
        .where({ modelKey: currentModelKey });

      const config = {
        deploymentUrl: modelConfig?.deploymentUrl || this.aiCoreConfig.endpoint,
        resourceGroup: this.aiCoreConfig.resourceGroup,
        token: this.aiCoreConfig.token,
        modelCategory: modelConfig?.modelCategory || "sap-abap",
        systemPrompt:
          modelConfig?.systemPrompt || "You are a helpful assistant.",
        params: {
          temperature: modelConfig?.temperature,
          maxTokens: modelConfig?.maxTokens,
          topP: modelConfig?.topP,
          frequencyPenalty: modelConfig?.frequencyPenalty,
          presencePenalty: modelConfig?.presencePenalty,
        },
      };

      const llmMessages = [
        { role: "system", content: config.systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];

      let aiResponseContent = "";
      try {
        aiResponseContent = await this._callAIService(
          config,
          llmMessages,
          currentModelKey,
        );
      } catch (error) {
        console.error("AI Service Error:", error);
        aiResponseContent = `Error calling AI service: ${error.message}`;
      }

      const assistantMessage = await INSERT.into(Messages).entries({
        conversation_ID: conversation.ID,
        role: "assistant",
        content: aiResponseContent,
      });

      return assistantMessage;
    });

    this.on("editMessage", async (req) => {
      const { messageId, newContent } = req.data;
      const message = await SELECT.one.from(Messages).where({ ID: messageId });
      if (!message) throw new Error("Message not found");

      const updateData = {
        content: newContent,
        isEdited: true,
        editedAt: new Date().toISOString(),
      };

      if (!message.isEdited) {
        updateData.originalContent = message.content;
      }

      await UPDATE(Messages).set(updateData).where({ ID: messageId });
      return await SELECT.one.from(Messages).where({ ID: messageId });
    });

    this.on("regenerateMessage", async (req) => {
      const { messageId } = req.data;
      const message = await SELECT.one.from(Messages).where({ ID: messageId });

      if (!message || message.role !== "assistant") {
        throw new Error("Can only regenerate assistant messages");
      }

      const conversationId = message.conversation_ID;
      const allMessages = await SELECT.from(Messages)
        .where({ conversation_ID: conversationId })
        .orderBy("createdAt");

      const msgIndex = allMessages.findIndex((m) => m.ID === messageId);
      if (msgIndex <= 0) throw new Error("No preceding user message found");

      await DELETE.from(Messages).where({ ID: messageId });

      const conversation = await SELECT.one
        .from(Conversations)
        .where({ ID: conversationId });
      const currentModelKey = conversation.model;

      const history = await SELECT.from(Messages)
        .where({ conversation_ID: conversationId })
        .orderBy("createdAt");

      const modelConfig = await SELECT.one
        .from(Models)
        .where({ modelKey: currentModelKey });

      const config = {
        deploymentUrl: modelConfig?.deploymentUrl || this.aiCoreConfig.endpoint,
        token: this.aiCoreConfig.token,
        resourceGroup: this.aiCoreConfig.resourceGroup,
        modelCategory: modelConfig?.modelCategory || "sap-abap",
        systemPrompt:
          modelConfig?.systemPrompt || "You are a helpful assistant.",
        params: {
          temperature: modelConfig?.temperature,
          maxTokens: modelConfig?.maxTokens,
        },
      };

      const llmMessages = [
        { role: "system", content: config.systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];

      let aiResponseContent = "";
      try {
        aiResponseContent = await this._callAIService(
          config,
          llmMessages,
          currentModelKey,
        );
      } catch (error) {
        aiResponseContent = `Error regenerating: ${error.message}`;
      }

      await INSERT.into(Messages).entries({
        conversation_ID: conversationId,
        role: "assistant",
        content: aiResponseContent,
      });

      return await SELECT.one
        .from(Messages)
        .where({ conversation_ID: conversationId })
        .orderBy({ createdAt: "desc" });
    });

    await super.init();
  }

  async _callAIService(config, messages, modelKey) {
    const requestBody = buildRequestBody(
      config.modelCategory,
      messages,
      modelKey,
      config.params,
      false,
    );
    const headers = getHeaders(
      config.modelCategory,
      config.token,
      config.resourceGroup,
    );

    let url = config.deploymentUrl;

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: headers,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`API returned ${res.statusCode}: ${data}`));
          } else {
            try {
              const json = JSON.parse(data);
              const content = parseResponse(config.modelCategory, json);
              resolve(content);
            } catch (e) {
              reject(new Error("Failed to parse response"));
            }
          }
        });
      });

      req.on("error", (e) => reject(e));
      req.write(JSON.stringify(requestBody));
      req.end();
    });
  }
};
