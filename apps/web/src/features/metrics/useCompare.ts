import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const PARAM = 'compare';
const OFF = 'off';

/**
 * Whether a screen compares its numbers with the previous period (D-039). Comparing is the default,
 * so the address says something only when it is switched off (`?compare=off`). It lives in the
 * address like the other choices, so a link shows what its sender saw.
 */
export function useCompare(): { compare: boolean; setCompare: (on: boolean) => void } {
  const [params, setParams] = useSearchParams();
  const compare = params.get(PARAM) !== OFF;

  const setCompare = useCallback(
    (on: boolean) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (on) next.delete(PARAM);
          else next.set(PARAM, OFF);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { compare, setCompare };
}
