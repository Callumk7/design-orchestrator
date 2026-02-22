import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import componentsRaw from '../../data/components.json';
import tokensRaw from '../../data/tokens.json';

const componentsData = componentsRaw as unknown as ComponentsFile;
const tokensData = tokensRaw as unknown as TokensFile;

// ─── Type definitions ────────────────────────────────────────────────────────

type PropDefinition = {
  type: string;
  required: boolean;
  description: string;
  defaultValue: unknown;
};

type ComponentData = {
  description: string;
  category: string;
  filePath: string;
  isFormControl: boolean;
  isSubComponent: boolean;
  parentComponent: string | null;
  props: Record<string, PropDefinition>;
  styledSystemGroups: string[];
  composes: string[];
};

type StyledSystemPropDefinition = {
  type: string;
  required: boolean;
  description: string;
  defaultValue: unknown;
};

type ComponentsFile = {
  metadata: { categories: string[]; total_components: number };
  components: Record<string, ComponentData>;
  category_index: Record<string, string[]>;
  styled_system_props: Record<string, Record<string, StyledSystemPropDefinition>>;
};

type TokenCategory = Record<string, unknown>;

type TokensFile = {
  metadata: { categories: string[] };
  platform: Record<string, TokenCategory>;
  marketing: Record<string, TokenCategory>;
};

// ─── get_component ───────────────────────────────────────────────────────────

const componentResultSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  filePath: z.string(),
  isFormControl: z.boolean(),
  isSubComponent: z.boolean(),
  parentComponent: z.string().nullable(),
  props: z.record(
    z.string(),
    z.object({
      type: z.string(),
      required: z.boolean(),
      description: z.string(),
      defaultValue: z.unknown(),
    }),
  ),
  styledSystemGroups: z.array(z.string()),
  composes: z.array(z.string()),
});

export const getComponentTool = createTool({
  id: 'get_component',
  description:
    'Query the component library to check whether a UI component exists. ' +
    'Returns full component details (props, category, file path) for an exact match, ' +
    'or a list of similarly-named components when no exact match is found. ' +
    'Always call this tool for every distinct UI element you identify.',
  inputSchema: z.object({
    name: z
      .string()
      .describe('The component name to look up, e.g. "Button", "Modal", "Input"'),
  }),
  outputSchema: z.object({
    found: z.boolean().describe('True when an exact (case-insensitive) match was found'),
    exact_match: componentResultSchema
      .nullable()
      .describe('Full component data when found, otherwise null'),
    similar_components: z
      .array(
        z.object({
          name: z.string(),
          category: z.string(),
          description: z.string(),
        }),
      )
      .describe('Partial name matches returned when no exact match exists'),
    all_component_names: z
      .array(z.string())
      .describe('Complete list of every component in the library'),
  }),
  execute: async ({ name }) => {
    const components = componentsData.components;

    // Exact match (case-insensitive)
    const exactKey = Object.keys(components).find(
      k => k.toLowerCase() === name.toLowerCase(),
    );

    if (exactKey) {
      const comp = components[exactKey];
      return {
        found: true,
        exact_match: {
          name: exactKey,
          description: comp.description,
          category: comp.category,
          filePath: comp.filePath,
          isFormControl: comp.isFormControl,
          isSubComponent: comp.isSubComponent,
          parentComponent: comp.parentComponent ?? null,
          props: comp.props,
          styledSystemGroups: comp.styledSystemGroups ?? [],
          composes: comp.composes ?? [],
        },
        similar_components: [],
        all_component_names: Object.keys(components),
      };
    }

    // Partial match fallback
    const lowerName = name.toLowerCase();
    const similar = Object.keys(components)
      .filter(
        k =>
          k.toLowerCase().includes(lowerName) ||
          lowerName.includes(k.toLowerCase()),
      )
      .map(k => ({
        name: k,
        category: components[k].category,
        description: components[k].description,
      }));

    return {
      found: false,
      exact_match: null,
      similar_components: similar,
      all_component_names: Object.keys(components),
    };
  },
});

// ─── get_design_tokens ───────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'colors',
  'spacing',
  'typography',
  'shadows',
  'borders',
  'breakpoints',
  'zIndexes',
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

