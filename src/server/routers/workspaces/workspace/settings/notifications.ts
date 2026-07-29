import { z } from 'zod';
import { router } from '~/server/trpc';
import { workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';
import type {
  DiscordDmCategory,
  DiscordDmCategoryConfig,
  DiscordDmSettings,
} from '~/services/NewMongoTypes/Workspace.type';
import { DISCORD_DM_CATEGORIES } from '~/services/discordDmCategories';

// Re-export so existing importers keep working.
export { DISCORD_DM_CATEGORIES };

// A stored category value may be a legacy boolean or the richer config object.
// Normalise both into a config object the UI can consume.
function normalizeConfig(value: unknown): DiscordDmCategoryConfig {
  if (typeof value === 'boolean') return { enabled: value };
  if (value && typeof value === 'object') return value as DiscordDmCategoryConfig;
  return {};
}

const categoryConfigSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(256).optional(),
  message: z.string().max(2000).optional(),
});

const dmSettingsSchema = z.object(
  DISCORD_DM_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = categoryConfigSchema;
      return acc;
    },
    {} as Record<DiscordDmCategory, typeof categoryConfigSchema>,
  ),
);

export const workspaceSettingsNotificationsRouter = router({
  get: workspaceProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx }) => {
      const stored = (ctx.workspace.discordDmSettings || {}) as DiscordDmSettings;
      // Resolve to a fully-populated map so the UI always has explicit values.
      // Missing categories default to enabled with no custom template, which
      // preserves the historical send-the-default behaviour.
      const resolved = {} as Record<DiscordDmCategory, Required<DiscordDmCategoryConfig>>;
      for (const category of DISCORD_DM_CATEGORIES) {
        const config = normalizeConfig(stored[category]);
        resolved[category] = {
          enabled: config.enabled !== false,
          title: config.title ?? '',
          message: config.message ?? '',
        };
      }
      return resolved;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        groupId: z.string(),
        settings: dmSettingsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { department, workspace } = ctx;
      if (!department.permissions.admin) {
        throw ReturnNormalFailure(
          'UNAUTHORIZED',
          'You must be a workspace admin to do this operation',
        );
      }

      // Persist a clean config per category. Empty/whitespace templates are
      // dropped so the built-in default copy is used at dispatch time.
      const settings: DiscordDmSettings = {};
      for (const category of DISCORD_DM_CATEGORIES) {
        const raw = input.settings[category];
        const config: DiscordDmCategoryConfig = { enabled: raw.enabled };
        if (raw.title && raw.title.trim()) config.title = raw.title.trim();
        if (raw.message && raw.message.trim()) config.message = raw.message.trim();
        settings[category] = config;
      }

      await readminCollections.workspace.updateOne(
        { _id: workspace._id },
        { $set: { discordDmSettings: settings } },
      );

      return { ok: true };
    }),
});
