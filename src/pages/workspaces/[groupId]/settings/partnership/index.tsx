import { ReactElement, useState } from 'react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { CheckBadgeIcon, ChatBubbleLeftRightIcon, LifebuoyIcon, RocketLaunchIcon, SparklesIcon, TagIcon } from '@heroicons/react/24/solid';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import Button from '~/components/forms/Button';
import Toggle from '~/components/forms/Toggle';
import TextLabel from '~/components/forms/TextLabel';
import TextArea from '~/components/forms/TextArea';
import Header from '~/components/NextGenStyles/Header';
import Small from '~/components/NextGenStyles/Small';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

const benefits = [
  {
    icon: CheckBadgeIcon,
    title: 'Public branding',
    description: 'Be featured in our public branding and partner listings.',
  },
  {
    icon: TagIcon,
    title: 'Community discounts',
    description: 'Request community discounts for your members.',
  },
  {
    icon: LifebuoyIcon,
    title: 'Priority support',
    description: 'Get your questions answered faster with priority support.',
  },
  {
    icon: RocketLaunchIcon,
    title: 'Early access',
    description: 'Try new features before they roll out to everyone.',
  },
  {
    icon: SparklesIcon,
    title: 'Roadmap influence',
    description: 'Help shape what we build next with direct input.',
  },
];

const expectations = [
  'Share a short testimonial after using the platform',
  'Allow ReAdmin to list your group as a partner',
  'Provide occasional feedback',
  'Actively use ReAdmin for staff operations',
];

export default function PartnershipSettingsPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const workspace = useWorkspace();
  const context = trpc.useUtils();

  const isAdmin = workspace?.department?.permissions?.admin === true;

  const { data: statusData, isPending } = trpc.workspaces.workspace.settings.partnership.getStatus.useQuery(
    { groupId },
    { enabled: !!groupId && isAdmin },
  );

  const { mutateAsync: submit } = trpc.workspaces.workspace.settings.partnership.submit.useMutation();

  const [willingToProvideFeedback, setWillingToProvideFeedback] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!workspace) return <LoadingPage />;

  if (!isAdmin) {
    return (
      <>
        <PageHeading title="Partnership" disableDivide />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-900 dark:text-gray-100">Admins only</p>
          <Small>You must be a workspace admin to manage partnership applications.</Small>
        </div>
      </>
    );
  }

  if (isPending) return <LoadingPage />;

  const statusLabels: Record<string, string> = {
    pending: 'Pending review',
    reviewing: 'Under review',
    approved: 'Approved',
    declined: 'Not accepted',
  };

  const alreadyOpen =
    statusData?.submitted &&
    (statusData.status === 'pending' || statusData.status === 'reviewing');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.target as any;

    const payload = {
      groupId,
      contact: (form.contact.value as string) || '',
      communityType: (form.communityType.value as string) || '',
      currentStaffManagement: (form.currentStaffManagement.value as string) || '',
      featuresUsed: (form.featuresUsed.value as string) || '',
      reason: (form.reason.value as string) || '',
      willingToProvideFeedback,
    };

    setSubmitting(true);
    const request = submit(payload)
      .then(() => {
        context.workspaces.workspace.settings.partnership.getStatus.invalidate({ groupId });
        form.reset();
      })
      .finally(() => setSubmitting(false));

    toast.promise(request, {
      loading: 'Submitting your partnership application...',
      success: 'Application submitted! We\'ll be in touch.',
      error: (err) => err?.message || 'Failed to submit application.',
    });
  };

  return (
    <>
      <PageHeading
        title="Partnership"
        description="Become an official ReAdmin partner and grow alongside us."
      />

      <div className="flex flex-col gap-6 mt-2">
        <Card>
          <Header>Partner benefits</Header>
          <Small className="mt-1">What you get as a ReAdmin partner.</Small>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title} className="flex flex-row gap-3 items-start">
                  <div className="rounded-lg bg-gray-100 dark:bg-gray-700 p-2 shrink-0">
                    <Icon className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{benefit.title}</p>
                    <Small>{benefit.description}</Small>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <Header>What we ask in return</Header>
          <Small className="mt-1">Partnership is a two-way relationship. We'd ask you to:</Small>
          <ul className="mt-4 flex flex-col gap-2">
            {expectations.map((item) => (
              <li key={item} className="flex flex-row gap-2 items-start text-sm text-gray-700 dark:text-gray-300">
                <ChatBubbleLeftRightIcon className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3">
            <Small>
              Selected partners may be eligible for custom pricing, account credits, or promotional benefits
              based on usage, fit, and partnership activity.
            </Small>
            <Small>
              Partner benefits do not automatically include discounted pricing, but selected partners may receive
              promotional credits when participating in launches, case studies, or referral campaigns.
            </Small>
          </div>
        </Card>

        {statusData?.submitted && !alreadyOpen && (
          <Card>
            <Header>Application status</Header>
            <Small className="mt-1">
              Your most recent application is currently: <span className="font-medium">{statusLabels[statusData.status] || statusData.status}</span>.
            </Small>
          </Card>
        )}

        {alreadyOpen ? (
          <Card>
            <Header>Application received</Header>
            <Small className="mt-1">
              Thanks for applying! Your partnership application is{' '}
              <span className="font-medium">{statusLabels[statusData!.status] || statusData!.status}</span>.
              We'll reach out using the contact details you provided.
            </Small>
          </Card>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <Card>
              <Header>Apply to become a partner</Header>
              <Small className="mt-1">Tell us a bit about your community so we can review your application.</Small>

              <div className="flex flex-col gap-4 mt-4">
                <TextLabel
                  id="contact"
                  label="Discord invite or website"
                  placeholder="https://discord.gg/... or https://yoursite.com"
                  required
                />
                <TextLabel
                  id="communityType"
                  label="What type of community are you?"
                  placeholder="e.g. Roleplay, military, café, development studio"
                  required
                />
                <TextArea
                  id="currentStaffManagement"
                  label="How are you currently managing staff?"
                  placeholder="Tell us about your current tools and processes."
                  rows={3}
                  required
                />
                <TextArea
                  id="featuresUsed"
                  label="Which ReAdmin features do you use or want to use?"
                  placeholder="e.g. Activity tracking, ranking, in-game support, forms"
                  rows={3}
                  required
                />
                <TextArea
                  id="reason"
                  label="Why do you want to become a partner?"
                  placeholder="What are you hoping to get out of the partnership?"
                  rows={3}
                  required
                />
                <Toggle
                  id="willingToProvideFeedback"
                  title="Would you be willing to provide feedback/testimonial if accepted?"
                  value={willingToProvideFeedback}
                  onChange={setWillingToProvideFeedback}
                />
              </div>
            </Card>

            <Button variant="primary" size="medium" className="w-full" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}

PartnershipSettingsPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
