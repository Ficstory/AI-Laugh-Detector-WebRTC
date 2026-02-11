import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { userStore } from '../stores/userStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  withCredentials: true, // 쿠키 자동 전송 (HttpOnly Cookie 기반 Refresh Token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// 토큰 재발급 중복 요청 방지
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// 회원가입 시 registerToken을 사용하는 엔드포인트 (Authorization 헤더 제외)
const REGISTER_TOKEN_ENDPOINTS = [
  '/user/upload/profileImage',
  '/user/confirm/profileImage',
  '/user/delete/profileImage',
  '/auth/regist',
];

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // 회원가입 관련 API이고 registerToken이 body에 있으면 Authorization 헤더 사용 안함
    const isRegisterTokenEndpoint = REGISTER_TOKEN_ENDPOINTS.some(
      (endpoint) => config.url?.includes(endpoint)
    );

    // config.data가 문자열일 수 있으므로 파싱 시도
    let hasRegisterToken = false;
    if (config.data) {
      if (typeof config.data === 'string') {
        try {
          const parsed = JSON.parse(config.data);
          hasRegisterToken = !!parsed.registerToken;
        } catch {
          hasRegisterToken = false;
        }
      } else {
        hasRegisterToken = !!config.data.registerToken;
      }
    }

    // registerToken을 사용하는 회원가입 요청인 경우 Authorization 헤더 제거
    if (isRegisterTokenEndpoint && hasRegisterToken) {
      delete config.headers.Authorization;
      console.log('회원가입 요청 - Authorization 헤더 제외:', config.url);
    } else {
      // 일반 요청은 토큰 추가
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 에러이고, 재시도하지 않은 요청인 경우
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 토큰 재발급 요청 자체가 실패한 경우 무한 루프 방지
      if (originalRequest.url === '/auth/refresh') {
        userStore.getState().logout();
        window.location.href = '/?modal=login';
        return Promise.reject(error);
      }

      // 이미 토큰 재발급 중이면 대기
      if (isRefreshing) {
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        userStore.getState().logout();
        window.location.href = '/?modal=login';
        isRefreshing = false;
        return Promise.reject(error);
      }

      try {
        // 쿠키에서 자동으로 refresh_token 전송 (withCredentials: true)
        const response = await api.post('/auth/refresh');
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        // 새 토큰 저장 (Zustand + localStorage 동기화)
        userStore.getState().setTokens(accessToken, newRefreshToken);

        // 대기 중인 요청들에게 새 토큰 전달
        onRefreshed(accessToken);

        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 토큰 재발급 실패 - 로그아웃 처리 (Zustand + localStorage 동기화)
        userStore.getState().logout();
        window.location.href = '/?modal=login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
