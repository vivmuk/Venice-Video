// Global state management for Venice Video API app

const state = {
  // API Authentication
  apiToken: '',
  
  // Processing Queue
  currentQueueId: null,
  isProcessing: false,
  progress: 0,
  
  // Video Parameters
  videoParameters: {
    prompt: '',
    duration: 5,
    style: 'cinematic',
    camera: 'static',
    resolution: '1080p',
    aspectRatio: '16:9'
  },
  
  // Generated Video
  videoUrl: null,
  videoTitle: '',
  
  // Error Handling
  error: null,
  
  // State Management Methods
  updateToken(token) {
    this.apiToken = token;
  },
  
  setQueueId(queueId) {
    this.currentQueueId = queueId;
  },
  
  setProcessingStatus(status) {
    this.isProcessing = status;
  },
  
  updateProgress(percentage) {
    this.progress = Math.min(100, Math.max(0, percentage));
  },
  
  setVideoParameters(params) {
    this.videoParameters = { ...this.videoParameters, ...params };
  },
  
  setVideoData(url, title) {
    this.videoUrl = url;
    this.videoTitle = title;
  },
  
  setError(error) {
    this.error = error;
  },
  
  clearError() {
    this.error = null;
  },
  
  reset() {
    this.currentQueueId = null;
    this.isProcessing = false;
    this.progress = 0;
    this.videoUrl = null;
    this.videoTitle = '';
    this.error = null;
  }
};

// Make state globally accessible
window.veniceState = state;