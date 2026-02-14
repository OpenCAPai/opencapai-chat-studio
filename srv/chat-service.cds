using { sap.cap.ai as my } from '../db/schema';

service ChatService {
    entity Conversations as projection on my.Conversations;
    entity Messages      as projection on my.Messages;

    action sendMessage(conversationId : UUID, text : String, model : String) returns Messages;
}
