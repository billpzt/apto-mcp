/**
 * Alias for /api/oauth/token — see app/authorize/route.ts for why this
 * exists at the bare root path instead of only under /api/oauth/.
 */
export { POST, OPTIONS } from "@/app/api/oauth/token/route";
