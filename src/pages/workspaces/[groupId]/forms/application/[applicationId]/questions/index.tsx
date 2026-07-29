"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from '@heroicons/react/20/solid';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { DocumentPlusIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import { ReactElement, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { v4 } from 'uuid';
import Button from '~/components/forms/Button';
import Dropdown from '~/components/forms/Dropdown';
import TextLabel from '~/components/forms/TextLabel';
import Toggle from '~/components/forms/Toggle';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import WorkspaceFormsApplicationSidebarNavigationLayout from '~/components/page_components/workspaces/forms/WorkspaceFormsApplicationSidebarNavigationLayout';
import EmptyCardCreateState from '~/components/ui/EmptyCardCreateState';
import {
  ApplicationQuestion,
  MultipleChoiceQuestion,
  QuestionTypes,
} from '~/services/NewMongoTypes/Application.type';
import { useWorkspace } from '~/components/contexts/workspace';
import { trpc } from '~/utils/trpc';

type ExtendedApplicatonQuestionForFrontend = ApplicationQuestion;

export default function WorkspacePage() {
  const router = useRouter();
  const { groupId, applicationId }: { groupId: string; applicationId: string } =
    router.query as any;
  const workspace = useWorkspace();
  const saveQuestionsMutation =
    trpc.workspaces.workspace.forms.applications.application.questions.saveQuestions.useMutation();
  const { data: application, isPending: applicationIsLoading } =
    trpc.workspaces.workspace.forms.applications.application.getApplication.useQuery(
      { groupId, applicationId },
    );

  const [questions, setQuestions] = useState<
    ExtendedApplicatonQuestionForFrontend[]
  >([]);
  const [setQuestionss, setSetQuestionss] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const savedSnapshot = useRef<string | null>(null);

  useEffect(() => {
    if (!setQuestionss && application?.questions.length !== 0) {
      setQuestions(application?.questions || []);
      savedSnapshot.current = JSON.stringify(application?.questions || []);
      setSetQuestionss(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, application, groupId, applicationId]);

  // Track whether the user has edited the questions since they were last saved.
  useEffect(() => {
    if (savedSnapshot.current === null) return;
    setHasUnsavedChanges(JSON.stringify(questions) !== savedSnapshot.current);
  }, [questions]);

  // Warn the user before leaving the page with unsaved changes so edits
  // aren't silently lost.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const handleRouteChange = () => {
      if (!hasUnsavedChanges) return;
      if (
        !window.confirm(
          'You have unsaved changes to your questions. Leave without saving?',
        )
      ) {
        router.events.emit('routeChangeError');
        // eslint-disable-next-line no-throw-literal
        throw 'Route change aborted: unsaved question changes.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [hasUnsavedChanges, router.events]);
  // Wait for the workspace to load before evaluating permissions so we don't
  // flash the no-permission card / redirect on reload.
  if (!workspace?.department) {
    return <LoadingPage />;
  }
  if (workspace?.department?.permissions?.applications?.viewApplications == false) {
    if (typeof (window) !== undefined) {
      router.push(`/workspaces/${groupId}/forms`)
    }
    return (<></>)
  }
  if (workspace?.department?.permissions?.applications?.editApplications == false) {
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

  if (applicationIsLoading) {
    return <LoadingPage />;
  }

  function moveQuestionPosition(
    questions: ExtendedApplicatonQuestionForFrontend[],
    currentIndex: number,
    direction: 'up' | 'down',
  ): ExtendedApplicatonQuestionForFrontend[] {
    const newPosition =
      direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newPosition < 0 || newPosition >= questions.length) {
      // Don't move if the new position is out of bounds
      return questions;
    }
    const newQuestions = [...questions];
    const tempPosition = newQuestions[currentIndex]?.position;
    //@ts-expect-error it'll buff
    newQuestions[currentIndex].position = newQuestions[newPosition]?.position;
    //@ts-expect-error it'll buff
    newQuestions[newPosition].position = tempPosition;
    return newQuestions;
  }

  function createQuestion(): void {
    setQuestions([
      ...questions,
      {
        type: 'text_response',
        questionText: 'Type here',
        text_placeholder: '',
        id: v4(),
        position: questions.length,
      },
    ]);
  }

  if (!true) {
    return <LoadingPage />;
  }

  return (
    <>
      <PageHeading
        title={`${application?.name} Questions`}
        disableDivide={true}
      >
        <Button
          variant="primary"
          size="medium"
          icon={PencilSquareIcon}
          onClick={createQuestion}
        >
          Create Question
        </Button>
      </PageHeading>

      <div className="flex flex-col gap-4">
        {questions
          .sort((a, b) => a.position - b.position)
          .map((question, questionIndex) => (
            <div
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-3 rounded-xl shadow-sm"
              key={question.id}
            >
              <div className="flex flex-wrap flex-row w-full gap-2 border-b pb-1 border-blue-100 transition dark:border-blue-900 rounded-lg">
                <TextLabel
                  className="grow font-bold text-lg text-gray-900 underline px-2"
                  defaultValue={question.questionText}
                  onBlur={(f) => {
                    setQuestions(
                      questions.map((q) => {
                        return {
                          ...q,
                          questionText:
                            q.id === question.id
                              ? f
                              : q.questionText,
                        };
                      }),
                    );
                  }}
                />
                <div className="flex flex-row gap-2">
                  <Dropdown
                    className="flex w-full min-w-[170px]"
                    choices={[
                      {
                        name: 'Text Response',
                        id: 'text_response',
                      },
                      {
                        name: 'Multiple Choice',
                        id: 'multiple_choice',
                      },
                      {
                        name: 'Scaled Response',
                        id: 'scaled_response',
                      },
                      {
                        name: 'Typing Speed Test',
                        id: 'typing_speed_test',
                      },
                    ]}
                    defaultValue={question.type}
                    onChange={(value: QuestionTypes) => {
                      setQuestions(
                        questions.map((q) => {
                          if (q.id !== question.id) return q;
                          const properties = {
                            text_response: {
                              text_placeholder: '',
                            },
                            multiple_choice: {
                              choices: [],
                              allow_multiple_selections: false,
                            },
                            scaled_response: {
                              number_placeholder: 5,
                              scale_min: 0,
                              scale_max: 10,
                            },
                            typing_speed_test: {
                              time: 60,
                            },
                          }[value] as ApplicationQuestion;
                          return {
                            ...q,
                            //@ts-expect-error its fine
                            type: value,
                            ...properties,
                          };
                        }),
                      );
                    }}
                  />
                  <Button
                    variant="light_danger"
                    size="small"
                    icon={TrashIcon}
                    onClick={() => {
                      setQuestions(
                        questions.filter((q) => q.id !== question.id),
                      );
                    }}
                  />
                  <Button
                    variant="blue"
                    size="small"
                    icon={ChevronUpIcon}
                    onClick={() => {
                      setQuestions(
                        moveQuestionPosition(questions, questionIndex, 'up'),
                      );
                    }}
                    disabled={
                      question.id == questions[0]?.id || questions.length == 1
                    }
                  />
                  <Button
                    variant="blue"
                    size="small"
                    icon={ChevronDownIcon}
                    onClick={() => {
                      setQuestions(
                        moveQuestionPosition(questions, questionIndex, 'down'),
                      );
                    }}
                    disabled={
                      question.id == questions[questions.length - 1]?.id ||
                      questions.length == 1
                    }
                  />
                </div>
              </div>

              <div className="px-2 mt-2">
                {question.type == 'text_response' && (
                  <TextLabel
                    label="Placeholder"
                    defaultValue={question?.text_placeholder || ''}
                    onBlur={(value: string) => {
                      setQuestions(
                        questions.map((q) => {
                          if (q.id !== question.id) return q;
                          return {
                            ...q,
                            text_placeholder: value,
                          };
                        }),
                      );
                    }}
                    placeholder="The text before the user begins typing"
                  />
                )}
                {question.type == 'scaled_response' && (
                  <>
                    <TextLabel
                      label="Placeholder"
                      type="number"
                      defaultValue={question?.number_placeholder || 5}
                      onBlur={(value: string) => {
                        setQuestions(
                          questions.map((q) => {
                            if (q.id !== question.id) return q;
                            return {
                              ...q,
                              number_placeholder: parseInt(value),
                            };
                          }),
                        );
                      }}
                      placeholder="The default number"
                    />
                    <TextLabel
                      label="Scale Minimum"
                      type="number"
                      defaultValue={question?.scale_min || 0}
                      onBlur={(value: string) => {
                        setQuestions(
                          questions.map((q) => {
                            if (q.id !== question.id) return q;
                            return {
                              ...q,
                              scale_min: parseInt(value),
                            };
                          }),
                        );
                      }}
                      placeholder="The lowest number the user can choose"
                    />
                    <TextLabel
                      label="Scale Maximum"
                      defaultValue={question?.scale_max || 10}
                      type="number"
                      onBlur={(value: string) => {
                        setQuestions(
                          questions.map((q) => {
                            if (q.id !== question.id) return q;
                            return {
                              ...q,
                              scale_max: parseInt(value),
                            };
                          }),
                        );
                      }}
                      placeholder="The maximum number the user can choose"
                    />
                  </>
                )}
                {question.type == 'multiple_choice' && (
                  <div className="w-full">
                    <Toggle
                      title={'Allow multiple selections'}
                      description={
                        'Allow the user to select more than one choice'
                      }
                      value={question.allow_multiple_selections}
                      onChange={(value) => {
                        setQuestions(
                          questions.map((q) => {
                            const qu = q as MultipleChoiceQuestion;
                            if (q.id == question.id) {
                              qu.allow_multiple_selections = value;
                            }
                            return qu;
                          }),
                        );
                      }}
                    />
                    <div className="flex flex-col gap-1">
                      {question.choices.map((choice, choiceIndex) => (
                        <div
                          key={`${question.id}-${choiceIndex}`}
                          className="ml-8 flex flex-row gap-1"
                        >
                          <TextLabel
                            className="flex grow"
                            defaultValue={choice}
                            onBlur={(value: string) => {
                              setQuestions(
                                questions.map((q) => {
                                  if (q.id !== question.id) return q;
                                  const qu = q as MultipleChoiceQuestion;
                                  return {
                                    ...q,
                                    choices: qu.choices.map((c, i) =>
                                      i === choiceIndex ? value : c,
                                    ),
                                  };
                                }),
                              );
                            }}
                          />
                          <Button
                            variant="light_danger"
                            icon={TrashIcon}
                            size="small"
                            onClick={() => {
                              setQuestions(
                                questions.map((q) => {
                                  if (q.id !== question.id) return q;
                                  const qu = q as MultipleChoiceQuestion;
                                  return {
                                    ...q,
                                    choices: qu.choices.filter(
                                      (c, i) => i !== choiceIndex,
                                    ),
                                  };
                                }),
                              );
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <form
                      className="mt-2 flex-wrap flex w-full flex-row gap-1"
                      onSubmit={(f) => {
                        f.preventDefault();
                        const t = f.target as any;
                        const val = t.choice.value;
                        t.choice.value = '';
                        setQuestions(
                          questions.map((q) => {
                            if (q.id !== question.id) return q;
                            const qu = q as MultipleChoiceQuestion;
                            return {
                              ...qu,
                              choices: [...qu.choices, val],
                            };
                          }),
                        );
                      }}
                    >
                      <TextLabel
                        placeholder="New choice text"
                        className="grow"
                        id="choice"
                      />
                      <Button variant="primary" type="submit" size="small">
                        Create Choice
                      </Button>
                    </form>
                  </div>
                )}
                {question.type == 'typing_speed_test' && (
                  <>
                    <TextLabel
                      label="Time"
                      type="number"
                      defaultValue={question?.time || 60}
                      onBlur={(value: string) => {
                        setQuestions(
                          questions.map((q) => {
                            if (q.id !== question.id) return q;
                            return {
                              ...q,
                              time: parseInt(value),
                            };
                          }),
                        );
                      }}
                      placeholder="The time in seconds"
                    />
                  </>
                )}
              </div>
            </div>
          ))}


        <EmptyCardCreateState
          className="w-full my-2 py-4"
          icon={DocumentPlusIcon}
          buttonText="Create a Question"
          cbFunction={createQuestion}
        />

        <Button variant={"blue"} className="w-full" size="medium" onClick={() => {

          saveQuestionsMutation.mutateAsync({
            groupId,
            applicationId,
            questions,
          }).then(() => {
            savedSnapshot.current = JSON.stringify(questions);
            setHasUnsavedChanges(false);
            toast.success('Successfully saved questions')
          }).catch((e) => {
            toast.error(e?.message || 'Failed to save questions')
          })
        }}>{hasUnsavedChanges ? 'Save Questions (unsaved changes)' : 'Save Questions'}</Button>
      </div>
    </>
  );
}

WorkspacePage.getLayout = (page: ReactElement) => (
  <WorkspaceFormsApplicationSidebarNavigationLayout>{page}</WorkspaceFormsApplicationSidebarNavigationLayout>
);
