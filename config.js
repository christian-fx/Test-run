// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA2679MN3Lrtq3WcpEh1vKgRu69q1-UUP0",
  authDomain: "groccery-goto.firebaseapp.com",
  projectId: "groccery-goto",
  storageBucket: "groccery-goto.firebasestorage.app",
  messagingSenderId: "989751163422",
  appId: "1:989751163422:web:69dd3128e3290eba870c0f"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Cache configuration
const CACHE_KEYS = {
    USER_DATA: 'userData_cache',
    ADDRESSES: 'addresses_cache', 
    PAYMENTS: 'payments_cache',
    ORDERS: 'orders_cache',
    TIMESTAMP: 'cache_timestamp'
};

// Cache management functions
const cacheUtils = {
    // Get cached data
    getCachedData: (key) => {
        try {
            const cached = localStorage.getItem(key);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    },

    // Set cached data
    setCachedData: (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            localStorage.setItem(CACHE_KEYS.TIMESTAMP, Date.now());
        } catch (error) {
            console.error('Error writing cache:', error);
        }
    },

    // Clear all cache
    clearCache: () => {
        Object.values(CACHE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },

    // Check if cache is valid (5 minutes)
    isCacheValid: () => {
        const timestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
        if (!timestamp) return false;
        return (Date.now() - parseInt(timestamp)) < 5 * 60 * 1000;
    },

    // Preload user data when authenticated
    preloadUserData: async (userId) => {
        if (!userId) return;
        
        try {
            // Preload user data
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = { uid: userId, ...userDoc.data() };
                cacheUtils.setCachedData(CACHE_KEYS.USER_DATA, userData);
            }

            // Preload addresses
            const addressesSnapshot = await db.collection('users').doc(userId).collection('addresses').get();
            const addresses = [];
            addressesSnapshot.forEach(doc => {
                addresses.push({ id: doc.id, ...doc.data() });
            });
            cacheUtils.setCachedData(CACHE_KEYS.ADDRESSES, addresses);

            // Preload payment methods
            const paymentsSnapshot = await db.collection('users').doc(userId).collection('payments').get();
            const paymentMethods = [];
            paymentsSnapshot.forEach(doc => {
                paymentMethods.push({ id: doc.id, ...doc.data() });
            });
            cacheUtils.setCachedData(CACHE_KEYS.PAYMENTS, paymentMethods);

            // Preload recent orders
            const ordersSnapshot = await db.collection('users').doc(userId).collection('orders').orderBy('createdAt', 'desc').limit(10).get();
            const orders = [];
            ordersSnapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            cacheUtils.setCachedData(CACHE_KEYS.ORDERS, orders);

        } catch (error) {
            console.error('Error preloading user data:', error);
        }
    }
};

