// Utility functions for error handling and user feedback
// These are additional utility functions that complement main.js

// Debounce function for rate-limiting
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for rate-limiting
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Copy text to clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard!');
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    showWarning('Failed to copy to clipboard');
    return false;
  }
}

// Format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date for display
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

// Validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Validate image URL
function isValidImageUrl(url) {
  if (!isValidUrl(url)) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext));
}

// Sanitize HTML to prevent XSS
function sanitizeHtml(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

// Generate unique ID
function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
}

// Local storage helpers with error handling
const storage = {
  get: function(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  },

  set: function(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  },

  remove: function(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  }
};

// API token storage helpers
function saveApiToken(token) {
  return storage.set('venice_api_token', token);
}

function getApiToken() {
  return storage.get('venice_api_token', '');
}

function clearApiToken() {
  return storage.remove('venice_api_token');
}

// Load saved API token on page load
function loadSavedApiToken() {
  const savedToken = getApiToken();
  if (savedToken) {
    const apiTokenInput = document.getElementById('api-token');
    if (apiTokenInput) {
      apiTokenInput.value = savedToken;
    }
  }
}

// Retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Make utility functions globally accessible
window.debounce = debounce;
window.throttle = throttle;
window.copyToClipboard = copyToClipboard;
window.formatFileSize = formatFileSize;
window.formatDate = formatDate;
window.isValidUrl = isValidUrl;
window.isValidImageUrl = isValidImageUrl;
window.sanitizeHtml = sanitizeHtml;
window.generateId = generateId;
window.storage = storage;
window.saveApiToken = saveApiToken;
window.getApiToken = getApiToken;
window.clearApiToken = clearApiToken;
window.loadSavedApiToken = loadSavedApiToken;
window.retryWithBackoff = retryWithBackoff;