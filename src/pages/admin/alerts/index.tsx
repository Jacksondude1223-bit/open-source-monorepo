/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import { ReactElement, useState } from 'react';
import PageHeading from '~/components/layouts/PageHeading';
import { AdminLayout } from '~/components/page_components/AdminLayout';
import { useUser } from '~/components/contexts/user';
import { trpc } from '~/utils/trpc';
import { Alert } from '~/components/page_components/alerts';
import Button from '~/components/forms/Button';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  TrashIcon,
  XMarkIcon,
  PlusIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon
} from '@heroicons/react/20/solid';
import Toggle from '~/components/forms/Toggle';
import TextLabel from '~/components/forms/TextLabel';
import Dropdown from '~/components/forms/Dropdown';
import LoadingPage from '~/components/layouts/LoadingPage';
import { SiteAlert } from '~/services/NewMongoTypes';
import toast from 'react-hot-toast';
import { NoSsr } from '~/components/NoSSR';

export default function DashboardPage() {
  const user = useUser();
  const router = useRouter();

  const utils = trpc.useUtils();

  const { data: alerts } = trpc.admin.alerts.getAlerts.useQuery();
  const deleteMutation = trpc.admin.alerts.deleteAlert.useMutation();
  const createAlertMutation = trpc.admin.alerts.createAlert.useMutation();
  const updateAlert = trpc.admin.alerts.updateAlert.useMutation();
  const [notif, setNotif] = useState<SiteAlert & { updating?: boolean }>({
    id: '398r328h8925823',
    type: 'primary',
    title: 'Testing title',
    message: 'Message here',
    link: 'https://google.com',
    linkMessage: 'This is a test link',
    closable: false,
    public: false,
    groupIds: [],
    userIds: [],
    created: new Date(),
  });

  const [showPreview, setShowPreview] = useState(true);

  function resetNotif() {
    setNotif({
      id: '398r328h8925823',
      type: 'primary',
      title: 'Testing title',
      message: 'Message here',
      link: 'https://google.com',
      linkMessage: 'This is a test link',
      closable: false,
      public: false,
      groupIds: [],
      userIds: [],
      created: new Date(),
    });
  }

  if (!alerts || !user) {
    return <LoadingPage />
  } return (
    <div className="min-h-screen">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Site Alerts Management</h1>
                <p className="text-gray-600 dark:text-slate-300 mt-1">Create and manage site-wide notifications and alerts</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-slate-400">
                <ClockIcon className="w-4 h-4" />
                <span>{alerts?.length || 0} active alerts</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">          {/* Existing Alerts Section */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <InformationCircleIcon className="w-5 h-5 mr-2" />
                  Active Alerts
                </h2>
              </div>

              <div className="p-6">
                {alerts && alerts.length > 0 ? (
                  <div className="space-y-4">
                    {alerts.map(alert => (
                      <div key={alert.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-slate-600 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <Alert
                              key={alert.id}
                              notif={alert}
                              forceVisible={true}
                              extraText={`ADMIN: id: ${alert.id} - ${alert.closable ? 'closable' : 'not closable'} - ${alert.public ? 'public' : 'private'} - groups: ${alert?.groupIds?.join(', ') || 'none'} - users: ${alert?.userIds?.join(', ') || 'none'}`}
                            />
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              icon={ArrowPathIcon}
                              variant="primary"
                              size="small"
                              onClick={() => setNotif({ ...alert, updating: true })}
                              className="!p-2"
                            />
                            <Button
                              icon={TrashIcon}
                              variant="danger"
                              size="small"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this alert?')) {
                                  deleteMutation.mutateAsync({ id: alert._id.toString() }).then(() => {
                                    utils.admin.alerts.getAlerts.invalidate();
                                    toast.success('Alert deleted successfully');
                                  }).catch(() => {
                                    toast.error('Failed to delete alert');
                                  });
                                }
                              }}
                              className="!p-2"
                            />
                          </div>
                        </div>

                        {/* Alert Metadata */}
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className={`px-2 py-1 rounded-full font-medium ${alert.type === 'primary' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              alert.type === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}>
                              {alert.type}
                            </span>
                            <span className={`px-2 py-1 rounded-full font-medium ${alert.public ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                              {alert.public ? 'Public' : 'Private'}
                            </span>
                            {alert.closable && (
                              <span className="px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 font-medium">
                                Closable
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <InformationCircleIcon className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No alerts found</h3>
                    <p className="text-gray-500 dark:text-slate-400">Create your first alert using the form on the right.</p>
                  </div>
                )}
              </div>
            </div>
          </div>          {/* Alert Creator Section */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 px-6 py-4">
                <h2 className="text-lg font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    {notif.updating ? 'Update Alert' : 'Create New Alert'}
                  </span>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-white hover:text-green-100 transition-colors"
                  >
                    {showPreview ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </h2>
              </div>

              <div className="p-6">
                {/* Alert Preview */}
                {showPreview && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Preview</h3>
                    <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 bg-gray-50 dark:bg-slate-700">
                      <div
                        className={`rounded-md p-4 ${notif.type == 'primary'
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : notif.type == 'warning'
                            ? 'bg-yellow-50 dark:bg-yellow-900/20'
                            : 'bg-red-50 dark:bg-red-900/20'
                          }`}
                      >
                        <div className="flex flex-row w-full">
                          <div className="flex flex-col w-full">
                            <div className="ml-3 flex flex-row">
                              <div className="shrink-0">
                                {notif.type == 'primary' ? (
                                  <InformationCircleIcon
                                    className={`h-5 w-5 ${notif.type == 'primary'
                                      ? 'text-blue-400 dark:text-blue-300'
                                      : notif.type == 'warning'
                                        ? 'text-yellow-400 dark:text-yellow-300'
                                        : 'text-red-400 dark:text-red-300'
                                      }`}
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ExclamationTriangleIcon
                                    className={`h-5 w-5 ${notif.type == 'warning' ? 'text-yellow-400 dark:text-yellow-300' : 'text-red-400 dark:text-red-300'
                                      }`}
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              <span className="flex flex-row gap-2 ml-2">
                                {notif.title && (
                                  <p
                                    className={`text-sm font-medium ${notif.type == 'primary'
                                      ? 'text-blue-700 dark:text-blue-200'
                                      : notif.type == 'warning'
                                        ? 'text-yellow-700 dark:text-yellow-200'
                                        : 'text-red-700 dark:text-red-200'
                                      }`}
                                  >
                                    {notif.title}
                                  </p>
                                )}
                              </span>
                            </div>
                            <div className="flex flex-col justify-between mt-2 w-full">
                              <div className="mt-3 text-sm md:ml-6 md:mt-0 flex flex-row justify-between gap-2 flex-wrap">
                                <div>
                                  <p
                                    className={`text-sm ${notif.type == 'primary'
                                      ? 'text-blue-700 dark:text-blue-200'
                                      : notif.type == 'warning'
                                        ? 'text-yellow-700 dark:text-yellow-200'
                                        : 'text-red-700 dark:text-red-200'
                                      }`}
                                  >
                                    {notif.message}
                                  </p>
                                </div>
                                {notif.link && (
                                  <p
                                    className={`font-medium whitespace-nowrap self-center align-middle cursor-pointer ${notif.type == 'primary'
                                      ? 'text-blue-700 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-200'
                                      : notif.type == 'warning'
                                        ? 'text-yellow-700 hover:text-yellow-600 dark:text-yellow-300 dark:hover:text-yellow-200'
                                        : 'text-red-700 hover:text-red-600 dark:text-red-300 dark:hover:text-red-200'
                                      }`}
                                  >
                                    {notif.linkMessage}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          {notif.closable && (
                            <button
                              type="button"
                              className={`ml-2 h-min inline-flex rounded-md bg-white dark:bg-slate-800 text-gray-400 hover:text-gray-500 dark:text-slate-400 dark:hover:text-slate-300 focus:outline-none focus:ring-2 ${notif.type == 'primary'
                                ? 'focus:ring-blue-500'
                                : notif.type == 'warning'
                                  ? 'focus:ring-yellow-500'
                                  : 'focus:ring-red-500'
                                } focus:ring-offset-2 dark:focus:ring-offset-slate-800`}
                            >
                              <span className="sr-only">Close</span>
                              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <NoSsr>
                  <form className="space-y-6" onSubmit={(f) => {
                    f.preventDefault();

                    if (notif.updating) {
                      updateAlert.mutateAsync({ id: notif?._id?.toString() || '', notif }).then(() => {
                        utils.admin.alerts.getAlerts.invalidate();
                        toast.success('Alert updated successfully');
                        resetNotif();
                      }).catch(() => {
                        toast.error('Failed to update alert');
                      });
                      return;
                    }
                    createAlertMutation.mutateAsync({ notif }).then(() => {
                      utils.admin.alerts.getAlerts.invalidate();
                      toast.success('Alert created successfully');
                      resetNotif();
                    }).catch(() => {
                      toast.error('Error creating alert');
                    })
                  }}>
                    {/* Basic Information */}
                    <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">Basic Information</h4>
                      <div className="space-y-4">
                        <Dropdown
                          label="Alert Type"
                          defaultValue={notif.type}
                          choices={[
                            { id: 'primary', name: '🔵 Primary (Info)' },
                            { id: 'warning', name: '🟡 Warning' },
                            { id: 'danger', name: '🔴 Danger' },
                          ]}
                          onChange={v => { setNotif({ ...notif, type: v }) }}
                        />
                        <TextLabel
                          defaultValue={notif.id}
                          key={notif.id}
                          label="Unique ID"
                          placeholder="Enter a unique, descriptive ID"
                          onBlur={(id) => setNotif({ ...notif, id })}
                        />
                        <TextLabel
                          defaultValue={notif.title}
                          key={notif.title}
                          label="Alert Title"
                          placeholder="Enter alert title"
                          onBlur={(title) => setNotif({ ...notif, title })}
                        />
                        <TextLabel
                          defaultValue={notif.message}
                          key={notif.message}
                          label="Alert Message"
                          placeholder="Enter the main alert message"
                          onBlur={(message) => setNotif({ ...notif, message })}
                        />
                      </div>
                    </div>

                    {/* Link Configuration */}
                    <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">Link Configuration</h4>
                      <div className="space-y-4">
                        <TextLabel
                          defaultValue={notif.linkMessage}
                          key={notif.linkMessage}
                          label="Link Text"
                          placeholder="Text to display for the link"
                          onBlur={(linkMessage) => setNotif({ ...notif, linkMessage })}
                        />
                        <TextLabel
                          defaultValue={notif.link}
                          key={notif.link}
                          label="URL"
                          placeholder="https://example.com (leave blank for no link)"
                          onBlur={(link) => setNotif({ ...notif, link })}
                        />
                      </div>
                    </div>

                    {/* Display Options */}
                    <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">Display Options</h4>
                      <div className="space-y-4">
                        <Toggle
                          title="User can close this alert"
                          value={notif.closable}
                          onChange={(closable) => setNotif({ ...notif, closable })}
                        />
                        <Toggle
                          title="Visible to public (non-logged in users)"
                          value={notif.public}
                          onChange={(isPublic) => setNotif({ ...notif, ["public"]: isPublic })}
                        />
                      </div>
                    </div>

                    {/* Targeting */}
                    <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-4">Targeting (Optional)</h4>
                      <div className="space-y-4">
                        <TextLabel
                          defaultValue={notif?.groupIds?.join(',') || ''}
                          required={false}
                          label="Group IDs (comma-separated)"
                          placeholder="group1,group2,group3"
                          onBlur={(groupIds) => {
                            setNotif({ ...notif, groupIds: groupIds.split(" ").join('').split(",").filter(id => id.length > 0) })
                          }}
                        />
                        <TextLabel
                          defaultValue={notif?.userIds?.join(',') || ''}
                          required={false}
                          label="User IDs (comma-separated)"
                          placeholder="user1,user2,user3"
                          onBlur={(userIds) => {
                            setNotif({ ...notif, userIds: userIds.split(" ").join('').split(",").filter(id => id.length > 0) })
                          }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-slate-600">
                      <Button
                        variant="blue"
                        type="button"
                        onClick={resetNotif}
                      >
                        Reset Form
                      </Button>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={(createAlertMutation as any)?.isLoading || (updateAlert as any)?.isLoading}
                      >
                        {notif.updating ? 'Update Alert' : 'Create Alert'}
                      </Button>
                    </div>
                  </form>
                </NoSsr>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <AdminLayout>{page}</AdminLayout>
);
