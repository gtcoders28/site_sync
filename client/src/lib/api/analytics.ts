import { apiClient } from './client';

export const analyticsApi = {
  getDealerAnalytics: (params?: Record<string, any>) =>
    apiClient.get<any>('/analytics/dealer', { ...params }),
  getDistributorAnalytics: (params?: Record<string, any>) =>
    apiClient.get<any>('/analytics/distributor', { ...params }),
  getPlatformOwnerAnalytics: (params?: Record<string, any>) =>
    apiClient.get<any>('/analytics/platform-owner', { ...params }),
};
