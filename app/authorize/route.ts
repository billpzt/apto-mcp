/**
 * Alias for /api/oauth/authorize.
 *
 * Claude's custom-connector OAuth client requests this bare root path
 * (`<deployment-host>/authorize`) instead of using the endpoint advertised
 * in /.well-known/oauth-authorization-server, so this route exists purely
 * to match what the client actually does. Same handler, just re-exported
 * at the conventional path.
 */
export { GET } from "@/app/api/oauth/authorize/route";
