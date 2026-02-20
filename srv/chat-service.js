const cds = require("@sap/cds");
const https = require("https");
const http = require("http");

let aiCoreConfig = {
  endpoint: process.env.AICORE_ENDPOINT || "",
  resourceGroup: process.env.AICORE_RESOURCE_GROUP || "default",
  token: process.env.AICORE_TOKEN || "",
};

module.exports = class ChatService extends cds.ApplicationService {
  async init() {
    const { Conversations, Messages, Models } = this.entities;

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

    this.on("getAICoreConfig", async (req) => {
      return aiCoreConfig;
    });

    this.on("saveAICoreConfig", async (req) => {
      const { endpoint, resourceGroup, token } = req.data;
      aiCoreConfig = {
        endpoint: endpoint || "",
        resourceGroup: resourceGroup || "default",
        token: token || "",
      };
      return aiCoreConfig;
    });

    this.on("createModel", async (req) => {
      const {
        key,
        name,
        deploymentUrl,
        systemPrompt,
        authType,
        tokenUrl,
        clientId,
        clientSecret,
        scope,
      } = req.data;

      await INSERT.into(Models).entries({
        modelKey: key,
        name,
        deploymentUrl,
        systemPrompt: systemPrompt || "",
        authType: authType || "bearer",
        tokenUrl: tokenUrl || "",
        clientId: clientId || "",
        clientSecret: clientSecret || "",
        scope: scope || "",
      });

      const createdModel = await SELECT.one.from(Models).where({ modelKey: key });
      return createdModel;
    });

    this.on("updateModel", async (req) => {
      const {
        ID,
        name,
        deploymentUrl,
        systemPrompt,
        authType,
        tokenUrl,
        clientId,
        clientSecret,
        scope,
      } = req.data;

      const updateData = {
        name,
        deploymentUrl,
        systemPrompt: systemPrompt || "",
        authType: authType || "bearer",
        tokenUrl: tokenUrl || "",
        clientId: clientId || "",
        scope: scope || "",
      };

      if (clientSecret) {
        updateData.clientSecret = clientSecret;
      }

      await UPDATE(Models).set(updateData).where({ ID });

      return await SELECT.one.from(Models).where({ ID });
    });

    this.on("deleteModel", async (req) => {
      const { ID } = req.data;
      await DELETE.from(Models).where({ ID });
      return true;
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
      return new Promise((resolve, reject) => {
        const { tokenUrl, clientId, clientSecret, scope } = modelConfig;

        const postData = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        });

        if (scope) {
          postData.append('scope', scope);
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
              const response = JSON.parse(data);
              if (response.access_token) {
                resolve(response.access_token);
              } else {
                reject(new Error('No access_token in OAuth2 response'));
              }
            } catch (error) {
              reject(new Error(`Failed to parse OAuth2 response: ${error.message}`));
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

        try {
          const modelConfig = await SELECT.one.from(Models).where({ modelKey: selectedModel });
          if (modelConfig) {
            systemPrompt = modelConfig.systemPrompt || "";
            deploymentUrl = modelConfig.deploymentUrl || "";

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

        const requestBody = JSON.stringify({
          config: {
            modules: {
              prompt_templating: {
                prompt: { template: messages },
                model: {
                  name: selectedModel,
                  version: "latest",
                  params: {
                    temperature: 0.1,
                    max_tokens: 2000
                  }
                }
              }
            },
            stream: {
              enabled: true,
              chunk_size: 256,
              delimiters: ["\n"]
            }
          }
        });

        const url = new URL(endpoint);
        const isHttps = url.protocol === "https:";
        const httpModule = isHttps ? https : http;

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

        let fullContent = "";

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const apiReq = httpModule.request(options, (apiRes) => {
          let buffer = "";

          apiRes.on("data", (chunk) => {
            buffer += chunk.toString();

            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.substring(0, newlineIndex).trim();
              buffer = buffer.substring(newlineIndex + 1);

              if (!line || !line.startsWith('data: ')) continue;

              const jsonStr = line.substring(6).trim();

              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);

                if (data.final_result && data.final_result.choices && data.final_result.choices[0]) {
                  const choice = data.final_result.choices[0];

                  if (choice.delta && choice.delta.content) {
                    fullContent += choice.delta.content;
                    res.write(`data: ${JSON.stringify({ content: choice.delta.content, done: false })}\n\n`);
                    console.log("[stream] Sent chunk:", choice.delta.content.substring(0, 50));
                  }

                  if (choice.finish_reason === 'stop') {
                    console.log("[stream] Received finish_reason: stop");
                  }
                }
              } catch (parseError) {
                console.error("[stream] Error parsing JSON:", parseError.message);
              }
            }
          });

          apiRes.on("end", async () => {
            console.log("[stream] Final content:", fullContent);

            await INSERT.into(Messages).entries({
              conversation_ID: targetConversationId,
              role: "assistant",
              content: fullContent,
            });

            await UPDATE(Conversations)
              .set({ modifiedAt: new Date() })
              .where({ ID: targetConversationId });

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
