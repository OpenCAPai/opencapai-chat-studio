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
        this._selectedModel = null;
        this._streamingInterval = null;

        const oUiModel = new JSONModel({
          isStreaming: false,
          streamingText: "",
          currentTheme: "system",
          aiCoreConfig: {
            endpoint: "",
            resourceGroup: "",
            token: "",
          },
          availableModels: [],
          oauth2Providers: [],
          userInfo: {
            id: "",
            name: "Loading...",
            email: "",
            roles: [],
          },
        });
        this.getView().setModel(oUiModel, "ui");
        this._loadUserInfo();
        this._loadAICoreConfig();
        this._loadModels();
        this._loadOAuth2Providers();
        this._applySystemTheme();

        this._setupKeyboardShortcuts();

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

      _setupKeyboardShortcuts: function () {
        document.addEventListener("keydown", (oEvent) => {
          if ((oEvent.ctrlKey || oEvent.metaKey) && oEvent.key === "Enter") {
            oEvent.preventDefault();
            this.onSendMessage();
          } else if ((oEvent.ctrlKey || oEvent.metaKey) && oEvent.key === "n") {
            oEvent.preventDefault();
            this.onNewChat();
          } else if ((oEvent.ctrlKey || oEvent.metaKey) && oEvent.key === "k") {
            oEvent.preventDefault();
            MessageToast.show("Search feature coming soon!");
          } else if (oEvent.key === "Escape") {
            const oUiModel = this.getView().getModel("ui");
            if (oUiModel.getProperty("/isStreaming")) {
              oEvent.preventDefault();
              this.onStopStreaming();
            }
          }
        });
      },

      _loadUserInfo: function () {
        const oUiModel = this.getView().getModel("ui");

        fetch("/odata/v4/chat/getUserInfo")
          .then((res) => {
            if (!res.ok) {
              throw new Error("Failed to fetch user info");
            }
            return res.json();
          })
          .then((data) => {
            if (data.value) {
              oUiModel.setProperty("/userInfo", data.value);
            } else if (data) {
              oUiModel.setProperty("/userInfo", data);
            }
          })
          .catch((err) => {
            console.error("Failed to load user info:", err);
            oUiModel.setProperty("/userInfo", {
              id: "error",
              name: "Error loading user",
              email: "",
              roles: [],
            });
          });
      },

      _loadModels: function () {
        const oUiModel = this.getView().getModel("ui");

        fetch("/odata/v4/chat/Models")
          .then((res) => res.json())
          .then((data) => {
            oUiModel.setProperty("/availableModels", data.value || []);
          })
          .catch((err) => {
            console.error("Failed to load models:", err);
          });
      },

      _loadOAuth2Providers: function () {
        const oUiModel = this.getView().getModel("ui");

        fetch("/odata/v4/chat/OAuth2Providers")
          .then((res) => res.json())
          .then((data) => {
            oUiModel.setProperty("/oauth2Providers", data.value || []);
          })
          .catch((err) => {
            console.error("Failed to load OAuth2 providers:", err);
          });
      },

      _validateDeploymentUrl: function (sUrl, sModelCategory) {
        const oModel = this.getView().getModel();
        const oAction = oModel.bindContext("/validateDeploymentUrl(...)");
        oAction.setParameter("url", sUrl);
        oAction.setParameter("modelCategory", sModelCategory);

        return oAction.execute().then(() => {
          const oResult = oAction.getBoundContext().getObject();
          return oResult.value;
        });
      },

      _applySystemTheme: function () {
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        Configuration.setTheme(isDark ? "sap_horizon_dark" : "sap_horizon");
      },

      _loadAICoreConfig: function () {
        const oUiModel = this.getView().getModel("ui");
        fetch("/odata/v4/chat/getAICoreConfig")
          .then((res) => res.json())
          .then((data) => {
            if (data.value) {
              oUiModel.setProperty("/aiCoreConfig", data.value);
            }
          })
          .catch((err) => {
            console.error("Failed to load AI Core config:", err);
          });
      },

      _saveAICoreConfig: function (oConfig) {
        const oUiModel = this.getView().getModel("ui");
        fetch("/odata/v4/chat/saveAICoreConfig", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(oConfig),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.value) {
              oUiModel.setProperty("/aiCoreConfig", data.value);
              MessageToast.show("AI Core configuration saved successfully");
            }
          })
          .catch((err) => {
            MessageToast.show("Failed to save AI Core configuration");
            console.error("Failed to save AI Core config:", err);
          });
      },

      onAvatarPress: function () {
        const oUiModel = this.getView().getModel("ui");
        const oUserInfo = oUiModel.getProperty("/userInfo");

        const oDialog = new Dialog({
          title: "User Profile",
          contentWidth: "400px",
          content: [
            new VBox({
              items: [
                new HBox({
                  justifyContent: "Center",
                  items: [
                    new sap.m.Avatar({
                      displaySize: "XL",
                      initials: oUserInfo.name
                        ? oUserInfo.name.substring(0, 2).toUpperCase()
                        : "??",
                      backgroundColor: "Accent6",
                    }),
                  ],
                }).addStyleClass("sapUiSmallMarginBottom"),
                new VBox({
                  items: [
                    new Label({ text: "Name", design: "Bold" }),
                    new Text({ text: "{ui>/userInfo/name}" }).addStyleClass(
                      "sapUiSmallMarginBottom",
                    ),
                    new Label({ text: "Email", design: "Bold" }),
                    new Text({ text: "{ui>/userInfo/email}" }).addStyleClass(
                      "sapUiSmallMarginBottom",
                    ),
                    new Label({ text: "User ID", design: "Bold" }),
                    new Text({ text: "{ui>/userInfo/id}" }).addStyleClass(
                      "sapUiSmallMarginBottom",
                    ),
                    new Label({ text: "Roles", design: "Bold" }),
                    new Text({
                      text: {
                        path: "ui>/userInfo/roles",
                        formatter: function (aRoles) {
                          return aRoles && aRoles.length > 0
                            ? aRoles.join(", ")
                            : "No roles assigned";
                        },
                      },
                    }),
                  ],
                }),
              ],
            }).addStyleClass("sapUiSmallMargin"),
          ],
          beginButton: new Button({
            text: "Close",
            press: function () {
              oDialog.close();
            },
          }),
        });

        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      onOpenSettings: function () {
        const oUiModel = this.getView().getModel("ui");

        const oBearerTokenInput = new TextArea({
          value: "{ui>/aiCoreConfig/token}",
          placeholder: "Bearer Token (JWT)",
          rows: 4,
          width: "100%",
        });

        const oDialog = new Dialog({
          title: "Settings",
          contentWidth: "600px",
          content: [
            new Label({
              text: "AI Core Bearer Token",
              design: "Bold",
            }).addStyleClass("sapUiSmallMarginTop"),
            new VBox({
              items: [
                new Label({ text: "Authentication Token" }),
                oBearerTokenInput,
                new Button({
                  text: "Save Token",
                  type: "Emphasized",
                  press: () => {
                    const oConfig = {
                      endpoint: "",
                      resourceGroup: "default",
                      token: oBearerTokenInput.getValue(),
                    };
                    this._saveAICoreConfig(oConfig);
                  },
                }).addStyleClass("sapUiSmallMarginTop"),
              ],
            }).addStyleClass("sapUiSmallMargin"),
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
                                  const oCtx = oE
                                    .getSource()
                                    .getBindingContext("ui");
                                  const sID = oCtx.getProperty("ID");
                                  const sName = oCtx.getProperty("name");

                                  sap.m.MessageBox.confirm(
                                    `Are you sure you want to delete the model "${sName}"?`,
                                    {
                                      onClose: (oAction) => {
                                        if (
                                          oAction === sap.m.MessageBox.Action.OK
                                        ) {
                                          const oModel =
                                            this.getView().getModel();
                                          const oDeleteAction =
                                            oModel.bindContext(
                                              "/deleteModel(...)",
                                            );
                                          oDeleteAction.setParameter("ID", sID);
                                          oDeleteAction
                                            .execute()
                                            .then(() => {
                                              MessageToast.show(
                                                "Model deleted successfully",
                                              );
                                              this._loadModels();
                                            })
                                            .catch((oError) => {
                                              MessageToast.show(
                                                "Error deleting model: " +
                                                  oError.message,
                                              );
                                            });
                                        }
                                      },
                                    },
                                  );
                                },
                              }),
                            ],
                          }),
                        ],
                      }),
                      new Text({
                        text: "URL: {ui>deploymentUrl}",
                      }).addStyleClass("sapUiTinyMarginTop"),
                      new Text({
                        text: "Prompt: {ui>systemPrompt}",
                        wrapping: false,
                      }).addStyleClass("sapUiTinyMarginTop"),
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
            new Label({
              text: "OAuth2 Providers",
              design: "Bold",
            }).addStyleClass("sapUiSmallMarginTop"),
            new List({
              items: {
                path: "ui>/oauth2Providers",
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
                                  this._onOpenProviderDialog(oCtx);
                                },
                              }),
                              new Button({
                                icon: "sap-icon://delete",
                                type: "Transparent",
                                press: (oE) => {
                                  const oCtx = oE
                                    .getSource()
                                    .getBindingContext("ui");
                                  const sID = oCtx.getProperty("ID");
                                  const sName = oCtx.getProperty("name");

                                  sap.m.MessageBox.confirm(
                                    `Are you sure you want to delete the OAuth2 provider "${sName}"?`,
                                    {
                                      onClose: (oAction) => {
                                        if (
                                          oAction === sap.m.MessageBox.Action.OK
                                        ) {
                                          const oModel =
                                            this.getView().getModel();
                                          const oDeleteAction =
                                            oModel.bindContext(
                                              "/deleteOAuth2Provider(...)",
                                            );
                                          oDeleteAction.setParameter("ID", sID);
                                          oDeleteAction
                                            .execute()
                                            .then(() => {
                                              MessageToast.show(
                                                "OAuth2 provider deleted successfully",
                                              );
                                              this._loadOAuth2Providers();
                                            })
                                            .catch((oError) => {
                                              MessageToast.show(
                                                "Error deleting provider: " +
                                                  oError.message,
                                              );
                                            });
                                        }
                                      },
                                    },
                                  );
                                },
                              }),
                            ],
                          }),
                        ],
                      }),
                      new Text({ text: "URL: {ui>tokenUrl}" }).addStyleClass(
                        "sapUiTinyMarginTop",
                      ),
                      new Text({
                        text: "Description: {ui>description}",
                      }).addStyleClass("sapUiTinyMarginTop"),
                    ],
                  }).addStyleClass("sapUiSmallMargin"),
                }),
              },
            }),
            new Button({
              text: "Add OAuth2 Provider",
              icon: "sap-icon://add",
              press: () => this._onOpenProviderDialog(),
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
        const oModel = this.getView().getModel();

        const oKey = new Input({
          placeholder: "Model Key (e.g., gpt-4)",
          value: bEdit ? oContext.getProperty("modelKey") : "",
          editable: !bEdit,
        });
        const oName = new Input({
          placeholder: "Display Name",
          value: bEdit ? oContext.getProperty("name") : "",
        });

        const oUrlValidationText = new Text({
          text: "",
        }).addStyleClass("sapUiTinyMarginTop");

        const validateUrl = () => {
          const sUrl = oUrl.getValue();
          const sCategory = oModelCategorySelect.getSelectedKey();
          if (sUrl && sCategory) {
            this._validateDeploymentUrl(sUrl, sCategory)
              .then((oResult) => {
                if (oResult.valid) {
                  oUrlValidationText.setText("✓ " + oResult.message);
                  oUrlValidationText.removeStyleClass("errorText");
                  oUrlValidationText.addStyleClass("successText");
                } else {
                  oUrlValidationText.setText("⚠ " + oResult.message);
                  oUrlValidationText.removeStyleClass("successText");
                  oUrlValidationText.addStyleClass("errorText");
                  if (oResult.suggestedUrl) {
                    oUrl.setValueState("Warning");
                    oUrl.setValueStateText(
                      "Suggested: " + oResult.suggestedUrl,
                    );
                  }
                }
              })
              .catch(() => {
                oUrlValidationText.setText("");
              });
          }
        };

        const oModelCategorySelect = new sap.m.Select({
          selectedKey: bEdit
            ? oContext.getProperty("modelCategory")
            : "sap-abap",
          items: [
            new sap.ui.core.Item({ key: "sap-abap", text: "SAP ABAP" }),
            new sap.ui.core.Item({
              key: "claude-anthropic",
              text: "Claude Anthropic",
            }),
            new sap.ui.core.Item({ key: "openai-gpt", text: "OpenAI GPT" }),
            new sap.ui.core.Item({ key: "custom", text: "Custom" }),
          ],
          change: validateUrl,
        });

        const oUrl = new Input({
          placeholder: "Deployment URL",
          value: bEdit ? oContext.getProperty("deploymentUrl") : "",
          change: validateUrl,
        });
        const oPrompt = new TextArea({
          placeholder: "System Prompt (optional)",
          rows: 3,
          width: "100%",
          value: bEdit ? oContext.getProperty("systemPrompt") : "",
        });

        const oAuthTypeSelect = new sap.m.Select({
          selectedKey: bEdit ? oContext.getProperty("authType") : "bearer",
          items: [
            new sap.ui.core.Item({
              key: "bearer",
              text: "Bearer Token (AI Core)",
            }),
            new sap.ui.core.Item({
              key: "oauth2",
              text: "OAuth2 Client Credentials",
            }),
            new sap.ui.core.Item({ key: "none", text: "No Authentication" }),
          ],
          change: (oEvent) => {
            const sAuthType = oEvent.getParameter("selectedItem").getKey();
            oOAuth2Box.setVisible(sAuthType === "oauth2");
          },
        });

        const oUseProviderCheckbox = new sap.m.CheckBox({
          text: "Use OAuth2 Provider",
          selected: false,
          select: (oEvent) => {
            const bSelected = oEvent.getParameter("selected");
            oProviderSelect.setVisible(bSelected);
            oOAuth2DirectBox.setVisible(!bSelected);
          },
        });

        const oProviderSelect = new sap.m.Select({
          visible: false,
          items: {
            path: "ui>/oauth2Providers",
            template: new sap.ui.core.Item({
              key: "{ui>ID}",
              text: "{ui>name}",
            }),
          },
        });

        const oTokenUrl = new Input({
          placeholder: "Token URL (e.g., https://auth.example.com/oauth/token)",
          value: bEdit ? oContext.getProperty("tokenUrl") : "",
        });
        const oClientId = new Input({
          placeholder: "Client ID",
          value: bEdit ? oContext.getProperty("clientId") : "",
        });
        const oClientSecret = new Input({
          placeholder: bEdit
            ? "Client Secret (leave empty to keep current)"
            : "Client Secret",
          type: "Password",
          value: "",
        });
        const oScope = new Input({
          placeholder: "Scope (optional)",
          value: bEdit ? oContext.getProperty("scope") : "",
        });

        const oOAuth2DirectBox = new VBox({
          visible: true,
          items: [
            new Label({ text: "Token URL" }),
            oTokenUrl,
            new Label({ text: "Client ID" }),
            oClientId,
            new Label({ text: "Client Secret" }),
            oClientSecret,
            new Label({ text: "Scope" }),
            oScope,
          ],
        }).addStyleClass("sapUiSmallMarginTop");

        const oOAuth2Box = new VBox({
          visible: bEdit
            ? oContext.getProperty("authType") === "oauth2"
            : false,
          items: [oUseProviderCheckbox, oProviderSelect, oOAuth2DirectBox],
        }).addStyleClass("sapUiSmallMarginTop");

        const oTemperature = new sap.m.StepInput({
          value: bEdit ? oContext.getProperty("temperature") : 0.7,
          min: 0,
          max: 2,
          step: 0.1,
          displayValuePrecision: 2,
          width: "100%",
        });

        const oMaxTokens = new sap.m.StepInput({
          value: bEdit ? oContext.getProperty("maxTokens") : 2000,
          min: 1,
          max: 32000,
          step: 100,
          width: "100%",
        });

        const oAdvancedBox = new VBox({
          items: [
            new Label({ text: "Temperature" }),
            oTemperature,
            new Label({ text: "Max Tokens" }),
            oMaxTokens,
          ],
        }).addStyleClass("sapUiSmallMarginTop");

        const oDialog = new Dialog({
          title: bEdit ? "Edit Model" : "Add New AI Model",
          contentWidth: "600px",
          content: [
            new VBox({
              items: [
                new Label({ text: "Model Key" }),
                oKey,
                new Label({ text: "Display Name" }),
                oName,
                new Label({ text: "Model Category" }),
                oModelCategorySelect,
                new Label({ text: "Deployment URL" }),
                oUrl,
                oUrlValidationText,
                new Label({ text: "System Prompt" }),
                oPrompt,
                new Label({ text: "Authentication Type" }),
                oAuthTypeSelect,
                oOAuth2Box,
                new Label({
                  text: "Advanced Parameters",
                  design: "Bold",
                }).addStyleClass("sapUiSmallMarginTop"),
                oAdvancedBox,
              ],
            }).addStyleClass("sapUiSmallMargin"),
          ],
          beginButton: new Button({
            text: bEdit ? "Save" : "Add",
            type: "Emphasized",
            press: () => {
              const sAuthType = oAuthTypeSelect.getSelectedKey();
              const bUseProvider = oUseProviderCheckbox.getSelected();
              const sProviderId = bUseProvider
                ? oProviderSelect.getSelectedKey()
                : null;

              const oData = {
                key: oKey.getValue(),
                name: oName.getValue(),
                modelCategory: oModelCategorySelect.getSelectedKey(),
                deploymentUrl: oUrl.getValue(),
                systemPrompt: oPrompt.getValue(),
                authType: sAuthType,
                tokenUrl:
                  sAuthType === "oauth2" && !bUseProvider
                    ? oTokenUrl.getValue()
                    : "",
                clientId:
                  sAuthType === "oauth2" && !bUseProvider
                    ? oClientId.getValue()
                    : "",
                clientSecret:
                  sAuthType === "oauth2" && !bUseProvider
                    ? oClientSecret.getValue()
                    : "",
                scope:
                  sAuthType === "oauth2" && !bUseProvider
                    ? oScope.getValue()
                    : "",
                oauth2ProviderId: sProviderId,
                temperature: oTemperature.getValue(),
                maxTokens: oMaxTokens.getValue(),
                topP: 1.0,
                frequencyPenalty: 0.0,
                presencePenalty: 0.0,
              };

              oDialog.setBusy(true);

              if (bEdit) {
                const sID = oContext.getProperty("ID");
                const oAction = oModel.bindContext("/updateModel(...)");
                oAction.setParameter("ID", sID);
                oAction.setParameter("name", oData.name);
                oAction.setParameter("modelCategory", oData.modelCategory);
                oAction.setParameter("deploymentUrl", oData.deploymentUrl);
                oAction.setParameter("systemPrompt", oData.systemPrompt);
                oAction.setParameter("authType", oData.authType);
                oAction.setParameter("tokenUrl", oData.tokenUrl);
                oAction.setParameter("clientId", oData.clientId);
                oAction.setParameter("clientSecret", oData.clientSecret);
                oAction.setParameter("scope", oData.scope);
                oAction.setParameter("temperature", oData.temperature);
                oAction.setParameter("maxTokens", oData.maxTokens);
                oAction.setParameter("topP", oData.topP);
                oAction.setParameter(
                  "frequencyPenalty",
                  oData.frequencyPenalty,
                );
                oAction.setParameter("presencePenalty", oData.presencePenalty);

                oAction
                  .execute()
                  .then(() => {
                    oDialog.close();
                    MessageToast.show("Model updated successfully");
                    this._loadModels();
                  })
                  .catch((oError) => {
                    oDialog.setBusy(false);
                    MessageToast.show(
                      "Error updating model: " + oError.message,
                    );
                  });
              } else {
                const oAction = oModel.bindContext("/createModel(...)");
                oAction.setParameter("key", oData.key);
                oAction.setParameter("name", oData.name);
                oAction.setParameter("modelCategory", oData.modelCategory);
                oAction.setParameter("deploymentUrl", oData.deploymentUrl);
                oAction.setParameter("systemPrompt", oData.systemPrompt);
                oAction.setParameter("authType", oData.authType);
                oAction.setParameter("tokenUrl", oData.tokenUrl);
                oAction.setParameter("clientId", oData.clientId);
                oAction.setParameter("clientSecret", oData.clientSecret);
                oAction.setParameter("scope", oData.scope);
                oAction.setParameter(
                  "oauth2ProviderId",
                  oData.oauth2ProviderId,
                );
                oAction.setParameter("temperature", oData.temperature);
                oAction.setParameter("maxTokens", oData.maxTokens);
                oAction.setParameter("topP", oData.topP);
                oAction.setParameter(
                  "frequencyPenalty",
                  oData.frequencyPenalty,
                );
                oAction.setParameter("presencePenalty", oData.presencePenalty);

                oAction
                  .execute()
                  .then(() => {
                    oDialog.close();
                    MessageToast.show("Model added successfully");
                    this._loadModels();
                  })
                  .catch((oError) => {
                    oDialog.setBusy(false);
                    MessageToast.show("Error adding model: " + oError.message);
                  });
              }
            },
          }),
          endButton: new Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),
        });
        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      _onOpenProviderDialog: function (oContext) {
        const bEdit = !!oContext;
        const oModel = this.getView().getModel();

        const oName = new Input({
          placeholder: "Provider Name",
          value: bEdit ? oContext.getProperty("name") : "",
        });

        const oDescription = new TextArea({
          placeholder: "Description (optional)",
          rows: 2,
          value: bEdit ? oContext.getProperty("description") : "",
        });

        const oTokenUrl = new Input({
          placeholder: "Token URL",
          value: bEdit ? oContext.getProperty("tokenUrl") : "",
        });

        const oClientId = new Input({
          placeholder: "Client ID",
          value: bEdit ? oContext.getProperty("clientId") : "",
        });

        const oClientSecret = new Input({
          placeholder: bEdit
            ? "Client Secret (leave empty to keep current)"
            : "Client Secret",
          type: "Password",
          value: "",
        });

        const oScope = new Input({
          placeholder: "Scope (optional)",
          value: bEdit ? oContext.getProperty("scope") : "",
        });

        const oDialog = new Dialog({
          title: bEdit ? "Edit OAuth2 Provider" : "Add OAuth2 Provider",
          contentWidth: "500px",
          content: [
            new VBox({
              items: [
                new Label({ text: "Name" }),
                oName,
                new Label({ text: "Description" }),
                oDescription,
                new Label({ text: "Token URL" }),
                oTokenUrl,
                new Label({ text: "Client ID" }),
                oClientId,
                new Label({ text: "Client Secret" }),
                oClientSecret,
                new Label({ text: "Scope" }),
                oScope,
              ],
            }).addStyleClass("sapUiSmallMargin"),
          ],
          beginButton: new Button({
            text: bEdit ? "Save" : "Add",
            type: "Emphasized",
            press: () => {
              const oData = {
                name: oName.getValue(),
                description: oDescription.getValue(),
                tokenUrl: oTokenUrl.getValue(),
                clientId: oClientId.getValue(),
                clientSecret: oClientSecret.getValue(),
                scope: oScope.getValue(),
              };

              oDialog.setBusy(true);

              if (bEdit) {
                const sID = oContext.getProperty("ID");
                const oAction = oModel.bindContext(
                  "/updateOAuth2Provider(...)",
                );
                oAction.setParameter("ID", sID);
                oAction.setParameter("name", oData.name);
                oAction.setParameter("description", oData.description);
                oAction.setParameter("tokenUrl", oData.tokenUrl);
                oAction.setParameter("clientId", oData.clientId);
                oAction.setParameter("clientSecret", oData.clientSecret);
                oAction.setParameter("scope", oData.scope);

                oAction
                  .execute()
                  .then(() => {
                    oDialog.close();
                    MessageToast.show("OAuth2 provider updated successfully");
                    this._loadOAuth2Providers();
                  })
                  .catch((oError) => {
                    oDialog.setBusy(false);
                    MessageToast.show(
                      "Error updating provider: " + oError.message,
                    );
                  });
              } else {
                const oAction = oModel.bindContext(
                  "/createOAuth2Provider(...)",
                );
                oAction.setParameter("name", oData.name);
                oAction.setParameter("description", oData.description);
                oAction.setParameter("tokenUrl", oData.tokenUrl);
                oAction.setParameter("clientId", oData.clientId);
                oAction.setParameter("clientSecret", oData.clientSecret);
                oAction.setParameter("scope", oData.scope);

                oAction
                  .execute()
                  .then(() => {
                    oDialog.close();
                    MessageToast.show("OAuth2 provider added successfully");
                    this._loadOAuth2Providers();
                  })
                  .catch((oError) => {
                    oDialog.setBusy(false);
                    MessageToast.show(
                      "Error adding provider: " + oError.message,
                    );
                  });
              }
            },
          }),
          endButton: new Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),
        });

        this.getView().addDependent(oDialog);
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
                .getProperty("modelKey");
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
                description: "{ui>modelKey}",
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

        const oUiModel = this.getView().getModel("ui");
        const aModels = oUiModel.getProperty("/availableModels");

        if (aModels && aModels.length > 0) {
          this._selectedModel = aModels[0].modelKey;
          this.getView().byId("modelSelectButton").setText(aModels[0].modelKey);
        } else {
          this._selectedModel = null;
          this.getView().byId("modelSelectButton").setText("No model");
        }
      },

      onConversationSelect: function (oEvent) {
        this._stopStreaming();
        const oItem = oEvent.getParameter("listItem");
        const oContext = oItem.getBindingContext();
        if (!oContext) return;

        this._selectedConversationId = oContext.getProperty("ID");
        this._selectedModel = oContext.getProperty("model");
        this.getView()
          .byId("modelSelectButton")
          .setText(this._selectedModel || "No model");

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
        console.log("[_bindMessages] Binding messages for context:", oContext);
        console.log("[_bindMessages] Context path:", oContext.getPath());

        const oMessageList = this.getView().byId("messageList");
        const FormattedText = sap.m.FormattedText;

        oMessageList.unbindItems();

        oMessageList.bindItems({
          path: oContext.getPath() + "/messages",
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
                    new FormattedText({
                      htmlText: {
                        parts: [{ path: "content" }, { path: "role" }],
                        formatter: this.formatMessageContent.bind(this),
                      },
                      width: "100%",
                    }),
                    new Text({
                      text: "{path: 'createdAt', type: 'sap.ui.model.type.DateTime', formatOptions: {style: 'short'}}",
                    }).addStyleClass("chatTimestamp"),
                  ],
                })
                  .addStyleClass("chatBubble")
                  .addStyleClass(
                    "{= ${role} === 'user' ? 'userBubble' : 'assistantBubble' }",
                  ),
              ],
            }).addStyleClass("sapUiSmallMargin"),
          }).addStyleClass("messageRow"),
          events: {
            change: () => this._scrollToBottom(),
            dataReceived: () => this._scrollToBottom(),
          },
        });
        this._scrollToBottom();
      },

      formatMessageContent: function (sContent, sRole) {
        if (sRole === "user") {
          return sContent
            ? sContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")
            : "";
        }

        if (!sContent) return "";

        if (!window.marked || !window.DOMPurify) {
          return sContent;
        }

        try {
          let html = window.marked.parse(sContent);

          html = window.DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
              "p",
              "br",
              "strong",
              "em",
              "u",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "ul",
              "ol",
              "li",
              "code",
              "pre",
              "blockquote",
              "a",
              "table",
              "thead",
              "tbody",
              "tr",
              "th",
              "td",
            ],
            ALLOWED_ATTR: ["href", "class", "target", "rel"],
          });

          return html;
        } catch (error) {
          console.error("Error converting markdown:", error);
          return sContent;
        }
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

      _scrollToBottomImmediate: function () {
        const oScrollContainer = this.getView().byId("scrollContainer");
        const oDomRef = oScrollContainer ? oScrollContainer.getDomRef() : null;
        if (oDomRef) {
          oDomRef.scrollTop = oDomRef.scrollHeight;
        }
      },

      onSendMessage: function () {
        const oInput = this.getView().byId("chatInput");
        const sText = oInput.getValue();
        if (!sText) return;

        if (!this._selectedModel) {
          sap.m.MessageBox.error(
            "Please select a model first. Go to Settings to add a model.",
          );
          return;
        }

        const oModel = this.getView().getModel();
        const oUiModel = this.getView().getModel("ui");
        const oChatPage = this.getView().byId("chatPage");

        oInput.setValue("");

        oUiModel.setProperty("/isStreaming", true);
        oUiModel.setProperty("/streamingText", "");

        const sStartConvId = this._selectedConversationId;

        fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: this._selectedConversationId,
            text: sText,
            model: this._selectedModel,
          }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error("Network response was not ok");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamedText = "";

            const readStream = () => {
              reader.read().then(({ done, value }) => {
                if (done) {
                  oUiModel.setProperty("/isStreaming", false);
                  oUiModel.setProperty("/streamingText", "");

                  oModel.refresh();

                  if (!sStartConvId) {
                    setTimeout(() => {
                      const oConvList = this.getView().byId("conversationList");
                      const aItems = oConvList.getItems();
                      if (aItems.length > 0) {
                        oConvList.setSelectedItem(aItems[0]);
                        const oContext = aItems[0].getBindingContext();
                        this._selectedConversationId =
                          oContext.getProperty("ID");
                        this._bindMessages(oContext);
                        oChatPage.setBindingContext(oContext);
                      }
                      setTimeout(() => this._scrollToBottom(), 300);
                    }, 500);
                  } else {
                    const oContext = oChatPage.getBindingContext();
                    if (oContext) {
                      this._bindMessages(oContext);
                    }
                    setTimeout(() => this._scrollToBottom(), 300);
                  }
                  return;
                }

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    try {
                      const data = JSON.parse(line.substring(6));

                      if (data.error) {
                        oUiModel.setProperty("/isStreaming", false);
                        sap.m.MessageBox.error(data.error, {
                          title: "Error",
                          actions: [sap.m.MessageBox.Action.CLOSE],
                        });
                        return;
                      }

                      if (data.done) {
                        if (data.conversationId && !sStartConvId) {
                          this._selectedConversationId = data.conversationId;
                        }
                      } else if (data.content) {
                        streamedText += data.content;
                        const htmlContent = this.formatMessageContent(
                          streamedText,
                          "assistant",
                        );
                        oUiModel.setProperty("/streamingText", htmlContent);
                        this._scrollToBottomImmediate();
                      }
                    } catch (e) {
                      console.error("Error parsing SSE data:", e);
                    }
                  }
                }

                readStream();
              });
            };

            readStream();
          })
          .catch((oError) => {
            oUiModel.setProperty("/isStreaming", false);
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

      onExportConversation: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext();
        const sId = oContext.getProperty("ID");
        const sTitle = oContext.getProperty("title");

        const oModel = this.getView().getModel();
        const oAction = oModel.bindContext("/exportConversation(...)");
        oAction.setParameter("conversationId", sId);

        oAction
          .execute()
          .then(() => {
            const oResult = oAction.getBoundContext().getObject();
            const sJson = oResult.value;

            const blob = new Blob([sJson], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${sTitle.replace(/[^a-z0-9]/gi, "_")}_export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            MessageToast.show("Conversation exported successfully");
          })
          .catch((oError) => {
            MessageToast.show(
              "Error exporting conversation: " + oError.message,
            );
          });
      },

      onImportConversation: function () {
        const oFileUploader = new sap.ui.unified.FileUploader({
          fileType: ["json"],
          change: (oEvent) => {
            const oFile = oEvent.getParameter("files")[0];
            if (oFile) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const sContent = e.target.result;

                const oModel = this.getView().getModel();
                const oAction = oModel.bindContext("/importConversation(...)");
                oAction.setParameter("data", sContent);

                oAction
                  .execute()
                  .then(() => {
                    MessageToast.show("Conversation imported successfully");
                    oModel.refresh();
                    oDialog.close();
                  })
                  .catch((oError) => {
                    MessageToast.show(
                      "Error importing conversation: " + oError.message,
                    );
                  });
              };
              reader.readAsText(oFile);
            }
          },
        });

        const oDialog = new Dialog({
          title: "Import Conversation",
          content: [
            new VBox({
              items: [
                new Text({ text: "Select a JSON file to import:" }),
                oFileUploader,
              ],
            }).addStyleClass("sapUiSmallMargin"),
          ],
          beginButton: new Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),
        });

        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      onEditMessage: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext();
        const sId = oContext.getProperty("ID");
        const sContent = oContext.getProperty("content");

        const oTextArea = new TextArea({
          value: sContent,
          rows: 5,
          width: "100%",
        });

        const oDialog = new Dialog({
          title: "Edit Message",
          content: [
            new VBox({
              items: [oTextArea],
            }).addStyleClass("sapUiSmallMargin"),
          ],
          beginButton: new Button({
            text: "Save",
            type: "Emphasized",
            press: () => {
              const sNewContent = oTextArea.getValue();

              const oModel = this.getView().getModel();
              const oAction = oModel.bindContext("/editMessage(...)");
              oAction.setParameter("messageId", sId);
              oAction.setParameter("newContent", sNewContent);

              oAction
                .execute()
                .then(() => {
                  MessageToast.show("Message edited successfully");
                  oModel.refresh();
                  oDialog.close();
                })
                .catch((oError) => {
                  MessageToast.show("Error editing message: " + oError.message);
                });
            },
          }),
          endButton: new Button({
            text: "Cancel",
            press: () => oDialog.close(),
          }),
        });

        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      onRegenerateMessage: function (oEvent) {
        const oContext = oEvent.getSource().getBindingContext();
        const sId = oContext.getProperty("ID");

        sap.m.MessageBox.confirm(
          "Are you sure you want to regenerate this response?",
          {
            onClose: (oAction) => {
              if (oAction === sap.m.MessageBox.Action.OK) {
                const oModel = this.getView().getModel();
                const oActionBinding = oModel.bindContext(
                  "/regenerateMessage(...)",
                );
                oActionBinding.setParameter("messageId", sId);

                this.getView().byId("chatPage").setBusy(true);

                oActionBinding
                  .execute()
                  .then(() => {
                    MessageToast.show("Message regenerated successfully");
                    oModel.refresh();
                    this.getView().byId("chatPage").setBusy(false);
                  })
                  .catch((oError) => {
                    MessageToast.show(
                      "Error regenerating message: " + oError.message,
                    );
                    this.getView().byId("chatPage").setBusy(false);
                  });
              }
            },
          },
        );
      },
    });
  },
);
