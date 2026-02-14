# OpenCAP AI Chat Studio

A professional-grade AI Chat interface built using the **SAP Cloud Application Programming Model (CAP)** and **SAPUI5**. This project provides a robust foundation for building enterprise AI assistants with multi-model support and a polished user experience.

## Key Features

- **Multi-Model Management**: Configure, edit, and switch between different AI models (GPT-4, Claude, etc.) per conversation.
- **Realistic Streaming Simulation**: Experience a 5-second animated typing effect that mimics real-time LLM streaming.
- **Advanced UI/UX**:
  - Split-screen layout with conversation history.
  - Theme switching (Light, Dark, and System Auto-sync).
  - Message actions (Copy to clipboard, Retry).
  - Modern "bubble" chat interface with distinct user/assistant styling.
- **Enterprise-Ready Architecture**: Follows SAP Clean Core principles and Official SDK patterns.
- **Local Development**: Built-in mock data and local SQLite support for rapid prototyping.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [SAP CDS DK](https://cap.cloud.sap/docs/get-started/) (`npm i -g @sap/cds-dk`)

## Getting Started

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Run the application**:
   ```bash
   npm run watch
   ```
4. **Access the UI**: Open [http://localhost:4004/webapp/index.html](http://localhost:4004/webapp/index.html)

## Model Configuration

Each model can be configured in the settings menu with:
- **Deployment URL**: The SAP AI Core deployment endpoint.
- **System Prompt**: The base instructions for the AI behavior.

## Project Structure

- `db/`: Database schema and initial mock data.
- `srv/`: CAP service logic and AI mock implementations.
- `app/`: SAPUI5 frontend application.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
