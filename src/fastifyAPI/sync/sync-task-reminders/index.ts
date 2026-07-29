import { dmUserDiscord, sendGuildTextMessage } from '~/services/discord.service';
import { readminCollections } from '~/services/mongo.service';
import { Task, TaskReminder } from '~/services/NewMongoTypes/Task.type';

/**
 * Sends any task reminders whose `remindAt` has passed and marks them as sent.
 * - `dm` reminders DM every assigned user (and the creator if there are none).
 * - `channel` reminders post an embed to the configured Discord channel.
 */
export const syncTaskReminders = async () => {
  const now = new Date();

  const tasks = (await readminCollections.task
    .find({
      archived: { $ne: true },
      reminders: {
        $elemMatch: { sent: false, remindAt: { $lte: now } },
      },
    })
    .toArray()) as Task[];

  for (const task of tasks) {
    const dueReminders = (task.reminders || []).filter(
      (r) => !r.sent && new Date(r.remindAt) <= now,
    );
    if (dueReminders.length === 0) continue;

    const panelLink = `https://panel.readmin.app/workspaces/${task.groupId}/tasks`;
    const dueText = task.dueBy
      ? `\nDue ${new Date(task.dueBy).toLocaleString()}`
      : '';

    for (const reminder of dueReminders) {
      const description =
        (reminder.message ? `${reminder.message}\n\n` : '') +
        `${task.description || 'No description provided.'}${dueText}\n\n${panelLink}`;

      try {
        if (reminder.method === 'channel' && reminder.channelId) {
          await sendGuildTextMessage(reminder.channelId, {
            embeds: [
              {
                title: `Task reminder: ${task.title}`,
                description,
                color: 0x3b82f6,
              },
            ],
          });
        } else {
          const recipients =
            task.assignedUsers && task.assignedUsers.length > 0
              ? task.assignedUsers
              : task.createdBy
                ? [task.createdBy]
                : [];
          await Promise.all(
            recipients
              .filter((id) => !!id)
              .map((robloxId) =>
                dmUserDiscord(
                  robloxId,
                  `Task reminder: ${task.title}`,
                  description,
                  'blue',
                  undefined,
                  { groupId: task.groupId, category: 'taskReminders', variables: { taskTitle: task.title, taskDescription: task.description || '', dueDate: task.dueBy ? new Date(task.dueBy).toLocaleString() : '' } },
                ),
              ),
          );
        }
      } catch (err) {
        console.error(
          `Failed to send task reminder ${reminder.id} for task ${task._id?.toString()}:`,
          err,
        );
        // Leave it unsent so it retries on the next cron tick.
        continue;
      }

      await readminCollections.task.updateOne(
        { _id: task._id, 'reminders.id': reminder.id },
        {
          $set: {
            'reminders.$.sent': true,
            'reminders.$.sentAt': new Date(),
          },
        },
      );
    }
  }
};

export type { TaskReminder };
