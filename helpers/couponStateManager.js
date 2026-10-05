// couponStateManager.js
// Enhanced with coupon data synchronization and timestamp tracking

// Keys for localStorage
const STORAGE_KEYS = {
    COUPONS: 'app_coupons',
    LOADING: 'app_loading_state',
    LAST_SYNC: 'app_last_sync_time',
    LOCATION_SOURCE: 'app_location_source',
    LOCATION_NAME: 'app_location_name'
};

// Maximum age of cached coupons (in milliseconds)
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

// Function to save coupons to localStorage
export const saveCoupons = (coupons) => {
    // Save coupons with a timestamp
    const couponData = {
        coupons,
        timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(couponData));

    // Update last sync time
    saveLastSyncTime(Date.now());

    // Dispatch a custom event to notify components of the change
    window.dispatchEvent(new CustomEvent('coupons-updated'));
};

// Function to get coupons from localStorage
export const getCoupons = () => {
    const couponDataStr = localStorage.getItem(STORAGE_KEYS.COUPONS);
    if (!couponDataStr) return [];

    const couponData = JSON.parse(couponDataStr);
    return couponData.coupons || [];
};

// Function to check if the cached coupons are stale
export const areCouponsStale = () => {
    const couponDataStr = localStorage.getItem(STORAGE_KEYS.COUPONS);
    if (!couponDataStr) return true;

    const couponData = JSON.parse(couponDataStr);
    const timestamp = couponData.timestamp || 0;
    const age = Date.now() - timestamp;

    return age > MAX_CACHE_AGE;
};



// Function to save loading state
export const saveLoadingState = (isLoading) => {
    localStorage.setItem(STORAGE_KEYS.LOADING, JSON.stringify(isLoading));
    // Dispatch a custom event to notify components of the change
    window.dispatchEvent(new CustomEvent('loading-updated'));
};

// Function to get loading state
export const getLoadingState = () => {
    const loadingStr = localStorage.getItem(STORAGE_KEYS.LOADING);
    return loadingStr ? JSON.parse(loadingStr) : false;
};

// Function to save last sync time
export const saveLastSyncTime = (timestamp) => {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
};

// Function to get last sync time
export const getLastSyncTime = () => {
    const timestampStr = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return timestampStr ? parseInt(timestampStr, 10) : 0;
};



// Function to determine if we need to refresh data based on time
export const shouldRefreshData = () => {
    const lastSync = getLastSyncTime();
    const timeSinceLastSync = Date.now() - lastSync;
    return timeSinceLastSync > MAX_CACHE_AGE;
};

// Function to save location source (area, city, all)
export const saveLocationSource = (source, name = null) => {
    localStorage.setItem(STORAGE_KEYS.LOCATION_SOURCE, source || 'all');
    localStorage.setItem(STORAGE_KEYS.LOCATION_NAME, name || '');
    window.dispatchEvent(new CustomEvent('location-source-updated'));
};

// Function to get location source
export const getLocationSource = () => {
    return localStorage.getItem(STORAGE_KEYS.LOCATION_SOURCE) || 'all';
};

// Function to get location name
export const getLocationName = () => {
    return localStorage.getItem(STORAGE_KEYS.LOCATION_NAME) || '';
};