// Firebase utility functions with caching and email services
const firebaseUtils = {
    // Get current user data
    getCurrentUser: () => {
        return new Promise((resolve, reject) => {
            auth.onAuthStateChanged(user => {
                if (user) {
                    resolve(user);
                } else {
                    resolve(null);
                }
            });
        });
    },
    
    // Get user data from database with caching
    getUserData: (userId) => {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (cacheUtils.isCacheValid()) {
                const cachedData = cacheUtils.getCachedData(CACHE_KEYS.USER_DATA);
                if (cachedData && cachedData.uid === userId) {
                    resolve(cachedData);
                    return;
                }
            }

            // If not in cache, fetch from Firebase
            db.collection('users').doc(userId).get()
                .then(doc => {
                    if (doc.exists) {
                        const userData = { uid: userId, ...doc.data() };
                        // Cache the data
                        cacheUtils.setCachedData(CACHE_KEYS.USER_DATA, userData);
                        resolve(userData);
                    } else {
                        resolve(null);
                    }
                })
                .catch(error => {
                    console.error('Error fetching user data:', error);
                    reject(error);
                });
        });
    },
    
    // Save user data to database and cache
    saveUserData: (userId, userData) => {
        // Update cache immediately
        const cachedData = { uid: userId, ...userData };
        cacheUtils.setCachedData(CACHE_KEYS.USER_DATA, cachedData);
        
        return db.collection('users').doc(userId).set(userData);
    },
    
    // Update user data and cache
    updateUserData: (userId, updates) => {
        // Update cache
        const cachedData = cacheUtils.getCachedData(CACHE_KEYS.USER_DATA);
        if (cachedData && cachedData.uid === userId) {
            const updatedData = { ...cachedData, ...updates };
            cacheUtils.setCachedData(CACHE_KEYS.USER_DATA, updatedData);
        }
        
        return db.collection('users').doc(userId).update(updates);
    },

    // Get addresses with caching
    getUserAddresses: (userId) => {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (cacheUtils.isCacheValid()) {
                const cachedAddresses = cacheUtils.getCachedData(CACHE_KEYS.ADDRESSES);
                if (cachedAddresses) {
                    resolve(cachedAddresses);
                    return;
                }
            }

            // Fetch from Firebase
            db.collection('users').doc(userId).collection('addresses').get()
                .then(snapshot => {
                    const addresses = [];
                    snapshot.forEach(doc => {
                        addresses.push({ id: doc.id, ...doc.data() });
                    });
                    // Cache the data
                    cacheUtils.setCachedData(CACHE_KEYS.ADDRESSES, addresses);
                    resolve(addresses);
                })
                .catch(error => {
                    console.error('Error fetching addresses:', error);
                    reject(error);
                });
        });
    },

    // Get payment methods with caching
    getUserPayments: (userId) => {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (cacheUtils.isCacheValid()) {
                const cachedPayments = cacheUtils.getCachedData(CACHE_KEYS.PAYMENTS);
                if (cachedPayments) {
                    resolve(cachedPayments);
                    return;
                }
            }

            // Fetch from Firebase
            db.collection('users').doc(userId).collection('payments').get()
                .then(snapshot => {
                    const payments = [];
                    snapshot.forEach(doc => {
                        payments.push({ id: doc.id, ...doc.data() });
                    });
                    // Cache the data
                    cacheUtils.setCachedData(CACHE_KEYS.PAYMENTS, payments);
                    resolve(payments);
                })
                .catch(error => {
                    console.error('Error fetching payment methods:', error);
                    reject(error);
                });
        });
    },

    // Get orders with caching
    getUserOrders: (userId) => {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (cacheUtils.isCacheValid()) {
                const cachedOrders = cacheUtils.getCachedData(CACHE_KEYS.ORDERS);
                if (cachedOrders) {
                    resolve(cachedOrders);
                    return;
                }
            }

            // Fetch from Firebase
            db.collection('users').doc(userId).collection('orders').orderBy('createdAt', 'desc').limit(10).get()
                .then(snapshot => {
                    const orders = [];
                    snapshot.forEach(doc => {
                        orders.push({ id: doc.id, ...doc.data() });
                    });
                    // Cache the data
                    cacheUtils.setCachedData(CACHE_KEYS.ORDERS, orders);
                    resolve(orders);
                })
                .catch(error => {
                    console.error('Error fetching orders:', error);
                    reject(error);
                });
        });
    },

    // Clear user cache
    clearUserCache: (userId) => {
        cacheUtils.clearCache();
    },
    
    // Sign up user with email and password
    signUp: (email, password) => {
        return auth.createUserWithEmailAndPassword(email, password);
    },
    
    // Sign in user with email and password
    signIn: (email, password) => {
        return auth.signInWithEmailAndPassword(email, password);
    },
    
    // Send email verification
    sendEmailVerification: () => {
        const user = auth.currentUser;
        if (user) {
            return user.sendEmailVerification({
                url: window.location.origin, // Redirect URL after verification
                handleCodeInApp: true
            });
        }
        return Promise.reject(new Error('No user logged in'));
    },
    
    // Sign out user and clear cache
    signOut: () => {
        cacheUtils.clearCache();
        return auth.signOut();
    },
    
    // Send password reset email
    sendPasswordReset: (email) => {
        return auth.sendPasswordResetEmail(email, {
            url: window.location.origin + '/login', // Redirect URL after password reset
            handleCodeInApp: false
        });
    },

    // Send custom email notification (using Firebase Functions would be better for this)
    sendOrderConfirmationEmail: async (userId, orderData) => {
        try {
            // Get user data to send personalized email
            const userData = await firebaseUtils.getUserData(userId);
            const user = auth.currentUser;
            
            if (!user || !user.email) {
                throw new Error('No user email available');
            }

            // For custom emails, you would typically use Firebase Functions
            // This is a placeholder for where you'd integrate with a cloud function
            console.log('Preparing to send order confirmation email to:', user.email);
            console.log('Order details:', orderData);
            
            // In a real implementation, you would call a Firebase Cloud Function here
            // Example:
            // const sendEmailFunction = firebase.functions().httpsCallable('sendOrderConfirmation');
            // return sendEmailFunction({
            //     email: user.email,
            //     userName: userData.displayName || userData.email,
            //     orderId: orderData.id,
            //     orderTotal: orderData.total,
            //     items: orderData.items
            // });
            
            // For now, we'll use Firebase's built-in email as a workaround
            // You can trigger a password reset style email with custom content
            // or use the user's email verification with custom templates in Firebase Console
            
            return Promise.resolve({ success: true, message: 'Email queued for sending' });
            
        } catch (error) {
            console.error('Error sending order confirmation email:', error);
            throw error;
        }
    },

    // Update user email and send verification
    updateUserEmail: (newEmail) => {
        const user = auth.currentUser;
        if (user) {
            return user.updateEmail(newEmail)
                .then(() => {
                    // Send verification email to new email address
                    return user.sendEmailVerification({
                        url: window.location.origin,
                        handleCodeInApp: true
                    });
                });
        }
        return Promise.reject(new Error('No user logged in'));
    },

    // Verify email action code (for email verification links)
    verifyEmailActionCode: (actionCode) => {
        return auth.applyActionCode(actionCode);
    },

    // Check action code info (what type of email action)
    checkActionCode: (actionCode) => {
        return auth.checkActionCode(actionCode);
    }
};

