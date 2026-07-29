import { CakeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { RouterOutput } from '~/utils/trpc';

type UpcomingBirthday = RouterOutput['workspaces']['workspace']['getUpcomingBirthdays'][0];

interface UpcomingBirthdaysProps {
  birthdays: UpcomingBirthday[];
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function UpcomingBirthdays({ birthdays }: UpcomingBirthdaysProps) {
  if (!birthdays || birthdays.length === 0) {
    return null;
  }

  const formatBirthdayDate = (month: number, day: number) => {
    return `${monthNames[month - 1]} ${day}`;
  };

  const getDaysUntilText = (daysUntil: number) => {
    if (daysUntil === 0) return 'Today! 🎉';
    if (daysUntil === 1) return 'Tomorrow';
    return `In ${daysUntil} days`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <CakeIcon className="h-5 w-5 text-pink-500 dark:text-pink-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upcoming Birthdays
          </h2>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {birthdays.slice(0, 5).map((birthday) => (
          <div
            key={birthday.userId}
            className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Link
              href={`https://www.roblox.com/users/${birthday.userId}/profile`}
              target="_blank"
              className="flex-shrink-0"
            >
              {birthday.thumbnail ? (
                <img
                  src={birthday.thumbnail}
                  alt={birthday.name || 'User'}
                  className="w-12 h-12 rounded-full border-2 border-pink-200 dark:border-pink-800"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center border-2 border-pink-200 dark:border-pink-800">
                  <CakeIcon className="h-6 w-6 text-white" />
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <Link
                href={`https://www.roblox.com/users/${birthday.userId}/profile`}
                target="_blank"
                className="font-medium text-gray-900 dark:text-white hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
              >
                {birthday.name || 'Unknown User'}
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatBirthdayDate(birthday.month, birthday.day)}
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                birthday.daysUntil === 0
                  ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300'
                  : birthday.daysUntil === 1
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                {getDaysUntilText(birthday.daysUntil)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {birthdays.length > 5 && (
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            + {birthdays.length - 5} more upcoming {birthdays.length - 5 === 1 ? 'birthday' : 'birthdays'}
          </p>
        </div>
      )}
    </div>
  );
}
