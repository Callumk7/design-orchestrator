import { MastraMCPServerDefinition, MCPClient } from "@mastra/mcp";

export const figmaMcpClient = new MCPClient({
  id: "figma-mcp-client",
  servers: {
    figma: {
      url: new URL("http://127.0.0.1:3845/mcp"),
      headers: {},
    } as MastraMCPServerDefinition,
  },
});
