export declare function buildContentSecurityPolicy(
  isDev: boolean,
  supabaseUrl?: string,
): string;

export declare function buildAppContentSecurityPolicy(
  isDev: boolean,
  nonce: string,
  supabaseUrl?: string,
): string;
