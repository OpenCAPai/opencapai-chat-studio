sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/CustomListItem",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Label",
    "sap/ui/core/Configuration",
    "sap/ui/model/Sorter",
    "sap/ui/model/json/JSONModel",
    "sap/m/ActionSheet",
    "sap/ui/core/CustomData",
  ],
  function (
    Controller,
    MessageToast,
    Dialog,
    List,
    StandardListItem,
    CustomListItem,
    Button,
    Input,
    TextArea,
    VBox,
    HBox,
    Text,
    Label,
    Configuration,
    Sorter,
    JSONModel,
    ActionSheet,
    CustomData,
  ) {
    "use strict";

    return Controller.extend("sap.cap.ai.chat.controller.App", {
      onInit: function () {
        this._selectedConversationId = null;
        this._selectedModel = "sap-abap-1";
        this._streamingInterval = null;

        const oUiModel = new JSONModel({
          isStreaming: false,
          streamingText: "",
          currentTheme: "system",
          availableModels: [
            {
              key: "sap-abap-1",
              name: "SAP ABAP Llama",
              deploymentUrl: "https://api.ai.sap/v2/deployment/d1",
              systemPrompt: "You are a specialized ABAP assistant.",
            },
            {
              key: "gpt-4",
              name: "GPT-4 Turbo",
              deploymentUrl: "https://api.ai.sap/v2/deployment/d2",
              systemPrompt: "You are a helpful general assistant.",
            },
          ],
        });
        this.getView().setModel(oUiModel, "ui");
        this._applySystemTheme();

        window
          .matchMedia("(prefers-color-scheme: dark)")
          .addEventListener("change", () => {
            if (
              this.getView().getModel("ui").getProperty("/currentTheme") ===
              "system"
            ) {
              this._applySystemTheme();
            }
          });
      },

      _applySystemTheme: function () {
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        Configuration.setTheme(isDark ? "sap_horizon_dark" : "sap_horizon");
      },

      onAvatarPress: function (oEvent) {
        const oButton = oEvent.getSource();
        if (!this._oActionSheet) {
          this._oActionSheet = new ActionSheet({
            title: "Account Settings",
            showCancelButton: true,
            buttons: [
              new Button({
                text: "Profile Settings",
                icon: "sap-icon://settings",
              }),
              new Button({
                text: "Logout",
                icon: "sap-icon://log",
                type: "Reject",
                press: () => MessageToast.show("Logging out..."),
              }),
            ],
          });
          this.getView().addDependent(this._oActionSheet);
        }
        this._oActionSheet.openBy(oButton);
      },

      onOpenSettings: function () {
        const oUiModel = this.getView().getModel("ui");
        const oDialog = new Dialog({
          title: "Settings",
          contentWidth: "500px",
          content: [
            new Label({ text: "Appearance", design: "Bold" }).addStyleClass(
              "sapUiSmallMarginTop",
            ),
            new List({
              mode: "SingleSelectMaster",
              items: [
                new StandardListItem({
                  title: "System Default",
                  customData: [new CustomData({ key: "val", value: "system" })],
                }),
                new StandardListItem({
                  title: "Light Mode",
                  customData: [new CustomData({ key: "val", value: "light" })],
                }),
                new StandardListItem({
                  title: "Dark Mode",
                  customData: [new CustomData({ key: "val", value: "dark" })],
                }),
              ],
              selectionChange: (oEvt) => {
                const sKey = oEvt
                  .getParameter("listItem")
                  .getCustomData()[0]
                  .getValue();
                oUiModel.setProperty("/currentTheme", sKey);
                if (sKey === "system") this._applySystemTheme();
                else
                  Configuration.setTheme(
                    sKey === "dark" ? "sap_horizon_dark" : "sap_horizon",
                  );
              },
            }),
            new Label({
              text: "Model Configuration",
              design: "Bold",
            }).addStyleClass("sapUiSmallMarginTop"),
            new List({
              items: {
                path: "ui>/availableModels",
                template: new CustomListItem({
                  content: new VBox({
                    items: [
                      new HBox({
                        justifyContent: "SpaceBetween",
                        alignItems: "Center",
                        items: [
                          new Text({ text: "{ui>name}", design: "Bold" }),
                          new HBox({
                            items: [
                              new Button({
                                icon: "sap-icon://edit",
                                type: "Transparent",
                                press: (oE) => {
                                  const oCtx = oE
                                    .getSource()
                                    .getBindingContext("ui");
                                  this._onOpenModelDialog(oCtx);
                                },
                              }),
                              new Button({
                                icon: "sap-icon://delete",
                                type: "Transparent",
                                press: (oE) => {
                                  const aModels =
                                    oUiModel.getProperty("/availableModels");
                                  const iIdx = parseInt(
                                    oE
                                      .getSource()
                                      .getBindingContext("ui")
                                      .getPath()
                                      .split("/")
                                      .pop(),
                                  );
                                  aModels.splice(iIdx, 1);
                                  oUiModel.setProperty(
                                    "/availableModels",
                                    aModels,
                                  );
                                },
                              }),
                            ],
                          }),
                        ],
                      }),
                      new Text({
                        text: "URL: {ui>deploymentUrl}",
                        class: "sapUiTinyMarginTop",
                      }),
                      new Text({
                        text: "Prompt: {ui>systemPrompt}",
                        wrapping: false,
                        class: "sapUiTinyMarginTop",
                      }),
                    ],
                  }).addStyleClass("sapUiSmallMargin"),
                }),
              },
            }),
            new Button({
              text: "Add New Model",
              icon: "sap-icon://add",
              press: () => this._onOpenModelDialog(),
            }).addStyleClass("sapUiSmallMarginTop"),
          ],
          beginButton: new Button({
            text: "Close",
            press: () => oDialog.close(),
          }),
        });
        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      _onOpenModelDialog: function (oContext) {
        const bEdit = !!oContext;
        const oUiModel = this.getView().getModel("ui");

        const oKey = new Input({
          placeholder: "Model Key",
          value: bEdit ? oContext.getProperty("key") : "",
          editable: !bEdit,
        });
        const oName = new Input({
          placeholder: "Display Name",
          value: bEdit ? oContext.getProperty("name") : "",
        });
        const oUrl = new Input({
          placeholder: "Deployment URL",
          value: bEdit ? oContext.getProperty("deploymentUrl") : "",
        });
        const oPrompt = new TextArea({
          placeholder: "System Prompt",
          rows: 3,
          width: "100%",
          value: bEdit ? oContext.getProperty("systemPrompt") : "",
        });

        const oDialog = new Dialog({
          title: bEdit ? "Edit Model" : "Add New AI Model",
          contentWidth: "400px",
          content: [
            new VBox({
              items: [
                new Label({ text: "ID (Key)" }),
                oKey,
                new Label({ text: "Display Name" }),
                oName,
                new Label({ text: "Deployment URL" }),
                oUrl,
                new Label({ text: "System Prompt" }),
                oPrompt,
              ],
            }).addStyleClass("sapUiSmallMargin"),
          ],
          beginButton: new Button({
            text: bEdit ? "Save" : "Add",
            press: () => {
              const aModels = oUiModel.getProperty("/availableModels");
              const oData = {
                key: oKey.getValue(),
                name: oName.getValue(),
                deploymentUrl: oUrl.getValue(),
                systemPrompt: oPrompt.getValue(),
              };

              if (bEdit) {
                const iIdx = parseInt(oContext.getPath().split("/").pop());
                aModels[iIdx] = oData;
              } else {
                aModels.push(oData);
              }

              oUiModel.setProperty("/availableModels", aModels);
              oDialog.close();
              MessageToast.show(bEdit ? "Model updated" : "Model added");
            },
          }),
          endButton: new Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),
        });
        oDialog.open();
      },

      onSelectModel: function () {
        const oDialog = new Dialog({
          title: "Select AI Model",
          content: new List({
            mode: "SingleSelectMaster",
            selectionChange: (oEvent) => {
              const sModel = oEvent
                .getParameter("listItem")
                .getBindingContext("ui")
                .getProperty("key");
              this._selectedModel = sModel;
              this.getView().byId("modelSelectButton").setText(sModel);
              if (this._selectedConversationId) {
                this.getView()
                  .byId("chatPage")
                  .getBindingContext()
                  .setProperty("model", sModel);
              }
              oDialog.close();
            },
            items: {
              path: "ui>/availableModels",
              template: new StandardListItem({
                title: "{ui>name}",
                description: "{ui>key}",
              }),
            },
          }),
          beginButton: new Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),
        });
        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      onNewChat: function () {
        this._stopStreaming();
        this._selectedConversationId = null;
        this.getView().byId("chatPage").setBindingContext(null);
        this.getView().byId("messageList").unbindItems();
        this.getView().byId("conversationList").removeSelections();
        this.getView().byId("modelSelectButton").setText("sap-abap-1");
        this._selectedModel = "sap-abap-1";
      },

      onConversationSelect: function (oEvent) {
        this._stopStreaming();
        const oItem = oEvent.getParameter("listItem");
        const oContext = oItem.getBindingContext();
        if (!oContext) return;

        this._selectedConversationId = oContext.getProperty("ID");
        this._selectedModel = oContext.getProperty("model") || "sap-abap-1";
        this.getView().byId("modelSelectButton").setText(this._selectedModel);

        const oChatPage = this.getView().byId("chatPage");
        oChatPage.setBindingContext(oContext);
        this._bindMessages(oContext);
      },

      _stopStreaming: function () {
        if (this._streamingInterval) {
          clearInterval(this._streamingInterval);
          this._streamingInterval = null;
        }
        this.getView().getModel("ui").setProperty("/isStreaming", false);
        this.getView().getModel("ui").setProperty("/streamingText", "");
        this.getView().byId("chatPage").setBusy(false);
      },

      onStopStreaming: function () {
        this._stopStreaming();
        this.getView().getModel().refresh();
      },

      _bindMessages: function (oContext) {
        const oMessageList = this.getView().byId("messageList");
        oMessageList.bindItems({
          path: "messages",
          sorter: new Sorter("createdAt", false),
          template: new CustomListItem({
            content: new HBox({
              justifyContent: "{= ${role} === 'user' ? 'End' : 'Start' }",
              items: [
                new VBox({
                  items: [
                    new HBox({
                      justifyContent: "SpaceBetween",
                      alignItems: "Center",
                      items: [
                        new Label({ text: "{role}", design: "Bold" }),
                        new Button({
                          icon: "sap-icon://copy",
                          type: "Transparent",
                          press: this.onCopyMessage.bind(this),
                        }),
                      ],
                    }).addStyleClass("sapUiTinyMarginBottom"),
                    new Text({ text: "{content}", wrapping: true }),
                    new Text({
                      text: "{path: 'createdAt', type: 'sap.ui.model.type.DateTime', formatOptions: {style: 'short'}}",
                      class: "chatTimestamp",
                    }),
                  ],
                })
                  .addStyleClass("chatBubble")
                  .addStyleClass(
                    "{= ${role} === 'user' ? 'userBubble' : 'assistantBubble' }",
                  ),
              ],
            }).addStyleClass("sapUiSmallMargin"),
            class: "messageRow",
          }),
          events: {
            change: () => this._scrollToBottom(),
            dataReceived: () => this._scrollToBottom(),
          },
        });
        this._scrollToBottom();
      },

      _scrollToBottom: function () {
        setTimeout(() => {
          const oScrollContainer = this.getView().byId("scrollContainer");
          const oDomRef = oScrollContainer
            ? oScrollContainer.getDomRef()
            : null;
          if (oDomRef) oDomRef.scrollTop = oDomRef.scrollHeight;
        }, 300);
      },

      onSendMessage: function () {
        const oInput = this.getView().byId("chatInput");
        const sText = oInput.getValue();
        if (!sText) return;

        const oModel = this.getView().getModel();
        const oUiModel = this.getView().getModel("ui");
        const oChatPage = this.getView().byId("chatPage");

        oInput.setValue("");
        oChatPage.setBusy(true);

        const oAction = oModel.bindContext("/sendMessage(...)");
        oAction.setParameter("conversationId", this._selectedConversationId);
        oAction.setParameter("text", sText);
        oAction.setParameter("model", this._selectedModel);

        const sStartConvId = this._selectedConversationId;

        oAction
          .execute()
          .then(() => {
            if (
              this._selectedConversationId !== sStartConvId &&
              sStartConvId !== null
            ) {
              oChatPage.setBusy(false);
              return;
            }
            const oContext = oAction.getBoundContext();
            const sFullReply =
              oContext.getProperty("content") || "No response received";
            oModel.refresh();
            oChatPage.setBusy(false);
            oUiModel.setProperty("/isStreaming", true);
            oUiModel.setProperty("/streamingText", "");

            const iTotalChars = sFullReply.length;
            const iIntervalTime = Math.max(30, Math.floor(5000 / iTotalChars));
            let iIndex = 0;
            this._streamingInterval = setInterval(() => {
              if (
                this._selectedConversationId !== sStartConvId &&
                sStartConvId !== null
              ) {
                this._stopStreaming();
                return;
              }
              const sCurrentText = oUiModel.getProperty("/streamingText");
              oUiModel.setProperty(
                "/streamingText",
                sCurrentText + sFullReply[iIndex],
              );
              this._scrollToBottom();
              iIndex++;
              if (iIndex >= iTotalChars) {
                this._stopStreaming();
                oModel.refresh();
                this._scrollToBottom();
              }
            }, iIntervalTime);
          })
          .catch((oError) => {
            oChatPage.setBusy(false);
            MessageToast.show("Error: " + oError.message);
          });
      },

      onCopyMessage: function (oEvent) {
        const sText = oEvent
          .getSource()
          .getBindingContext()
          .getProperty("content");
        navigator.clipboard
          .writeText(sText)
          .then(() => MessageToast.show("Copied to clipboard"));
      },

      onEditTitle: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext();
        const sCurrentTitle = oContext.getProperty("title");
        const oInput = new Input({ value: sCurrentTitle });
        const oDialog = new Dialog({
          title: "Edit Title",
          content: oInput,
          beginButton: new Button({
            text: "Save",
            press: () => {
              oContext.setProperty("title", oInput.getValue());
              oDialog.close();
            },
          }),
          endButton: new Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),
        });
        oDialog.open();
      },

      onDeleteConversation: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext();
        const sId = oContext.getProperty("ID");
        oContext.delete().then(() => {
          MessageToast.show("Deleted");
          if (this._selectedConversationId === sId) this.onNewChat();
        });
      },
    });
  },
);
