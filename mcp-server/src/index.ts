#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { UcpMemoryServer } from "./server.js";

dotenv.config();

const API_URL = process.env.UCP_API_URL || "http://localhost:8000";
const API_KEY = process.env.UCP_API_KEY;

if (!API_KEY) {
    console.error("Error: UCP_API_KEY environment variable is required");
    process.exit(1);
}

async function main() {
    const serverInstance = new UcpMemoryServer(API_URL, API_KEY!);
    const transport = new StdioServerTransport();
    await serverInstance.server.connect(transport);
    console.error("UCP Memory MCP Server running on stdio");

    process.on("SIGINT", async () => {
        await serverInstance.server.close();
        process.exit(0);
    });
}

main().catch(console.error);