export const getDesignTokensTool = createTool({
  id: 'get_design_tokens',
  description:
    'Query the design token library. ' +
    'Returns token key→value pairs for the requested category (or all categories). ' +
    'Every visual property in a component spec MUST reference a token from this tool — ' +
    'never hard-code values like "#3B82F6" or "16px". ' +
    `Valid categories: ${VALID_CATEGORIES.join(', ')}.`,
  inputSchema: z.object({
    category: z
      .enum(VALID_CATEGORIES)
      .optional()
      .describe(
        'Optional category filter. Omit to receive all token categories at once.',
      ),
    theme: z
      .enum(['platform', 'marketing'])
      .optional()
      .default('platform')
      .describe('Which theme to query. Defaults to "platform".'),
  }),
  outputSchema: z.object({
    theme: z.string(),
    categories_returned: z.array(z.string()),
    tokens: z.record(z.string(), z.record(z.string(), z.unknown())),
  }),
  execute: async ({ category, theme = 'platform' }) => {
    const themeTokens = tokensData[theme] as Record<string, TokenCategory>;

    if (category) {
      const categoryTokens = themeTokens[category as ValidCategory];
      return {
        theme,
        categories_returned: [category],
        tokens: { [category]: categoryTokens ?? {} },
      };
    }

    // Return all categories
    return {
      theme,
      categories_returned: Object.keys(themeTokens),
      tokens: themeTokens as Record<string, Record<string, unknown>>,
    };
  },
});

// ─── list_components ─────────────────────────────────────────────────────────

const VALID_COMPONENT_CATEGORIES = [
  'base',
  'buttons',
  'data-display',
  'feedback',
  'forms',
  'navigation',
  'surfaces',
] as const;

export const listComponentsTool = createTool({
  id: 'list_components',
  description:
    'List all available components in the library, optionally filtered by category. ' +
    'Use this for discovery before calling get_component() on a specific name — ' +
    'it shows what exists in each category so you can pick the right name to look up. ' +
    `Valid categories: ${VALID_COMPONENT_CATEGORIES.join(', ')}.`,
  inputSchema: z.object({
    category: z
      .enum(VALID_COMPONENT_CATEGORIES)
      .optional()
      .describe('Filter by category. Omit to list all components.'),
  }),
  outputSchema: z.object({
    total: z.number(),
    components: z.array(
      z.object({
        name: z.string(),
        category: z.string(),
        description: z.string(),
        isFormControl: z.boolean(),
        isSubComponent: z.boolean(),
      }),
    ),
  }),
  execute: async ({ category }) => {
    const components = componentsData.components;
    const categoryIndex = componentsData.category_index;

    const names = category ? (categoryIndex[category] ?? []) : Object.keys(components);

    const result = names.map(name => {
      const comp = components[name];
      return {
        name,
        category: comp?.category ?? category ?? 'unknown',
        description: comp?.description ?? '',
        isFormControl: comp?.isFormControl ?? false,
        isSubComponent: comp?.isSubComponent ?? false,
      };
    });

    return { total: result.length, components: result };
  },
});

// ─── get_styled_system_props ─────────────────────────────────────────────────

export const getStyledSystemPropsTool = createTool({
  id: 'get_styled_system_props',
  description:
    'Returns the CSS prop definitions for styled-system prop groups (e.g. SpaceProps, ColorProps). ' +
    'Use this to know which CSS properties a Box-based component accepts and what token values to pass. ' +
    'Call with a group name like "SpaceProps" or omit to list all group names.',
  inputSchema: z.object({
    group: z
      .string()
      .optional()
      .describe(
        'The styled-system group name, e.g. "SpaceProps". Omit to list all available group names.',
      ),
  }),
  outputSchema: z.object({
    available_groups: z.array(z.string()),
    props: z.record(
      z.string(),
      z.object({
        type: z.string(),
        required: z.boolean(),
        description: z.string(),
      }),
    ),
  }),
  execute: async ({ group }) => {
    const styledSystemProps = componentsData.styled_system_props ?? {};
    const allGroups = Object.keys(styledSystemProps);

    if (!group) {
      return { available_groups: allGroups, props: {} };
    }

    const groupData = styledSystemProps[group] ?? {};
    const props = Object.fromEntries(
      Object.entries(groupData).map(([propName, def]) => [
        propName,
        {
          type: def.type,
          required: def.required,
          description: def.description,
        },
      ]),
    );

    return { available_groups: allGroups, props };
  },
});