// Cart functionality
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// User authentication state with caching
auth.onAuthStateChanged((user) => {
    const profileBtn = document.getElementById('profileBtn');
    const authBtn = document.getElementById('authBtn');
    
    if (user) {
        if (profileBtn) profileBtn.style.display = 'flex';
        if (authBtn) authBtn.style.display = 'none';
        
        // Check if email is verified
        if (!user.emailVerified) {
            console.log('Email not verified. Consider prompting user to verify.');
            // You can show a notification to verify email
            showEmailVerificationNotice();
        }
        
        // Pre-load user data when auth state changes for faster navigation
        cacheUtils.preloadUserData(user.uid).catch(error => {
            console.error('Error pre-loading user data:', error);
        });
    } else {
        if (profileBtn) profileBtn.style.display = 'none';
        if (authBtn) authBtn.style.display = 'flex';
        // Clear cache when user logs out
        cacheUtils.clearCache();
    }
});

// Email verification notice function
function showEmailVerificationNotice() {
    // Create or show a notification element
    const existingNotice = document.getElementById('emailVerificationNotice');
    if (existingNotice) return;
    
    const notice = document.createElement('div');
    notice.id = 'emailVerificationNotice';
    notice.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ffeb3b;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        max-width: 300px;
    `;
    
    notice.innerHTML = `
        <strong>Verify Your Email</strong>
        <p>Please check your email to verify your account.</p>
        <button onclick="resendVerificationEmail()" style="margin-top: 10px; padding: 5px 10px;">Resend Verification Email</button>
        <button onclick="this.parentElement.remove()" style="margin-left: 10px; padding: 5px 10px;">Dismiss</button>
    `;
    
    document.body.appendChild(notice);
}

// Resend verification email function
async function resendVerificationEmail() {
    try {
        await firebaseUtils.sendEmailVerification();
        alert('Verification email sent! Please check your inbox.');
    } catch (error) {
        console.error('Error resending verification email:', error);
        alert('Error sending verification email. Please try again.');
    }
}

// Cart management functions
function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    updateCartStorage();
    updateCartUI();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartStorage();
    updateCartUI();
}

function updateCartStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }
}

// Clear cart
function clearCart() {
    cart = [];
    updateCartStorage();
    updateCartUI();
}

// Get cart total
function getCartTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Get cart item count
function getCartItemCount() {
    return cart.reduce((count, item) => count + item.quantity, 0);
}

// Initialize cart UI on page load
document.addEventListener('DOMContentLoaded', function() {
    updateCartUI();
    
    // Check authentication and preload data if user is logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Preload user data for better performance
            cacheUtils.preloadUserData(user.uid);
        }
    });
});

// Handle email action links (verification, password reset, etc.)
function handleEmailAction() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const actionCode = urlParams.get('oobCode');
    
    if (mode && actionCode) {
        switch (mode) {
            case 'verifyEmail':
                handleEmailVerification(actionCode);
                break;
            case 'resetPassword':
                handlePasswordReset(actionCode);
                break;
            default:
                console.log('Unknown email action mode:', mode);
        }
    }
}

// Handle email verification
async function handleEmailVerification(actionCode) {
    try {
        await firebaseUtils.verifyEmailActionCode(actionCode);
        alert('Email verified successfully! You can now log in.');
        // Redirect to login or home page
        window.location.href = '/login';
    } catch (error) {
        console.error('Error verifying email:', error);
        alert('Error verifying email. The link may have expired.');
    }
}

// Handle password reset
function handlePasswordReset(actionCode) {
    // Store the action code for the password reset page
    localStorage.setItem('resetCode', actionCode);
    window.location.href = '/reset-password';
}

// Call this on pages that might receive email action links
handleEmailAction();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        auth,
        db,
        firebaseUtils,
        cart,
        addToCart,
        removeFromCart,
        updateCartStorage,
        updateCartUI,
        clearCart,
        getCartTotal,
        getCartItemCount,
        cacheUtils,
        handleEmailAction,
        resendVerificationEmail
    };
}