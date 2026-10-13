/**
 * ============================================================
 *  Rank-Holder — Firebase Authentication Client Config
 *  Handles: Google Sign-In, Email/Password, ID Token exchange
 * ============================================================
 *
 * ⚠️  SETUP: Replace the firebaseConfig below with your own
 *     Firebase project settings from:
 *     https://console.firebase.google.com → Project Settings → General → Your Apps
 *
 *     Then enable these in Firebase Console → Authentication → Sign-in method:
 *       ✅  Email/Password
 *       ✅  Google
 */

const firebaseConfig = {
    apiKey: "AIzaSyBE5uj5jlhqWieGG6XREc1G4Q7-1rCEy7w",
    authDomain: "lyrical-plexus-748x0.firebaseapp.com",
    projectId: "lyrical-plexus-748x0",
    storageBucket: "lyrical-plexus-748x0.firebasestorage.app",
    messagingSenderId: "462985518808",
    appId: "1:462985518808:web:d407bca2ad8ab5c77e41ad"
};

/* ── Load Firebase SDK lazily via CDN ─────────────────────── */
(function loadFirebaseSDK(callback) {
    if (window._firebaseLoaded) { callback(); return; }

    const compat = document.createElement('script');
    compat.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js';
    compat.onload = () => {
        const authScript = document.createElement('script');
        authScript.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js';
        
        const analyticsScript = document.createElement('script');
        analyticsScript.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics-compat.js';

        let scriptsLoaded = 0;
        const checkReady = () => {
            scriptsLoaded++;
            if (scriptsLoaded === 2) {
                try {
                    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
                    // Initialize Analytics
                    firebase.analytics();
                    window._firebaseLoaded = true;
                    console.log('🔥 Firebase Auth & Analytics initialized');
                    callback();
                } catch (e) {
                    console.warn('⚠️ Firebase init failed:', e.message);
                }
            }
        };

        authScript.onload = checkReady;
        analyticsScript.onload = checkReady;
        
        document.head.appendChild(authScript);
        document.head.appendChild(analyticsScript);
    };
    document.head.appendChild(compat);
})(function onFirebaseReady() {
    window._firebaseReady = true;
    document.dispatchEvent(new Event('firebase:ready'));
});

/* ═══════════════════════════════════════════════════════════════
   RankHolderFirebase — Auth Helper Object
═══════════════════════════════════════════════════════════════ */
window.RankHolderFirebase = {
    exchangeUser: async function (user) {
        const idToken = await user.getIdToken(/* forceRefresh */ true);

        const backendRes = await fetch('/api/auth/firebase-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idToken,
                name: user.displayName || '',
                email: user.email || '',
                photo_url: user.photoURL || ''
            })
        });

        const data = await backendRes.json();
        if (!backendRes.ok || !data.success) {
            throw new Error(data.error || 'Google Sign-In failed on server.');
        }

        if (data.token) localStorage.setItem('rh_auth_token', data.token);
        if (data.user) localStorage.setItem('rh_user', JSON.stringify(data.user));
        if (data.user?.email) localStorage.setItem('rh_registered_email', data.user.email.toLowerCase());

        return { success: true, user: data.user, redirect: data.redirect };
    },

    handleRedirectResult: async function () {
        if (!window.firebase) return null;
        const result = await firebase.auth().getRedirectResult();
        if (!result || !result.user) return null;
        return this.exchangeUser(result.user);
    },

    /**
     * Sign in with Google. Use a redirect when an embedded browser blocks popups.
     * On success → exchanges Firebase ID token with our backend
     * which then issues a Rank-Holder session token.
     */
    signInWithGoogle: async function () {
        try {
            if (!window.firebase) throw new Error('Firebase not loaded yet. Please wait a moment and try again.');
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');

            try {
                const result = await firebase.auth().signInWithPopup(provider);
                return this.exchangeUser(result.user);
            } catch (popupError) {
                if (popupError.code !== 'auth/popup-blocked' &&
                    popupError.code !== 'auth/operation-not-supported-in-this-environment') {
                    throw popupError;
                }
                await firebase.auth().signInWithRedirect(provider);
                return { success: false, redirecting: true };
            }

        } catch (err) {
            // Google popup was closed by user — soft fail
            if (err.code === 'auth/popup-closed-by-user') {
                return { success: false, cancelled: true };
            }
            console.error('[Firebase] Google sign-in error:', err);
            throw err;
        }
    }
};
