// Minimal inline icon set (stroke-based), sized by the `size` prop.
const S = ({ size = 18, children, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

export const IconUser = (p) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></S>;
export const IconBriefcase = (p) => <S {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></S>;
export const IconBuilding = (p) => <S {...p}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h6" /></S>;
export const IconShield = (p) => <S {...p}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></S>;
export const IconSearch = (p) => <S {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></S>;
export const IconChat = (p) => <S {...p}><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /></S>;
export const IconDoc = (p) => <S {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></S>;
export const IconEye = (p) => <S {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></S>;
export const IconUpload = (p) => <S {...p}><path d="M12 15V4M8 8l4-4 4 4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></S>;
export const IconClipboard = (p) => <S {...p}><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6" /></S>;
export const IconChart = (p) => <S {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></S>;
export const IconSend = (p) => <S {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></S>;
export const IconBlock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></S>;
export const IconLogout = (p) => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></S>;
export const IconBell = (p) => <S {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></S>;
export const IconCheck = (p) => <S {...p}><path d="M20 6L9 17l-5-5" /></S>;
export const IconLayers = (p) => <S {...p}><path d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" /></S>;
export const IconDownload = (p) => <S {...p}><path d="M12 4v11M8 11l4 4 4-4" /><path d="M4 19h16" /></S>;
export const IconSparkle = (p) => <S {...p}><path d="M12 3l1.8 4.9L18.7 9 13.8 10.8 12 15.7 10.2 10.8 5.3 9l4.9-1.8z" /></S>;
export const IconBookmark = (p) => <S {...p}><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" /></S>;
export const IconStar = (p) => <S {...p}><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" /></S>;
export const IconCamera = (p) => <S {...p}><path d="M3 8h3l2-3h8l2 3h3v11H3z" /><circle cx="12" cy="13" r="3.5" /></S>;
export const IconTrend = (p) => <S {...p}><path d="M3 17l6-6 4 4 7-7" /><path d="M14 8h6v6" /></S>;
export const IconLock = (p) => <S {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></S>;
