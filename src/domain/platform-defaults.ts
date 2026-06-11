export const DEFAULT_PLATFORM_ACCOUNT_ID = "betway-main";
export const DEFAULT_PLATFORM_ACCOUNT_NAME = "Betway 主账户";
export const DEFAULT_PLATFORM_PROVIDER = "betway";
export const DEFAULT_PLATFORM_ACCOUNT_LABEL = "betway-main";

type PlatformAccountLike = {
  id: string;
  provider: string;
  isActive?: boolean | null;
};

export function getDefaultPlatformAccountId(accounts: PlatformAccountLike[]) {
  const activeAccounts = accounts.filter((account) => account.isActive !== false);
  const candidates = activeAccounts.length ? activeAccounts : accounts;

  return (
    candidates.find((account) => account.id === DEFAULT_PLATFORM_ACCOUNT_ID)?.id ??
    candidates.find((account) => account.provider.toLowerCase() === DEFAULT_PLATFORM_PROVIDER)?.id ??
    candidates[0]?.id ??
    ""
  );
}
