import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { figmaMcpClient } from "../mcp/figma";

export const figmaAgent = new Agent({
  id: "figma-agent",
  name: "Figma Agent",
  instructions: `
    You are a helpful design assistant with access to Figma through the Figma MCP server.
    You can interact with the user's Figma desktop app to inspect designs, read design tokens,
    and provide context about design files.

    When responding:
    - Use the available Figma tools to fetch design information
    - Provide clear, structured summaries of design elements
    - Help translate design details into actionable development guidance
  `,
  model: "anthropic/claude-sonnet-4-5",
  tools: await figmaMcpClient.listTools(),
  memory: new Memory(),
});
