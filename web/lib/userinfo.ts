export type OidcUserProfile = {
  sub: string;
  name?: string;
  email?: string;
  nickname?: string;
};

export function resolveDisplayName(profile: {
  sub: string;
  name?: string;
  nickname?: string;
  email?: string;
}): string {
  return (
    profile.name?.trim() ||
    profile.nickname?.trim() ||
    profile.email?.trim() ||
    profile.sub
  );
}

export function hasReadableProfile(profile: {
  name?: string;
  nickname?: string;
  email?: string;
}): boolean {
  return Boolean(profile.name?.trim() || profile.nickname?.trim() || profile.email?.trim());
}

export async function fetchOidcUserProfile(
  issuer: string,
  accessToken: string,
): Promise<OidcUserProfile | null> {
  const resp = await fetch(`${issuer.replace(/\/$/, "")}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return null;

  const userinfo = (await resp.json()) as {
    sub?: string;
    id?: string;
    name?: string;
    email?: string;
    nickname?: string;
    preferred_username?: string;
  };

  const sub = String(userinfo.sub ?? userinfo.id ?? "");
  if (!sub) return null;

  return {
    sub,
    name: userinfo.name?.trim() || undefined,
    email: userinfo.email?.trim() || undefined,
    nickname:
      userinfo.nickname?.trim() || userinfo.preferred_username?.trim() || undefined,
  };
}
