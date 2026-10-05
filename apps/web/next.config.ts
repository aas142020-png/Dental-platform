import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@dental/db-types", "@dental/design-tokens", "@dental/i18n"],
};

export default withNextIntl(config);
