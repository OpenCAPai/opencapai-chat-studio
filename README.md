# OpenCAP AI Chat Studio

A production-ready AI chat interface built on the **SAP Cloud Application Programming Model (CAP)** and **SAPUI5**, designed for enterprise deployment with SAP AI Core integration. This open-source project provides a complete foundation for building scalable, multi-model AI assistants on SAP Business Technology Platform.

## Overview

OpenCAP AI Chat Studio is an enterprise-grade conversational AI platform that seamlessly integrates with SAP AI Core, enabling organizations to deploy and manage AI-powered chat interfaces with full control over model selection, configuration, and conversation management.

## Key Features

### AI Core Integration
- **Native SAP AI Core Support**: Direct integration with SAP AI Core deployment endpoints
- **Flexible Authentication**: JWT token-based authentication with configurable resource groups
- **Multi-Model Architecture**: Support for multiple AI models with per-conversation model selection
- **Dynamic Configuration**: Runtime configuration of AI endpoints without code changes

### Enterprise Features
- **Conversation Management**: Persistent conversation history with full CRUD operations
- **Model Configuration**: Centralized management of AI model deployments and system prompts
- **User Interface**: Professional SAPUI5-based interface with responsive design
- **Theme Support**: Light, dark, and system-synchronized themes
- **Message Operations**: Copy, edit, and delete message capabilities

### Technical Architecture
- **SAP CAP Backend**: Robust service layer following SAP Clean Core principles
- **SAPUI5 Frontend**: Modern, responsive UI built with SAP's enterprise UI framework
- **RESTful API**: OData v4 services for seamless integration
- **Database Flexibility**: 
  - **Development**: SQLite for local development
  - **Production**: SAP HANA Cloud for enterprise deployment
  - Automatic database switching based on environment
- **Streaming Display**: Progressive message rendering for enhanced user experience

## Prerequisites

### Required
- **Node.js**: v18 or higher (v20 LTS recommended)
- **SAP CDS Development Kit**: `npm install -g @sap/cds-dk`
- **Visual Studio Build Tools** (Windows): Required for SQLite native module compilation

### For Production Deployment
- **SAP BTP Account**: Cloud Foundry environment
- **SAP HANA Cloud**: Database service (hdi-shared plan minimum)
- **Cloud Foundry CLI**: For deployment (`cf` command)
- **MTA Build Tool**: For multi-target application builds (`mbt` command)

### Optional
- **SAP AI Core Access**: For production AI model integration
- **SAP Destination Service**: For secure credential management

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/OpenCAPai/opencapai-chat-studio.git
cd opencapai-chat-studio
```

### 2. Install Dependencies
```bash
npm install
```

**Note for Windows users**: If you encounter native module compilation errors, install Visual Studio Build Tools first.

### 3. Configure AI Core (Optional)

Create a `.env` file in the project root:

```env
AICORE_ENDPOINT="https://api.ai.prod-eu20.<REGION>.azure.ml.hana.ondemand.com/v2/inference/deployments/<YOUR_DEPLOYMENT_ID>/v2/completion"
AICORE_RESOURCE_GROUP="default"
AICORE_TOKEN="your-jwt-token-here"
```

Alternatively, configure AI Core credentials through the application's Settings UI after startup.

### 4. Start the Application

```bash
npm run watch
```

The application will be available at:
- **UI**: http://localhost:4004/webapp/index.html
- **API**: http://localhost:4004/odata/v4/chat

## Configuration

### AI Core Setup

1. **Access Settings**: Click the settings icon (⚙️) in the application header
2. **Configure AI Core**:
   - **Endpoint URL**: Your SAP AI Core deployment endpoint
   - **Resource Group**: The resource group name (typically "default")
   - **Authentication Token**: Your JWT token for AI Core authentication
3. **Save Configuration**: Click "Save AI Core Configuration"

### Model Management

Configure AI models in the Settings dialog:
- **Model ID**: Unique identifier for the model
- **Display Name**: User-friendly name shown in the UI
- **Deployment URL**: SAP AI Core deployment endpoint
- **System Prompt**: Base instructions defining the AI's behavior and personality

## Project Structure

```
opencapai-chat-studio/
├── app/                    # SAPUI5 Frontend Application
│   ├── webapp/
│   │   ├── controller/     # UI Controllers
│   │   ├── view/           # XML Views
│   │   └── Component.js    # Application Component
│   └── index.cds           # UI Annotations
├── db/                     # Database Schema
│   └── schema.cds          # Entity Definitions
├── srv/                    # CAP Service Layer
│   ├── chat-service.cds    # Service Definitions
│   └── chat-service.js     # Service Implementation
├── .env                    # Environment Configuration (not in repo)
├── package.json            # Dependencies and Scripts
└── README.md               # This file
```

## Development

### Local Development
```bash
npm run watch
```
Starts the application with hot-reload enabled for both backend and frontend changes.

### Production Build
```bash
npm run build
```

### Testing
```bash
npm test
```

## Database Configuration

The application automatically adapts to the environment:

### Local Development (SQLite)
```bash
# Default configuration - uses SQLite
npm run watch
```

### Local Development with HANA Cloud
```bash
# Deploy schema to HANA
cds deploy --to hana --store-credentials

