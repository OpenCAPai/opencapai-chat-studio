using {sap.cap.ai as my} from '../db/schema';

service ChatService {
    entity Conversations   as projection on my.Conversations;
    entity Messages        as projection on my.Messages;
    entity Models          as projection on my.Models;
    entity OAuth2Providers as projection on my.OAuth2Providers;

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
                         modelCategory: String,
                         deploymentUrl: String,
                         systemPrompt: String,
                         authType: String,
                         tokenUrl: String,
                         clientId: String,
                         clientSecret: String,
                         scope: String,
                         oauth2ProviderId: UUID,
                         temperature: Decimal,
                         maxTokens: Integer,
                         topP: Decimal,
                         frequencyPenalty: Decimal,
                         presencePenalty: Decimal)                                    returns Models;

    action   updateModel(ID: UUID,
                         name: String,
                         modelCategory: String,
                         deploymentUrl: String,
                         systemPrompt: String,
                         authType: String,
                         tokenUrl: String,
                         clientId: String,
                         clientSecret: String,
                         scope: String,
                         temperature: Decimal,
                         maxTokens: Integer,
                         topP: Decimal,
                         frequencyPenalty: Decimal,
                         presencePenalty: Decimal)                                    returns Models;

    action   deleteModel(ID: UUID)                                                    returns Boolean;
    action   testModelAuth(ID: UUID)                                                  returns String;

    // OAuth2 Provider management
    action   createOAuth2Provider(name: String,
                                  tokenUrl: String,
                                  clientId: String,
                                  clientSecret: String,
                                  scope: String,
                                  description: String)                                returns OAuth2Providers;

    action   updateOAuth2Provider(ID: UUID,
                                  name: String,
                                  tokenUrl: String,
                                  clientId: String,
                                  clientSecret: String,
                                  scope: String,
                                  description: String)                                returns OAuth2Providers;

    action   deleteOAuth2Provider(ID: UUID)                                           returns Boolean;

    type DeploymentUrlValidation {
        valid        : Boolean;
        message      : String;
        suggestedUrl : String;
    }

    action   validateDeploymentUrl(url: String, modelCategory: String)                returns DeploymentUrlValidation;

    function exportConversation(conversationId: UUID)                                 returns String;
    action   importConversation(data: String)                                         returns Conversations;

    action   editMessage(messageId: UUID, newContent: String)                         returns Messages;
    action   regenerateMessage(messageId: UUID)                                       returns Messages;

    type UserInfo {
        id    : String;
        name  : String;
        email : String;
        roles : array of String;
    }

    function getUserInfo()                                                            returns UserInfo;
}
