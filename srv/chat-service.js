const cds = require("@sap/cds");
const https = require("https");
const http = require("http");
const { encrypt, decrypt, isEncrypted } = require("./crypto-utils");
const { buildRequestBody, parseResponse, parseStreamChunk, getHeaders } = require("./model-adapters");

let aiCoreConfig = {
  endpoint: process.env.AICORE_ENDPOINT || "",
  resourceGroup: process.env.AICORE_RESOURCE_GROUP || "default",
  token: process.env.AICORE_TOKEN || "",
};

module.exports = class ChatService extends cds.ApplicationService {
  async init() {
    const { Conversations, Messages, Models, OAuth2Providers } = this.entities;

    this.on("getUserInfo", async (req) => {
      const user = req.user;

      if (!user || user.id === "anonymous" || !user.id) {
        return {
          id: "local-dev",
          name: "Local Developer",
          email: "developer@localhost",
          roles: ["Developer", "Admin"]
        };
      }

      return {
        id: user.id,
        name: user.attr?.name || user.id,
        email: user.attr?.email || `${user.id}@company.com`,
        roles: user.roles || ["User"]
      };
    });

    this.on("validateDeploymentUrl", async (req) => {
      const { url, modelCategory } = req.data;

      if (!url) {
        return {
          valid: false,
          message: "URL is required",
          suggestedUrl: ""
        };
      }

      let expectedSuffix = "";
      let categoryName = "";

      switch (modelCategory) {
        case 'claude-anthropic':
          expectedSuffix = "/invoke";
          categoryName = "Claude Anthropic";
          break;
        case 'sap-abap':
          expectedSuffix = "/v2/completion";
          categoryName = "SAP ABAP";
          break;
        case 'openai-gpt':
          return {
            valid: true,
            message: "OpenAI URL format is valid",
            suggestedUrl: url
          };
        default:
          return {
            valid: true,
            message: "Custom model - no validation applied",
            suggestedUrl: url
          };
      }

      const endsWithSuffix = url.endsWith(expectedSuffix);

      if (endsWithSuffix) {
        return {
          valid: true,
          message: `URL is correctly formatted for ${categoryName}`,
          suggestedUrl: url
        };
      } else {
        const suggestedUrl = url.replace(/\/$/, '') + expectedSuffix;
        return {
          valid: false,
          message: `URL should end with '${expectedSuffix}' for ${categoryName} models`,
          suggestedUrl: suggestedUrl
        };
      }
    });

    this.on("createOAuth2Provider", async (req) => {
      const { name, tokenUrl, clientId, clientSecret, scope, description } = req.data;

      const encryptedClientSecret = clientSecret ? encrypt(clientSecret) : "";

      await INSERT.into(OAuth2Providers).entries({
        name,
        tokenUrl,
        clientId,
        clientSecret: encryptedClientSecret,
        scope: scope || "",
        description: description || ""
      });

      const created = await SELECT.one.from(OAuth2Providers).where({ name });
      return created;
    });

    this.on("updateOAuth2Provider", async (req) => {
      const { ID, name, tokenUrl, clientId, clientSecret, scope, description } = req.data;

      const updateData = {
        name,
        tokenUrl,
        clientId,
        scope: scope || "",
        description: description || ""
      };

      if (clientSecret) {
        updateData.clientSecret = encrypt(clientSecret);
      }

      await UPDATE(OAuth2Providers).set(updateData).where({ ID });
      return await SELECT.one.from(OAuth2Providers).where({ ID });
    });

    this.on("deleteOAuth2Provider", async (req) => {
      const { ID } = req.data;
      await DELETE.from(OAuth2Providers).where({ ID });
      return true;
    });

    this.on("getAICoreConfig", async (req) => {
      return aiCoreConfig;
    });

    this.on("saveAICoreConfig", async (req) => {
      const { endpoint, resourceGroup, token } = req.data;
      aiCoreConfig = {
        endpoint: endpoint || "",
        resourceGroup: resourceGroup || "default",
        token: token ? encrypt(token) : "",
      };
      return {
        endpoint: aiCoreConfig.endpoint,
        resourceGroup: aiCoreConfig.resourceGroup,
        token: token || "",
      };
    });

    this.on("createModel", async (req) => {
      const {
        key,
        name,
        modelCategory,
        deploymentUrl,
        systemPrompt,
        authType,
        tokenUrl,
        clientId,
        clientSecret,
        scope,
        oauth2ProviderId,
        temperature,
        maxTokens,
        topP,
        frequencyPenalty,
        presencePenalty,
      } = req.data;

      const encryptedClientSecret = clientSecret ? encrypt(clientSecret) : "";

      const modelData = {
        modelKey: key,
        name,
        modelCategory: modelCategory || "sap-abap",
        deploymentUrl,
        systemPrompt: systemPrompt || "",
        authType: authType || "bearer",
        tokenUrl: tokenUrl || "",
        clientId: clientId || "",
        clientSecret: encryptedClientSecret,
        scope: scope || "",
        temperature: temperature !== undefined ? temperature : 0.7,
        maxTokens: maxTokens || 2000,
        topP: topP !== undefined ? topP : 1.0,
        frequencyPenalty: frequencyPenalty !== undefined ? frequencyPenalty : 0.0,
        presencePenalty: presencePenalty !== undefined ? presencePenalty : 0.0,
      };

      if (oauth2ProviderId) {
        modelData.oauth2Provider_ID = oauth2ProviderId;
      }

      await INSERT.into(Models).entries(modelData);

      const createdModel = await SELECT.one.from(Models).where({ modelKey: key });
      return createdModel;
    });

    this.on("updateModel", async (req) => {
      const {
        ID,
        name,
        modelCategory,
        deploymentUrl,
        systemPrompt,
        authType,
        tokenUrl,
        clientId,
        clientSecret,
        scope,
        temperature,
        maxTokens,
        topP,
        frequencyPenalty,
        presencePenalty,
      } = req.data;

      const updateData = {
        name,
        modelCategory: modelCategory || "sap-abap",
        deploymentUrl,
        systemPrompt: systemPrompt || "",
        authType: authType || "bearer",
        tokenUrl: tokenUrl || "",
        clientId: clientId || "",
        scope: scope || "",
        temperature: temperature !== undefined ? temperature : 0.7,
        maxTokens: maxTokens || 2000,
        topP: topP !== undefined ? topP : 1.0,
        frequencyPenalty: frequencyPenalty !== undefined ? frequencyPenalty : 0.0,
        presencePenalty: presencePenalty !== undefined ? presencePenalty : 0.0,
      };

      if (clientSecret) {
        updateData.clientSecret = encrypt(clientSecret);
      }

      await UPDATE(Models).set(updateData).where({ ID });

      return await SELECT.one.from(Models).where({ ID });
    });

    this.on("deleteModel", async (req) => {
      const { ID } = req.data;
      await DELETE.from(Models).where({ ID });
      return true;
    });

    this.on("exportConversation", async (req) => {
      const { conversationId } = req.data;

      const conversation = await SELECT.one.from(Conversations)
        .where({ ID: conversationId })
        .columns(['ID', 'title', 'model', 'createdAt', 'modifiedAt']);

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      const messages = await SELECT.from(Messages)
        .where({ conversation_ID: conversationId })
        .orderBy('createdAt');

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        conversation: {
          title: conversation.title,
          model: conversation.model,
          createdAt: conversation.createdAt,
          modifiedAt: conversation.modifiedAt,
        },
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          isEdited: m.isEdited,
          editedAt: m.editedAt,
        }))
      };

      return JSON.stringify(exportData, null, 2);
    });

    this.on("importConversation", async (req) => {
      const { data } = req.data;

      let importData;
      try {
        importData = JSON.parse(data);
      } catch (error) {
        throw new Error("Invalid JSON format");
      }

      if (!importData.conversation || !importData.messages) {
        throw new Error("Invalid conversation data format");
      }

      const newConv = await INSERT.into(Conversations).entries({
        title: importData.conversation.title + " (Imported)",
        model: importData.conversation.model,
      });

      const conversations = await SELECT.from(Conversations)
        .where({ title: importData.conversation.title + " (Imported)" })
        .orderBy({ createdAt: 'desc' })
        .limit(1);

      const conversationId = conversations[0].ID;

      for (const msg of importData.messages) {
        await INSERT.into(Messages).entries({
          conversation_ID: conversationId,
          role: msg.role,
          content: msg.content,
          isEdited: msg.isEdited || false,
          editedAt: msg.editedAt || null,
        });
      }

      return await SELECT.one.from(Conversations).where({ ID: conversationId });
    });

    this.on("editMessage", async (req) => {
      const { messageId, newContent } = req.data;

      const message = await SELECT.one.from(Messages).where({ ID: messageId });

      if (!message) {
        throw new Error("Message not found");
      }

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

      const messages = await SELECT.from(Messages)
        .where({ conversation_ID: message.conversation_ID })
        .orderBy('createdAt');

      let userMessage = null;
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].ID === messageId && i > 0) {
          userMessage = messages[i - 1];
          break;
        }
      }

      if (!userMessage || userMessage.role !== "user") {
        throw new Error("Could not find corresponding user message");
      }

      await DELETE.from(Messages).where({ ID: messageId });

      const conversation = await SELECT.one.from(Conversations)
        .where({ ID: message.conversation_ID });

      const selectedModel = conversation.model;

      let systemPrompt = "";
      let deploymentUrl = "";
      let modelParams = {};

      try {
        const modelConfig = await SELECT.one.from(Models).where({ modelKey: selectedModel });
        if (modelConfig) {
          systemPrompt = modelConfig.systemPrompt || "";
          deploymentUrl = modelConfig.deploymentUrl || "";
          modelParams = {
            temperature: modelConfig.temperature || 0.7,
            max_tokens: modelConfig.maxTokens || 2000,
            top_p: modelConfig.topP || 1.0,
            frequency_penalty: modelConfig.frequencyPenalty || 0.0,
            presence_penalty: modelConfig.presencePenalty || 0.0,
          };
        }
      } catch (error) {
        console.log("[regenerateMessage] No model config found, using defaults");
      }

      let aiReply;
      try {
        aiReply = await callAICoreAPI(userMessage.content, selectedModel, systemPrompt, deploymentUrl, modelParams);
      } catch (error) {
        console.error("AI API error:", error.message);
        throw error;
      }

      const newMessage = await INSERT.into(Messages).entries({
        conversation_ID: message.conversation_ID,
        role: "assistant",
        content: aiReply,
      });

      await UPDATE(Conversations)
        .set({ modifiedAt: new Date() })
        .where({ ID: message.conversation_ID });

      return await SELECT.one.from(Messages)
        .where({ conversation_ID: message.conversation_ID, role: "assistant" })
        .orderBy({ createdAt: 'desc' })
        .limit(1);
    });

    const callAICoreAPI = async (prompt, modelKey, systemPrompt, deploymentUrl) => {
      const token = aiCoreConfig.token;

      if (!token) {
        throw new Error(
          "Bearer Token is missing. Please configure it in Settings."
        );
      }

      const endpoint = deploymentUrl || process.env.AICORE_DEPLOYMENT_URL || "https://api.ai.prod-eu20.westeurope.azure.ml.hana.ondemand.com/v2/inference/deployments/da814b66ca186364/v2/completion";

      return new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const isHttps = url.protocol === "https:";
        const httpModule = isHttps ? https : http;

        const messages = [];

        if (systemPrompt) {
          messages.push({
            role: "system",
            content: systemPrompt,
          });
        }

        messages.push({
          role: "user",
          content: prompt,
        });

        const requestBody = JSON.stringify({
          config: {
            modules: {
              prompt_templating: {
                prompt: {
                  template: messages
                },
                model: {
                  name: modelKey,
                  version: "latest",
                  params: {
                    temperature: 0.7,
                    max_tokens: 2000
                  }
                }
              }
            },
            stream: {
              enabled: false
            }
          }
        });

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(requestBody),
            Authorization: `Bearer ${token}`,
            "AI-Resource-Group": aiCoreConfig.resourceGroup,
          },
        };

        const req = httpModule.request(options, (res) => {
          let data = "";

          res.on("data", (chunk) => {
            data += chunk;
          });

          res.on("end", () => {
            try {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const response = JSON.parse(data);
                let content = "";
                if (response.choices && response.choices[0]) {
                  content =
                    response.choices[0].message?.content ||
                    response.choices[0].text ||
                    "";
                } else if (response.content) {
                  content = response.content;
                } else if (response.text) {
                  content = response.text;
                } else {
                  content = JSON.stringify(response);
                }
                resolve(content);
              } else {
                reject(
                  new Error(
                    `AI API error: ${res.statusCode} - ${data}`
                  )
                );
              }
            } catch (error) {
              reject(new Error(`Failed to parse AI response: ${error.message}`));
            }
          });
        });

        req.on("error", (error) => {
          reject(new Error(`AI API request failed: ${error.message}`));
        });

        req.write(requestBody);
        req.end();
      });
    };

    this.on("sendMessage", async (req) => {
      const { conversationId, text, model } = req.data;
      let targetConversationId = conversationId;

      if (!targetConversationId) {
        if (!model) {
          throw new Error("No model selected. Please select a model first.");
        }

        const title = text.substring(0, 50);

        await INSERT.into(Conversations).entries({
          title: title,
          model: model,
        });

        const conversations = await SELECT.from(Conversations)
          .where({ title: title, model: selectedModel })
          .orderBy({ modifiedAt: 'desc' })
          .limit(1);

        if (conversations && conversations.length > 0) {
          targetConversationId = conversations[0].ID;
          console.log("[sendMessage] Created new conversation with ID:", targetConversationId);
        } else {
          throw new Error("Failed to create conversation");
        }
      }

      const conversation = await SELECT.one
        .from(Conversations)
        .where({ ID: targetConversationId });
      const selectedModel = model || conversation.model;

      if (!selectedModel) {
        throw new Error("No model selected. Please select a model first.");
      }

      const userMsg = await INSERT.into(Messages).entries({
        conversation_ID: targetConversationId,
        role: "user",
        content: text,
      });

      let systemPrompt = "";
      let deploymentUrl = "";
      try {
        const modelConfig = await SELECT.one.from(Models).where({ modelKey: selectedModel });
        if (modelConfig) {
          systemPrompt = modelConfig.systemPrompt || "";
          deploymentUrl = modelConfig.deploymentUrl || "";
        }
      } catch (error) {
        console.log("[sendMessage] No model config found, using defaults");
      }

      let aiReply;
      try {
        aiReply = await callAICoreAPI(text, selectedModel, systemPrompt, deploymentUrl);
      } catch (error) {
        console.error("AI API error:", error.message);
        throw error;
      }

      const replyDate = new Date();
      replyDate.setSeconds(replyDate.getSeconds() + 1);

      const replyMessage = await INSERT.into(Messages).entries({
        conversation_ID: targetConversationId,
        role: "assistant",
        content: aiReply,
        createdAt: replyDate.toISOString(),
      });

      await UPDATE(Conversations)
        .set({ modifiedAt: new Date() })
        .where({ ID: targetConversationId });

      return replyMessage;
    });

    const express = require('express');
    const app = cds.app;

    app.use(express.json());

    const getOAuth2Token = async (modelConfig) => {
      return new Promise(async (resolve, reject) => {
        let tokenUrl, clientId, clientSecret, scope;

        if (modelConfig.oauth2Provider_ID) {
          try {
            const provider = await SELECT.one.from(OAuth2Providers).where({ ID: modelConfig.oauth2Provider_ID });
            if (provider) {
              console.log("[OAuth2] Using OAuth2 provider:", provider.name);
              tokenUrl = provider.tokenUrl;
              clientId = provider.clientId;
              clientSecret = provider.clientSecret;
              scope = provider.scope;
            } else {
              console.log("[OAuth2] Provider not found, falling back to model config");
              tokenUrl = modelConfig.tokenUrl;
              clientId = modelConfig.clientId;
              clientSecret = modelConfig.clientSecret;
              scope = modelConfig.scope;
            }
          } catch (error) {
            console.error("[OAuth2] Error loading provider:", error);
            tokenUrl = modelConfig.tokenUrl;
            clientId = modelConfig.clientId;
            clientSecret = modelConfig.clientSecret;
            scope = modelConfig.scope;
          }
        } else {
          tokenUrl = modelConfig.tokenUrl;
          clientId = modelConfig.clientId;
          clientSecret = modelConfig.clientSecret;
          scope = modelConfig.scope;
        }

        const decryptedClientSecret = clientSecret && isEncrypted(clientSecret)
          ? decrypt(clientSecret)
          : clientSecret;

        console.log("[OAuth2] Token URL:", tokenUrl);
        console.log("[OAuth2] Client ID:", clientId);
        console.log("[OAuth2] Client Secret encrypted:", isEncrypted(clientSecret));
        console.log("[OAuth2] Client Secret length after decrypt:", decryptedClientSecret ? decryptedClientSecret.length : 0);

        const postData = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: decryptedClientSecret,
        });

        if (scope && scope !== 'default' && scope.trim() !== '') {
          postData.append('scope', scope);
          console.log("[OAuth2] Using scope:", scope);
        } else {
          console.log("[OAuth2] No scope specified, using default from OAuth2 server");
        }

        const url = new URL(tokenUrl);
        const isHttps = url.protocol === "https:";
        const httpModule = isHttps ? https : http;

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData.toString()),
          },
        };

        const req = httpModule.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              console.log("[OAuth2] Response status:", res.statusCode);
              console.log("[OAuth2] Response data:", data);

              const response = JSON.parse(data);

              if (response.access_token) {
                resolve(response.access_token);
              } else if (response.error) {
                reject(new Error(`OAuth2 error: ${response.error} - ${response.error_description || 'No description'}`));
              } else {
                reject(new Error(`No access_token in OAuth2 response. Response: ${JSON.stringify(response)}`));
              }
            } catch (error) {
              reject(new Error(`Failed to parse OAuth2 response: ${error.message}. Raw data: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`OAuth2 request failed: ${error.message}`));
        });

        req.write(postData.toString());
        req.end();
      });
    };

    app.post('/api/chat/stream', async (req, res) => {
      try {
        const { conversationId, text, model } = req.body;

        let targetConversationId = conversationId;

        if (!targetConversationId) {
          if (!model) {
            return res.status(400).json({ error: "No model selected. Please select a model first." });
          }

          const title = text.substring(0, 50);

          await INSERT.into(Conversations).entries({
            title: title,
            model: model,
          });

          const conversations = await SELECT.from(Conversations)
            .where({ title: title, model: model })
            .orderBy({ modifiedAt: 'desc' })
            .limit(1);

          if (conversations && conversations.length > 0) {
            targetConversationId = conversations[0].ID;
          } else {
            return res.status(500).json({ error: "Failed to create conversation" });
          }
        }

        const conversation = await SELECT.one
          .from(Conversations)
          .where({ ID: targetConversationId });
        const selectedModel = model || conversation.model;

        if (!selectedModel) {
          return res.status(400).json({ error: "No model selected. Please select a model first." });
        }

        await INSERT.into(Messages).entries({
          conversation_ID: targetConversationId,
          role: "user",
          content: text,
          createdAt: new Date().toISOString(),
        });

        let systemPrompt = "";
        let deploymentUrl = "";
        let token = aiCoreConfig.token;
        let modelCategory = "sap-abap";
        let modelParams = {
          temperature: 0.1,
          maxTokens: 2000,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0
        };

        try {
          const modelConfig = await SELECT.one.from(Models).where({ modelKey: selectedModel });
          if (modelConfig) {
            systemPrompt = modelConfig.systemPrompt || "";
            deploymentUrl = modelConfig.deploymentUrl || "";
            modelCategory = modelConfig.modelCategory || "sap-abap";
            modelParams = {
              temperature: modelConfig.temperature || 0.1,
              maxTokens: modelConfig.maxTokens || 2000,
              topP: modelConfig.topP || 1.0,
              frequencyPenalty: modelConfig.frequencyPenalty || 0.0,
              presencePenalty: modelConfig.presencePenalty || 0.0
            };

            if (modelConfig.authType === 'oauth2') {
              console.log("[stream] Model uses OAuth2, fetching token...");
              try {
                token = await getOAuth2Token(modelConfig);
                console.log("[stream] OAuth2 token obtained successfully");
              } catch (oauthError) {
                console.error("[stream] OAuth2 error:", oauthError.message);
                return res.status(401).json({ error: `OAuth2 authentication failed: ${oauthError.message}` });
              }
            }
          }
        } catch (error) {
          console.log("[stream] No model config found, using defaults");
        }

        if (!token) {
          return res.status(401).json({ error: "Bearer Token is missing. Please configure it in Settings or set up OAuth2 for this model." });
        }

        const endpoint = deploymentUrl || process.env.AICORE_DEPLOYMENT_URL || "https://api.ai.prod-eu20.westeurope.azure.ml.hana.ondemand.com/v2/inference/deployments/da814b66ca186364/v2/completion";

        const messages = [];
        if (systemPrompt) {
          messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: text });

        const requestBodyObj = buildRequestBody(
          modelCategory,
          messages,
          selectedModel,
          modelParams,
          true
        );

        const requestBody = JSON.stringify(requestBodyObj);

        console.log("[stream] Using model category:", modelCategory);
        console.log("[stream] Request body:", requestBody.substring(0, 200));

        const url = new URL(endpoint);
        const isHttps = url.protocol === "https:";
        const httpModule = isHttps ? https : http;

        const customHeaders = getHeaders(modelCategory, token, aiCoreConfig.resourceGroup);

        const options = {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: "POST",
          headers: {
            ...customHeaders,
            "Content-Length": Buffer.byteLength(requestBody),
          },
        };

        let fullContent = "";

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const apiReq = httpModule.request(options, (apiRes) => {
          let buffer = "";

          apiRes.on("data", (chunk) => {
            buffer += chunk.toString();

            if (modelCategory === 'claude-anthropic') {
              return;
            }

            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.substring(0, newlineIndex).trim();
              buffer = buffer.substring(newlineIndex + 1);

              if (!line || !line.startsWith('data: ')) continue;

              const jsonStr = line.substring(6).trim();

              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);

                const parsed = parseStreamChunk(modelCategory, data);

                if (parsed.content) {
                  fullContent += parsed.content;
                  res.write(`data: ${JSON.stringify({ content: parsed.content, done: false })}\n\n`);
                  console.log("[stream] Sent chunk:", parsed.content.substring(0, 50));
                }

                if (parsed.done) {
                  console.log("[stream] Received done signal from parser");
                }
              } catch (parseError) {
                console.error("[stream] Error parsing JSON:", parseError.message);
              }
            }
          });

          apiRes.on("end", async () => {
            if (modelCategory === 'claude-anthropic') {
              try {
                const response = JSON.parse(buffer);
                console.log("[stream] Claude response:", JSON.stringify(response).substring(0, 500));
                console.log("[stream] Buffer length:", buffer.length);

                if (response.content && Array.isArray(response.content)) {
                  for (const item of response.content) {
                    if (item.type === 'text' && item.text) {
                      fullContent += item.text;
                      res.write(`data: ${JSON.stringify({ content: item.text, done: false })}\n\n`);
                    }
                  }
                }
              } catch (parseError) {
                console.error("[stream] Error parsing Claude response:", parseError.message);
                console.error("[stream] Buffer was:", buffer);
                res.write(`data: ${JSON.stringify({ error: "Failed to parse response: " + parseError.message })}\n\n`);
              }
            }

            console.log("[stream] Final content length:", fullContent.length);

            if (fullContent) {
              await INSERT.into(Messages).entries({
                conversation_ID: targetConversationId,
                role: "assistant",
                content: fullContent,
              });

              await UPDATE(Conversations)
                .set({ modifiedAt: new Date() })
                .where({ ID: targetConversationId });
            }

            res.write(`data: ${JSON.stringify({ content: "", done: true, conversationId: targetConversationId })}\n\n`);
            res.end();
          });
        });

        apiReq.on("error", (error) => {
          console.error("API request error:", error);
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        });

        apiReq.write(requestBody);
        apiReq.end();

      } catch (error) {
        console.error("Stream error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    await super.init();
  }
};