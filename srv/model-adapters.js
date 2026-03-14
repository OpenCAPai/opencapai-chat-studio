function buildRequestBody(category, messages, modelKey, params, streaming = false) {
    switch (category) {
        case 'sap-abap':
            return buildSAPABAPRequest(messages, modelKey, params, streaming);

        case 'claude-anthropic':
            return buildClaudeRequest(messages, modelKey, params, streaming);

        case 'openai-gpt':
            return buildOpenAIRequest(messages, modelKey, params, streaming);

        case 'custom':
        default:
            return buildSAPABAPRequest(messages, modelKey, params, streaming);
    }
}

function buildSAPABAPRequest(messages, modelKey, params, streaming) {
    return {
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
                            temperature: params.temperature || 0.1,
                            max_tokens: params.maxTokens || 2000
                        }
                    }
                }
            },
            stream: {
                enabled: streaming,
                chunk_size: streaming ? 256 : undefined,
                delimiters: streaming ? ["\n"] : undefined
            }
        }
    };
}

function buildClaudeRequest(messages, modelKey, params, streaming) {
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const body = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: params.maxTokens || 2000,
        messages: userMessages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }))
    };

    if (systemMessage) {
        body.system = systemMessage.content;
    }

    if (params.temperature !== undefined) {
        body.temperature = params.temperature;
    }
    if (params.topP !== undefined && params.topP !== 1.0) {
        body.top_p = params.topP;
    }

    return body;
}

function buildOpenAIRequest(messages, modelKey, params, streaming) {
    const body = {
        model: modelKey,
        messages: messages.map(m => ({
            role: m.role,
            content: m.content
        })),
        temperature: params.temperature || 0.7,
        max_tokens: params.maxTokens || 2000
    };

    if (params.topP !== undefined && params.topP !== 1.0) {
        body.top_p = params.topP;
    }
    if (params.frequencyPenalty !== undefined && params.frequencyPenalty !== 0.0) {
        body.frequency_penalty = params.frequencyPenalty;
    }
    if (params.presencePenalty !== undefined && params.presencePenalty !== 0.0) {
        body.presence_penalty = params.presencePenalty;
    }

    if (streaming) {
        body.stream = true;
    }

    return body;
}

function parseResponse(category, response) {
    switch (category) {
        case 'sap-abap':
            return parseSAPABAPResponse(response);

        case 'claude-anthropic':
            return parseClaudeResponse(response);

        case 'openai-gpt':
            return parseOpenAIResponse(response);

        case 'custom':
        default:
            return parseSAPABAPResponse(response);
    }
}

function parseSAPABAPResponse(response) {
    if (response.choices && response.choices[0]) {
        return response.choices[0].message?.content || response.choices[0].text || "";
    }
    if (response.content) return response.content;
    if (response.text) return response.text;
    return JSON.stringify(response);
}

function parseClaudeResponse(response) {
    if (response.content && Array.isArray(response.content)) {
        return response.content.map(c => c.text || c.content || "").join("");
    }
    if (response.content) return response.content;
    return JSON.stringify(response);
}

function parseOpenAIResponse(response) {
    if (response.choices && response.choices[0]) {
        return response.choices[0].message?.content || response.choices[0].text || "";
    }
    return JSON.stringify(response);
}

function parseStreamChunk(category, data) {
    switch (category) {
        case 'sap-abap':
            return parseSAPABAPStreamChunk(data);

        case 'claude-anthropic':
            return parseClaudeStreamChunk(data);

        case 'openai-gpt':
            return parseOpenAIStreamChunk(data);

        case 'custom':
        default:
            return parseSAPABAPStreamChunk(data);
    }
}

function parseSAPABAPStreamChunk(data) {
    if (data.final_result && data.final_result.choices && data.final_result.choices[0]) {
        const choice = data.final_result.choices[0];
        return {
            content: choice.delta?.content || "",
            done: choice.finish_reason === 'stop'
        };
    }
    return { content: "", done: false };
}

function parseClaudeStreamChunk(data) {
    if (data.type === 'content_block_delta' && data.delta) {
        return {
            content: data.delta.text || "",
            done: false
        };
    }
    if (data.type === 'message_stop') {
        return { content: "", done: true };
    }
    return { content: "", done: false };
}

function parseOpenAIStreamChunk(data) {
    if (data.choices && data.choices[0]) {
        const choice = data.choices[0];
        return {
            content: choice.delta?.content || "",
            done: choice.finish_reason === 'stop'
        };
    }
    return { content: "", done: false };
}

function getHeaders(category, token, resourceGroup) {
    const baseHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    switch (category) {
        case 'sap-abap':
            return {
                ...baseHeaders,
                "AI-Resource-Group": resourceGroup || "default"
            };

        case 'claude-anthropic':
            return {
                ...baseHeaders,
                "anthropic-version": "2023-06-01"
            };

        case 'openai-gpt':
            return baseHeaders;

        case 'custom':
        default:
            return {
                ...baseHeaders,
                "AI-Resource-Group": resourceGroup || "default"
            };
    }
}

module.exports = {
    buildRequestBody,
    parseResponse,
    parseStreamChunk,
    getHeaders
};