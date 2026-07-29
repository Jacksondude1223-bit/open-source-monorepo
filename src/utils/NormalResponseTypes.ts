import { TRPCError } from '@trpc/server';
import { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc';

export function ReturnNormalFailure(
  code: TRPC_ERROR_CODE_KEY,
  message: string,
): TRPCError {
  return new TRPCError({
    code,
    message,
  });
}
