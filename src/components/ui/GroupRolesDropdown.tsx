/* eslint-disable @typescript-eslint/no-unused-vars */
import { PropsWithChildren, useEffect, useState } from 'react';
import Dropdown from '~/components/forms/Dropdown';
import { trpc } from '~/utils/trpc';
import { useWorkspace } from '../contexts/workspace';

export default function GroupRolesDropdown({
  groupId,
  label,
  id = 'groupRoles',
  defaultValue,
  userRankableOnly,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onChange = () => { },
  maxRank = 255,
}: PropsWithChildren<{
  defaultValue?: string;
  groupId: string;
  label?: string;
  id?: string;
  onChange?: (value: string) => void;


  rankableOnly?: boolean; // only roles the bot cank rank to
  userRankableOnly?: boolean;
  maxRank?: number;
}>) {
  const { data: roles, isPending } = trpc.roblox.getRobloxGroupRoles.useQuery({ groupId });
  const workspace = useWorkspace();

  if (isPending) {
    return (
      <div className='border border-gray-100 w-full px-2 py-1 pulse'>
        <p className='font-bold text-gray-500'>Please wait, loading...</p>
      </div>
    )
  }
  if (!roles) {
    return (
      <p>Roles were not found</p>
    )
  }

  return (
    <Dropdown
      defaultValue={defaultValue}
      label={label}
      onChange={onChange}
      id={id}
      //sort roles by rank so lowest is first, and filter out roles higher than maxRank
      choices={(userRankableOnly ? workspace.rankableRoles : roles)
        .filter((a) => a.rank <= maxRank)
        .sort((a, b) => a.rank - b.rank)
        .map((a) => {
          return { name: a.name, id: a.rank.toString() };
        })}
    />
  );
}