# Start with production profile
NODE_ENV=production npm start
```

### Production (SAP HANA Cloud)
The application automatically uses HANA when deployed to SAP BTP Cloud Foundry with the HANA service bound.

## Deployment

### Quick Deployment with MTA

The recommended deployment method uses Multi-Target Application (MTA) for automated service provisioning:

```bash
# Install MTA Build Tool
npm install -g mbt

# Build MTA archive
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/opencapai-chat-studio_*.mtar
```

This automatically:
- Creates and configures SAP HANA HDI container
- Deploys database schema
- Sets up XSUAA authentication
- Deploys the application
- Configures all service bindings

### Manual Deployment

For step-by-step manual deployment:

1. **Create Services**:
   ```bash
   cf create-service hana hdi-shared opencapai-chat-studio-db
   cf create-service xsuaa application opencapai-chat-studio-uaa -c xs-security.json
   ```

2. **Build and Deploy**:
   ```bash
   npm run build
   cf push
   ```

### Detailed Deployment Guide

For comprehensive deployment instructions including:
- HANA Cloud setup
- Environment configuration
- Security setup
- Monitoring and troubleshooting

## API Documentation

### OData Services

- **GET** `/odata/v4/chat/Conversations` - List all conversations
- **GET** `/odata/v4/chat/Messages` - List all messages
- **POST** `/odata/v4/chat/sendMessage` - Send a message and receive AI response
- **GET** `/odata/v4/chat/getAICoreConfig` - Retrieve current AI Core configuration
- **POST** `/odata/v4/chat/saveAICoreConfig` - Update AI Core configuration

For complete API documentation, access the service metadata at: http://localhost:4004/odata/v4/chat/$metadata

## Contributing

We welcome contributions from the community !

### Development Guidelines
- Follow SAP CAP best practices
- Maintain code quality with ESLint
- Write comprehensive tests for new features
- Update documentation for API changes

## Security

- **Authentication**: Implement proper authentication mechanisms for production use
- **Token Management**: Store AI Core tokens securely using SAP Destination Service or credential stores
- **Data Privacy**: Ensure compliance with data protection regulations (GDPR, etc.)
- **API Security**: Use HTTPS in production and implement rate limiting

## Troubleshooting

### Common Issues

**Module compilation errors on Windows**
- Install Visual Studio Build Tools 2022

**AI Core connection failures**
- Verify endpoint URL and token validity
- Check network connectivity and firewall settings
- Ensure resource group name is correct

**Database errors (Local)**
- Delete `node_modules` and run `npm install` again
- Check SQLite installation
- Ensure Visual Studio Build Tools are installed (Windows)

**Database errors (Production)**
- Verify HANA service is bound: `cf services`
- Check database deployer logs: `cf logs opencapai-chat-studio-db-deployer --recent`

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Built with:
- [SAP Cloud Application Programming Model](https://cap.cloud.sap/docs/)
- [SAPUI5](https://sapui5.hana.ondemand.com/)
- [SAP AI Core](https://help.sap.com/docs/sap-ai-core)

## Support

- **Issues**: Report bugs and request features via [GitHub Issues](https://github.com/OpenCAPai/opencapai-chat-studio/issues)
- **Discussions**: Join the community in [GitHub Discussions](https://github.com/OpenCAPai/opencapai-chat-studio/discussions)
- **Documentation**: Comprehensive guides in the repository root

---

**OpenCAP AI Chat Studio** - Enterprise AI Chat Platform for SAP Ecosystems
