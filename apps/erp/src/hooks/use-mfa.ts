"use client";

import { useCallback, useState } from "react";

import { getSupabaseBrowserClient } from "~/lib/supabase-browser";

export interface TotpEnrollment {
  factorId: string;
  qrCodeSvg: string;
  secret: string;
  uri: string;
}

export interface MfaFactor {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}

/**
 * Thin wrapper around `supabase.auth.mfa.*` for TOTP enrollment (F7.2). This
 * talks directly to Supabase Auth from the browser — not through tRPC —
 * because the MFA factor and the aal2-upgraded session live in Supabase Auth
 * itself; tRPC only reads the resulting `aal` claim via `mfaComplianceFor`.
 */
export function useMfa() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listFactors = useCallback(async (): Promise<MfaFactor[]> => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) {
      setError(errorMessage(err));
      return [];
    }
    return data.totp.map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      status: f.status,
    }));
  }, []);

  const enroll = useCallback(async (): Promise<TotpEnrollment | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: err } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Cendaro ERP",
      });
      if (err) {
        setError(errorMessage(err));
        return null;
      }
      return {
        factorId: data.id,
        qrCodeSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      };
    } catch (err: unknown) {
      setError(errorMessage(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verify = useCallback(
    async (factorId: string, code: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: challengeErr, data: challenge } =
          await supabase.auth.mfa.challenge({ factorId });
        if (challengeErr) {
          setError(errorMessage(challengeErr));
          return false;
        }
        const { error: verifyErr } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code,
        });
        if (verifyErr) {
          setError(errorMessage(verifyErr));
          return false;
        }
        return true;
      } catch (err: unknown) {
        setError(errorMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const unenroll = useCallback(async (factorId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: err } = await supabase.auth.mfa.unenroll({ factorId });
      if (err) {
        setError(errorMessage(err));
        return false;
      }
      return true;
    } catch (err: unknown) {
      setError(errorMessage(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, error, listFactors, enroll, verify, unenroll };
}
