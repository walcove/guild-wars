export const sessionCookieName=process.env.GW_E2E_PRODUCTION==='true'?'__Host-gw_session':'gw_session';
export const csrfCookieName=process.env.GW_E2E_PRODUCTION==='true'?'__Host-gw_csrf':'gw_csrf';
