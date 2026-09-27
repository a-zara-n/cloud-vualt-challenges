// TechVault Portal Configuration
// Last updated: 2026-09-15

const CONFIG = {
  apiBaseUrl: "https://portal.techvault-ctf.example/api",
  version: "2.1.3",
  environment: "production",

  // TODO: Remove stale debug config before production release
  // debugKey: "sk-debug-portal-2026",

  cognito: {
    region: "ap-northeast-1",
    userPoolId: "ap-northeast-1_AbCdEfGhI",
    clientId: "1a2b3c4d5e6f7g8h9i0jklmnop",
  },
};

export default CONFIG;
