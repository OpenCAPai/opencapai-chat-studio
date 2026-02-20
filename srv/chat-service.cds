using {sap.cap.ai as my} from '../db/schema';

service ChatService {
    entity Conversations as projection on my.Conversations;
    entity Messages      as projection on my.Messages;

    entity Models        as projection on my.Models;

    action   sendMessage(conversationId: UUID, text: String, model: String)           returns Messages;

    type AICoreConfig {
        endpoint      : String;
        resourceGroup : String;
        token         : String;
    }

    function getAICoreConfig()                                                        returns AICoreConfig;
    action   saveAICoreConfig(endpoint: String, resourceGroup: String, token: String) returns AICoreConfig;

    action   createModel(key: String,
                         name: String,
                         deploymentUrl: String,
                         systemPrompt: String,
                         authType: String,
                         tokenUrl: String,
                         clientId: String,
                         clientSecret: String,
                         scope: String)                                               returns Models;

    action   updateModel(ID: UUID,
                         name: String,
                         deploymentUrl: String,
                         systemPrompt: String,
                         authType: String,
                         tokenUrl: String,
                         clientId: String,
                         clientSecret: String,
                         scope: String)                                               returns Models;

    action   deleteModel(ID: UUID)                                                    returns Boolean;
    action   testModelAuth(ID: UUID)                                                  returns String;

    type UserInfo {
        id    : String;
        name  : String;
        email : String;
        roles : array of String;
    }

    function getUserInfo()                                                            returns UserInfo;
}
