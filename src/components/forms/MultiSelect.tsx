import { JSX, PropsWithChildren, useEffect } from 'react';

export type DropdownChoiceType = {
  name: string;
  id: string;
}[];

// eslint-disable-next-line @typescript-eslint/ban-types
function DivWrapper({ children }: PropsWithChildren<{}>) {
  return <div className="w-full">{children}</div>;
}
// eslint-disable-next-line @typescript-eslint/ban-types
function NoWrapper({ children }: PropsWithChildren<{}>) {
  return <>{children}</>;
}
import { useState } from 'react';
export default function MultiSelect({
  label = '',
  choices = [],
  id = '',
  className = '',
  defaultValue = [],
}: {
  label?: string;
  choices: DropdownChoiceType;
  id?: string;
  required?: boolean;
  defaultValue?: string[];
  className?: string;
  onChange?: (e: any) => void;
}): JSX.Element {
  const [selectedChoices, setSelectedChoices] =
    useState<string[]>(defaultValue);
  const [generatedChoices, setGeneratedChoices] = useState<DropdownChoiceType>(
    [],
  );

  useEffect(() => {
    const updatedChoices = choices.map((choice) => ({
      ...choice,
      id: `choice_${Math.random().toString(36).substring(7)}`,
    }));
    setGeneratedChoices(updatedChoices);
  }, [choices]);

  const Wrapper = label ? DivWrapper : NoWrapper;

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name: choiceName, checked } = event.target;
    if (checked) {
      setSelectedChoices((prevSelectedChoices) => [
        ...prevSelectedChoices,
        choiceName,
      ]);
    } else {
      setSelectedChoices((prevSelectedChoices) =>
        prevSelectedChoices.filter((name) => name !== choiceName),
      );
    }
  };

  const selectedChoicesJson = JSON.stringify(selectedChoices);

  return (
    <Wrapper>
      {label && (
        <label
          htmlFor={id}
          className={`${className} block text-sm font-medium text-gray-700 dark:text-gray-300`}
        >
          {label}
        </label>
      )}
      <fieldset>
        <div className="space-y-2 mt-2">
          {generatedChoices.map((choice) => (
            <div className="relative flex items-start" key={choice.id}>
              <div className="flex h-6 items-center">
                <input
                  id={choice.id}
                  name={choice.name}
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                  checked={selectedChoices.includes(choice.name)}
                  onChange={handleCheckboxChange}
                />
              </div>
              <div className="ml-3 text-sm leading-6">
                <label
                  htmlFor={choice.id}
                  className="font-medium text-gray-900 dark:text-gray-100"
                >
                  {choice.name}
                </label>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <input type="hidden" id={id} name={id} value={selectedChoicesJson} />
    </Wrapper>
  );
}
