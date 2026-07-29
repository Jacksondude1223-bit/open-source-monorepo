import { z } from 'zod';
import { workspacePremiumProcedure, workspaceProcedure } from '~/server/procedures';
import { readminCollections } from '~/services/mongo.service';
import { router } from '~/server/trpc';
import StringToObjectID from '~/utils/StringToObjectID';
import { ReturnNormalFailure } from '~/utils/NormalResponseTypes';

export const workspaceSettingsRemoteAdminRouter = router({
    // Existing `getCommands` query
    getCommands: workspacePremiumProcedure
        .input(
            z.object({
                groupId: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { workspace } = ctx;

            const commands = await readminCollections.game_command
                .find({
                    groupId: workspace.groupId,
                })
                .toArray();

            const processed = await Promise.all(
                commands.map(async (command) => ({
                    ...command,
                    game: await readminCollections.game.findOne({
                        groupId: workspace.groupId,
                        gameId: command.gameId,
                        placeId: command.placeId,
                    }),
                })),
            );

            return processed;
        }),

    // New `updateCommand` mutation
    updateCommand: workspacePremiumProcedure
        .input(
            z.object({
                commandId: z.string(),
                groupId: z.string(),
                ['permissions.usableByDepartments']: z.array(z.string()).optional(),
                ['permissions.usableByUsers']: z.array(z.string()).optional(),
                ['permissions.usableByGroupRole']: z.array(z.string()).optional(),
                enabled: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { commandId, groupId, ...updateFields } = input;

            const { workspace, department } = ctx;

            // Authorization check
            if (!department.permissions.admin) {
                throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to update commands.');
            }

            const existingCommand = await readminCollections.game_command.findOne({
                _id: StringToObjectID(commandId),
                groupId: workspace.groupId,
            });

            if (!existingCommand) {
                throw ReturnNormalFailure('BAD_REQUEST', 'Command not found.');
            }

            if (updateFields['permissions.usableByDepartments']) {
                const foundDepartments = await readminCollections.department.find({
                    groupId,
                    _id: { $in: updateFields['permissions.usableByDepartments'].map(StringToObjectID) },
                }).toArray();
                //@ts-expect-error fix
                updateFields['permissions.usableByDepartments'] = foundDepartments.map((d) => d._id);
            }

            await readminCollections.game_command.updateOne(
                { _id: existingCommand._id },
                { $set: { ...updateFields } },
            );

            return {
                message: `Command ${existingCommand.name} updated successfully.`,
                updatedFields: updateFields,
            };
        }),

    // New mutation to toggle `enableModerationDashboard`
    toggleEnableModerationDashboard: workspaceProcedure
        .input(
            z.object({
                groupId: z.string(),
                enable: z.boolean(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { groupId, enable } = input;
            const { workspace, department } = ctx;

            // Authorization check
            if (!department.permissions.admin) {
                throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to toggle this feature.');
            }

            // Update workspace setting
            const updateResult = await readminCollections.workspace.updateOne(
                { groupId },
                { $set: { enableModerationDashboard: enable } },
            );

            if (!updateResult.matchedCount) {
                throw ReturnNormalFailure('NOT_FOUND', 'Workspace not found.');
            }

            return {
                message: `Moderation Dashboard ${enable ? 'enabled' : 'disabled'} successfully.`,
                enable,
            };
        }),

    // Update AFK / idle-tracking configuration delivered to the in-game tracker.
    updateAfkReportingSettings: workspaceProcedure
        .input(
            z.object({
                groupId: z.string(),
                altTab: z.object({
                    active: z.boolean(),
                    timeUntilIdle: z.number().int().min(0).max(3600).optional(),
                }),
                movement: z.object({
                    active: z.boolean(),
                    timeUntilIdle: z.number().int().min(0).max(3600).optional(),
                }),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { groupId, altTab, movement } = input;
            const { department } = ctx;

            // Authorization check
            if (!department.permissions.admin) {
                throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to update AFK settings.');
            }

            const afkReportingSettings = { altTab, movement };

            const updateResult = await readminCollections.workspace.updateOne(
                { groupId },
                { $set: { afkReportingSettings } },
            );

            if (!updateResult.matchedCount) {
                throw ReturnNormalFailure('NOT_FOUND', 'Workspace not found.');
            }

            return {
                message: 'AFK settings updated successfully.',
                afkReportingSettings,
            };
        }),

    // Update Application Center configuration delivered to the in-game tracker.
    // Controls whether the embedded Application Center window loads and how it's
    // presented. Mirrors updateAfkReportingSettings.
    updateApplicationCenterSettings: workspaceProcedure
        .input(
            z.object({
                groupId: z.string(),
                enabled: z.boolean(),
                displayMode: z.enum(['windowed', 'fullscreen']).optional(),
                backdrop: z.boolean().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { groupId, enabled, displayMode, backdrop } = input;
            const { department } = ctx;

            // Authorization check
            if (!department.permissions.admin) {
                throw ReturnNormalFailure('UNAUTHORIZED', 'You must be a workspace admin to update Application Center settings.');
            }

            const applicationCenterSettings = {
                enabled,
                displayMode: displayMode ?? 'windowed',
                backdrop: backdrop ?? false,
            };

            const updateResult = await readminCollections.workspace.updateOne(
                { groupId },
                { $set: { applicationCenterSettings } },
            );

            if (!updateResult.matchedCount) {
                throw ReturnNormalFailure('NOT_FOUND', 'Workspace not found.');
            }

            return {
                message: `Application Center ${enabled ? 'enabled' : 'disabled'} successfully.`,
                applicationCenterSettings,
            };
        }),
});
