namespace sap.cap.ai;

using {
    cuid,
    managed
} from '@sap/cds/common';

entity Conversations : cuid, managed {
    title      : String;
    model      : String default 'sap-abap-1';
    messages   : Composition of many Messages
                     on messages.conversation = $self;
}

entity Messages : cuid, managed {
    conversation : Association to Conversations;
    role         : String;
    content      : String;
}
