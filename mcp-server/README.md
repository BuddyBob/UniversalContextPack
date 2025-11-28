# UCP Memory MCP Server

This is a Model Context Protocol (MCP) server that allows you to add memories to your Universal Context Pack directly from your LLM interface (like Claude Desktop).

## Prerequisites

-   Node.js installed
-   A Universal Context Pack account and API Key (JWT Token)

## Installation

1.  Navigate to this directory:
    ```bash
    cd mcp-server
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Build the server:
    ```bash
    npm run build
    ```

## Configuration

### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ucp-memory": {
      "command": "node",
      "args": [
        "/absolute/path/to/UCPv6/mcp-server/build/index.js"
      ],
      "env": {
        "UCP_API_KEY": "YOUR_UCP_JWT_TOKEN",
        "UCP_API_URL": "http://localhost:8000" 
      }
    }
  }
}
```

> **Note:** Replace `YOUR_UCP_JWT_TOKEN` with your actual JWT token from the UCP website (you can find this in your browser's local storage or network requests when logged in). In a production version, we would provide a proper API Key generation UI.

## Usage

Once configured, you can ask Claude:

> "Remember that my favorite color is blue."
> "Save a memory: The project deadline is next Friday."

Claude will use the `add_memory` tool to save this information to your Context Pack.
