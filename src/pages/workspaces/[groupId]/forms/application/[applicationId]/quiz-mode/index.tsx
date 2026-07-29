'use client';

import { useRouter } from 'next/router';
import { ReactElement } from 'react';
import toast from 'react-hot-toast';
import Button from '~/components/forms/Button';
import MultiSelect from '~/components/forms/MultiSelect';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceFormsApplicationSidebarNavigationLayout from '~/components/page_components/workspaces/forms/WorkspaceFormsApplicationSidebarNavigationLayout';
import SectionHeader from '~/components/ui/SectionHeader';
import Card from '~/components/ui/Card';
import { AutoGradingQuestion } from '~/services/NewMongoTypes/Application.type';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

export default function WorkspacePage() {
  const router = useRouter();
  const workspace = useWorkspace();
  const { groupId, applicationId }: { groupId: string; applicationId: string } =
    router.query as any;
  const { data: application, isPending: applicationIsLoading } =
    trpc.workspaces.workspace.forms.applications.application.getApplication.useQuery(
      { groupId, applicationId },
    );
  const updateSettingsMutation =
    trpc.workspaces.workspace.forms.applications.application.quizMode.saveSettings.useMutation();
  const updateQuestionsMutation =
    trpc.workspaces.workspace.forms.applications.application.quizMode.saveQuestions.useMutation();

  if (applicationIsLoading) {
    return <LoadingPage />;
  }
  // Wait for the workspace to load before evaluating permissions so we don't
  // flash the no-permission card / redirect on reload.
  if (!workspace?.department) {
    return <LoadingPage />;
  }
  if (!workspace?.department?.permissions?.applications?.editApplications) {
    return (
      <>

        <PageHeading
          title={`${workspace?.groupName} Forms`}
          disableDivide={true}
        />
        <div className="py-12 text-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-lg font-bold">You don&apos;t have permission to edit forms</p>
          <p className="text-gray-500 dark:text-gray-400 mt-1">If you believe this is a mistake, contact one of your group admins.</p>
        </div>
      </>
    )
  }

  if (workspace.department.permissions.applications.viewApplications == false) {
    if (typeof (window) !== undefined) {
      router.push(`/workspaces/${groupId}/forms`)
    }
    return (<></>)
  }
  const autoGradingSettings = application?.autoGrading?.questions;

  return (
    <>
      <PageHeading
        title={`${application?.name} Quiz Mode`}
        description="Automatically grade responses and assign a pass/fail score."
        disableDivide={true}
      />

      <SectionHeader title="Quiz Mode Settings" desc="Turn on auto-grading and set the score needed to pass." />
      <Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const enabled = target.enableQuizMode.checked;
          const minscore = target.minimumScore.value;
          updateSettingsMutation
            .mutateAsync({
              groupId,
              applicationId,
              settings: {
                mingrade: parseInt(minscore),
                enabled: enabled,
              },
            })
            .then(() => {
              toast.success('Successfully saved changes');
            })
            .catch((e) => {
              toast.error(e.message);
            });
        }}
      >
        <Toggle
          title={'Enable quiz mode'}
          description={
            'Ensure you configure your correct answers before doing this!'
          }
          id="enableQuizMode"
          value={application?.autoGrading.enabled}
        />
        <TextLabel
          type="number"
          id="minimumScore"
          label="Minimum passing score"
          min="0"
          max="100"
          required={true}
          placeholder="Type a number 0-100 here."
          defaultValue={application?.autoGrading.mingrade}
        />
        <Button variant="primary" className="w-full" type="submit">
          Save Settings
        </Button>
      </form>
      </Card>
      <SectionHeader title="Correct Answers" desc="Define the correct answer for each question so responses can be graded." enableMt={true} />
      <form
        className="flex flex-col gap-2"
        onSubmit={async (f) => {
          f.preventDefault();
          const target = f.target as any;
          const answers: {
            [key: string]: AutoGradingQuestion;
          } = {};
          if (!application) {
            return;
          }
          for (const question of application.questions) {
            const id = question.id;
            const response =
              question.type == 'multiple_choice'
                ? JSON.parse(target[id]?.value)
                : question.type == 'scaled_response'
                  ? {
                    min: parseInt(target[`${id}-min`]?.value),
                    max: parseInt(target[`${id}-max`]?.value),
                  }
                  : target[id]?.value;
            answers[id] = response;
          }
          updateQuestionsMutation
            .mutateAsync({
              groupId,
              applicationId,
              settings: answers,
            })
            .then(() => {
              toast.success('Successfully saved changes');
            })
            .catch((e) => {
              toast.error(e.message);
            });
        }}
      >
        {application?.questions
          .sort((a, b) => a.position - b.position)
          .map((question) => {
            if (question.type == 'text_response') {
              return (
                <div
                  key={question.id}
                  className="px-6 py-4 border border-gray-200 transition dark:border-gray-700 transition dark:bg-gray-800 rounded-lg"
                >
                  <p className="font-bold">{question.questionText}</p>
                  <TextLabel
                    id={question.id}
                    label="Type correct answers here (comma separated)"
                    placeholder="Type here"
                    required={false}
                    //@ts-expect-error gay
                    defaultValue={
                      autoGradingSettings !== undefined
                        ? autoGradingSettings[question.id]
                        : ('' as string)
                    }
                  />
                </div>
              );
            }
            if (question.type == 'multiple_choice') {
              if (question.allow_multiple_selections) {
                // Alow multiple to be selected
                return (
                  <div
                    key={question.id}
                    className="px-6 py-4 border border-gray-200 transition dark:border-gray-700 transition dark:bg-gray-800 rounded-lg"
                  >
                    <p className="font-bold">{question.questionText}</p>
                    <MultiSelect
                      key={question.id}
                      id={question.id}
                      required={false}
                      label={question.questionText}
                      //@ts-expect-error gay
                      defaultValue={
                        autoGradingSettings !== undefined
                          ? autoGradingSettings[question.id]
                          : ([] as string[])
                      }
                      choices={question.choices.map((choice: string) => {
                        return { id: choice, name: choice };
                      })}
                    />
                    <small>
                      If the user does not select{' '}
                      <span className="font-bold">ALL</span> correct answers the
                      response will be counted wrong. If they select one
                      which isn&apos;t valid -- it will also be counted wrong.
                    </small>
                  </div>
                );
              } else {
                // Applicant selects one answer, but any of the configured
                // choices below can be marked as an accepted correct answer.
                const stored =
                  autoGradingSettings !== undefined
                    ? autoGradingSettings[question.id]
                    : undefined;
                const defaultCorrectAnswers = Array.isArray(stored)
                  ? (stored as string[])
                  : stored
                    ? [stored as string]
                    : [];
                return (
                  <div
                    key={question.id}
                    className="px-6 py-4 border border-gray-200 transition dark:border-gray-700 transition dark:bg-gray-800 rounded-lg"
                  >
                    <p className="font-bold">{question.questionText}</p>
                    <MultiSelect
                      key={question.id}
                      id={question.id}
                      required={false}
                      label={question.questionText}
                      defaultValue={defaultCorrectAnswers}
                      choices={question.choices.map((choice: string) => {
                        return { id: choice, name: choice };
                      })}
                    />
                    <small>
                      The applicant only picks one answer. Select every choice
                      that should be accepted as correct &mdash; their answer is
                      counted correct if it matches any one of them.
                    </small>
                  </div>
                );
              }
            }
            if (question.type == 'scaled_response') {
              return (
                <div
                  key={question.id}
                  className="px-6 py-4 border border-gray-200 transition dark:border-gray-700 transition dark:bg-gray-800 rounded-lg"
                >
                  <p className="font-bold">{question.questionText}</p>
                  <TextLabel
                    id={`${question.id}-min`}
                    label="What is the minimum correct answer"
                    placeholder="Type a number"
                    min="0"
                    required={false}
                    defaultValue={
                      //@ts-expect-error dont be gay
                      autoGradingSettings !== undefined ? autoGradingSettings[question.id]?.min : 0 as number
                    }
                    max="10"
                  />
                  <TextLabel
                    id={`${question.id}-max`}
                    label="What is the maximum correct answer"
                    placeholder="Type a number"
                    min="0"
                    defaultValue={
                      //@ts-expect-error dont be gay
                      autoGradingSettings !== undefined ? autoGradingSettings[question.id]?.max : 0 as number
                    }
                    required={false}
                    max="10"
                  />
                </div>
              );
            }
            if (question.type == 'typing_speed_test') {
              return (
                <div
                  key={question.id}
                  className="px-6 py-4 border border-gray-200 transition dark:border-gray-700 transition dark:bg-gray-800 rounded-lg"
                >
                  <p className="font-bold">{question.questionText}</p>
                  <TextLabel
                    id={question.id}
                    label="Type the minimum score they must get"
                    placeholder="Type a number 0-500"
                    min="0"
                    required={false}
                    //@ts-expect-error gay
                    defaultValue={
                      autoGradingSettings !== undefined
                        ? autoGradingSettings[question.id]
                        : ('' as string)
                    }
                    max="500"
                  />
                </div>
              );
            }
            return <></>;
          })}
        <Button variant="primary" className="w-full" type="submit">
          Save Correct Answers
        </Button>
      </form>
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceFormsApplicationSidebarNavigationLayout>{page}</WorkspaceFormsApplicationSidebarNavigationLayout>
);
