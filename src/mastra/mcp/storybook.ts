import { MCPClient } from "@mastra/mcp";

export const storybookMcpClient = new MCPClient({
  id: "storybook-mcp-client",
  servers: {
    storybook: {
      command: "npx",
      args: ["-y", "storybook-mcp@latest"],
      env: {
        STORYBOOK_URL: "https://kargo.beacon.com/stories.json",
      },
    },
  },
});
