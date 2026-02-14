const cds = require("@sap/cds");

module.exports = class ChatService extends cds.ApplicationService {
  async init() {
    const { Conversations, Messages } = this.entities;

    this.on("sendMessage", async (req) => {
      const { conversationId, text, model } = req.data;
      let targetConversationId = conversationId;

      if (!targetConversationId) {
        const conv = await INSERT.into(Conversations).entries({
          title: text.substring(0, 50),
          model: model || "sap-abap-1",
        });
        targetConversationId = conv.results[0].ID;
      }

      const conversation = await SELECT.one
        .from(Conversations)
        .where({ ID: targetConversationId });
      const selectedModel = model || conversation.model || "sap-abap-1";

      const userMsg = await INSERT.into(Messages).entries({
        conversation_ID: targetConversationId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      });

      const aiReply = `Mocked reply from ${selectedModel}: I received your message "${text}". How can I help you today?`;

      // Wait a bit to ensure a different timestamp
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

    await super.init();
  }
};
