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
    conversation : Association to Conversations;
    role         : String;
    content      : String;
}

entity Models : cuid, managed {
    modelKey       : String not null;
    name           : String not null;
    deploymentUrl  : String not null;
    systemPrompt   : String;
    authType       : String default 'bearer'; // 'bearer', 'oauth2', 'none'
    tokenUrl       : String;
    clientId       : String;
    clientSecret   : String;
    scope          : String;
    cachedToken    : String;
    tokenExpiresAt : DateTime;
}
