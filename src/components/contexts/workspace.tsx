import { useRouter } from 'next/router';
import { createContext, PropsWithChildren, useContext } from 'react';
import { trpc } from '~/utils/trpc';
import { RouterOutput } from '~/server/routers/_app';

const WorkspaceContext = createContext<RouterOutput["workspaces"]["workspace"]["getWorkspace"]>(
  null as unknown as RouterOutput["workspaces"]["workspace"]["getWorkspace"],
);

// eslint-disable-next-line @typescript-eslint/ban-types
function WorkspaceProvider({ children }: PropsWithChildren<{}>) {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  if (groupId) {
    const { data } = trpc.workspaces.workspace.getWorkspace.useQuery({
      groupId,
    }, {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    });
    return (
      //@ts-expect-error why
      <WorkspaceContext.Provider value={data}>
        {children}
      </WorkspaceContext.Provider>
    );
  } else {
    return (
      //@ts-expect-error it'll buff
      <WorkspaceContext.Provider value={null}>
        {children}
      </WorkspaceContext.Provider>
    );
  }
}

const useWorkspace: () => RouterOutput["workspaces"]["workspace"]["getWorkspace"] = () =>
  useContext(WorkspaceContext);

export { WorkspaceProvider, useWorkspace };
