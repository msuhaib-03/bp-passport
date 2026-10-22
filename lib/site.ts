const FALLBACK_ORIGIN = "http://localhost:3000";

function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidate = configured || (vercelHost ? `https://${vercelHost}` : FALLBACK_ORIGIN);

  try {
    return new URL(candidate).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export const SITE_ORIGIN = siteOrigin();
export const SITE_NAME = "BP Passport";
export const PUBLIC_LOCATION = "Karachi, Sindh, Pakistan";

export const TEAM = [
  {
    name: "Uzair Ahmad",
    role: "Founder & CEO",
    linkedin: "https://www.linkedin.com/in/uzairahmad02",
    portfolio: "https://druzairahmadrph.netlify.app",
  },
  {
    name: "Muhammad Suhaib",
    role: "Co-Founder & Tech Lead",
    linkedin: "https://www.linkedin.com/in/msuhaib-03-fsjavadev",
    portfolio: "https://portfolio-muhammadsuhaib.vercel.app",
  },
] as const;

export function absoluteUrl(pathname: string) {
  return new URL(pathname, `${SITE_ORIGIN}/`).toString();
}
