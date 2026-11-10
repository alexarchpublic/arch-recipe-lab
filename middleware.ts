import { rewrite } from "@vercel/functions";

const SOCIAL_PREVIEW_BOT =
  /(bot|facebookexternalhit|facebot|twitterbot|slackbot|slack-imgproxy|linkedinbot|discordbot|whatsapp|telegrambot|embedly|pinterest|redditbot|skypeuripreview|vkshare|quora link preview)/i;

export default function middleware(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!SOCIAL_PREVIEW_BOT.test(userAgent)) {
    return;
  }

  const { pathname } = new URL(request.url);

  if (pathname === "/" || pathname === "") {
    return rewrite(new URL("/api/site-og", request.url));
  }

  const match = pathname.match(/^\/recipe\/(\d+)$/);
  if (match) {
    return rewrite(new URL(`/api/recipe-og?id=${match[1]}`, request.url));
  }
}

export const config = {
  matcher: ["/", "/recipe/:displayNumber"],
};
