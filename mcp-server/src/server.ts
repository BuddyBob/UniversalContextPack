import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

export class UcpMemoryServer {
    public server: Server;
    private apiUrl: string;
    private apiKey: string;

    constructor(apiUrl: string, apiKey: string) {
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.server = new Server(
            {
                name: "ucp-memory-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();

        // Error handling
        this.server.onerror = (error) => console.error("[MCP Error]", error);
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "add_memory",
                    description: "Add a new memory to your Universal Context Pack. Use this to save important information, facts, or context that you want to remember for later.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            text: {
                                type: "string",
                                description: "The content of the memory to save",
                            },
                        },
                        required: ["text"],
                    },
                },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== "add_memory") {
                throw new McpError(
                    ErrorCode.MethodNotFound,
                    `Unknown tool: ${request.params.name}`
                );
            }

            const { text } = request.params.arguments as { text: string };

            if (!text) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "text argument is required"
                );
            }

            try {
                const response = await axios.post(
                    `${this.apiUrl}/api/memory/add`,
                    {
                        text,
                        source: "MCP Tool",
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${this.apiKey}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                return {
                    content: [
                        {
                            type: "text",
                            text: `Memory added successfully! (Size: ${response.data.size} bytes)`,
                        },
                    ],
                };
            } catch (error: any) {
                const errorMessage =
                    error.response?.data?.detail || error.message || "Unknown error";
                console.error("Error adding memory:", errorMessage);

                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to add memory: ${errorMessage}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
}
