export * from "./server/auth";

export { POST as loginPOST } from "./server/handlers/login";

export { POST as logoutPOST } from "./server/handlers/logout";

export { GET as meGET } from "./server/handlers/me";

export { POST as registerPOST } from "./server/handlers/register";

export { DELETE as delete_accountDELETE } from "./server/handlers/delete-account";

export { POST as resend_verificationPOST } from "./server/handlers/resend-verification";

export { POST as verify_emailPOST } from "./server/handlers/verify-email";

export { POST as password_reset_requestPOST } from "./server/handlers/password-reset-request";

export { POST as password_reset_confirmPOST } from "./server/handlers/password-reset-confirm";
export { proxyIdentityRequest, createIdentityServiceClient } from "./server/service-client";
