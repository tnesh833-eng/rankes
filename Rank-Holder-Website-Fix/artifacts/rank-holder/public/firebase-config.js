/**
 * Rank-Holder Authentication Client
 * Firebase Authentication has been removed per configuration.
 */
window.RankHolderFirebase = {
    isConfigured: function() { return false; },
    signInWithGoogle: async function() {
        throw new Error("Google Sign-In via Firebase has been disabled. Please use 'Continue with Email' to sign in.");
    },
    handleRedirectResult: async function() { return null; }
};
