import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/client/lib/format";

/** Runs a change, shows its error as a toast, then reloads the page's data. */
export function useRun() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run(
    work: () => Promise<unknown>,
    done?: string,
  ): Promise<boolean> {
    setPending(true);
    try {
      await work();
      await router.invalidate();
      if (done) toast.success(done);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}
