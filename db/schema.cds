namespace sap.cap.ai;

using {
    cuid,
    managed
} from '@sap/cds/common';

@cds.autoexpose
entity Conversations : cuid, managed {
    title    : String;
    model    : String;
    messages : Composition of many Messages
                   on messages.conversation = $self;
}

@cds.autoexpose
entity Messages : cuid, managed {
    conversation    : Association to Conversations;
    role            : String;
    content         : String;
    isEdited        : Boolean default false;
    editedAt        : DateTime;
    originalContent : String;
}

entity OAuth2Providers : cuid, managed {
    name         : String not null;
    tokenUrl     : String not null;
    clientId     : String not null;
    clientSecret : String not null;
    scope        : String;
    description  : String;
}

entity Models : cuid, managed {
    modelKey         : String not null;
    name             : String not null;
    modelCategory    : String default 'sap-abap'; // 'sap-abap', 'claude-anthropic', 'openai-gpt', 'custom'
    deploymentUrl    : String not null;
    systemPrompt     : String;
    authType         : String default 'bearer'; // 'bearer', 'oauth2', 'none'
    // OAuth2 direct config (legacy)
    tokenUrl         : String;
    clientId         : String;
    clientSecret     : String;
    scope            : String;
    // OAuth2 provider reference (new)
    oauth2Provider   : Association to OAuth2Providers;
    cachedToken      : String;
    tokenExpiresAt   : DateTime;
    // Advanced parameters
    temperature      : Decimal(3, 2) default 0.7;
    maxTokens        : Integer default 2000;
    topP             : Decimal(3, 2) default 1.0;
    frequencyPenalty : Decimal(3, 2) default 0.0;
    presencePenalty  : Decimal(3, 2) default 0.0;
}
