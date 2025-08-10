import { store } from '../store/store';
import { getFirebaseToken, enableFallbackMode } from '../store/authSlice';
import { ClientLogger } from './logger';

/**
 * Helper function to make API calls with Firebase token fallback handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @param {boolean} requiresAuth - Whether the API requires authentication
 * @returns {Promise<Response>} - Fetch response
 */
export const apiCallWithFallback = async (url, options = {}, requiresAuth = true) => {
  const state = store.getState();
  const { fallbackMode, quotaExceededUntil, firebaseToken } = state.auth;
  
  // If we don't require auth, make the call directly
  if (!requiresAuth) {
    return fetch(url, options);
  }
  
  // Check if we're in quota exceeded cooldown
  if (quotaExceededUntil && Date.now() < quotaExceededUntil) {
    ClientLogger.warn('API call skipped - Firebase quota exceeded cooldown active', {
      url,
      cooldownUntil: new Date(quotaExceededUntil).toISOString()
    });
    
    // Return a mock response for non-critical calls
    if (url.includes('/alerts/stats') || url.includes('/alerts/pec-status')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Service temporarily unavailable due to quota limits',
        fallback: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    throw new Error('Firebase quota exceeded - service temporarily unavailable');
  }
  
  let token = firebaseToken;
  
  // Try to get fresh token if we don't have one or if not in fallback mode
  if (!token && !fallbackMode) {
    try {
      const tokenResult = await store.dispatch(getFire