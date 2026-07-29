import { Context, createContext, PropsWithChildren, useContext } from 'react';
import { trpc } from '~/utils/trpc';
import { JWTUser } from '~/services/types/JWT.type';

export type AuthenticatedUserContext = { loggedIn: true; user: JWTUser };

const UserContext: Context<
  | {
    loading: true;
  }
  | {
    loggedIn: false;
    user: null;
  }
  | AuthenticatedUserContext
> = createContext({ loading: true }) as any;

// eslint-disable-next-line @typescript-eslint/ban-types
function UserProvider({ children }: PropsWithChildren<{}>) {
  const { data, isPending } = trpc.user.info.useQuery(undefined,{refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false});

  if (!data || isPending) {
    return (
      <UserContext.Provider value={{ loading: true }}>
        {children}
      </UserContext.Provider>
    );
  }

  return (
    //@ts-expect-error lol
    <UserContext.Provider value={data}>{children}</UserContext.Provider>
  );
}

const useUser = () => useContext(UserContext);

export { UserProvider, useUser };
